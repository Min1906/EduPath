import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { JwtAuthGuard, Roles, RolesGuard } from "../common/auth";

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("academic-years")
export class AcademicYearsController {
  constructor(private prisma: PrismaService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get()
  list() {
    return this.prisma.academicYear.findMany({ orderBy: { name: "desc" } });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STUDENT)
  @Get("active")
  active() {
    return this.prisma.academicYear.findFirst({ where: { isActive: true } });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post()
  async create(
    @Body() body: { name: string; copyFromId?: number },
  ) {
    if (!body.name?.trim()) throw new BadRequestException('Nama tahun ajaran wajib diisi');
    return this.prisma.$transaction(async (tx) => {
      const source = body.copyFromId
        ? await tx.academicYear.findUnique({ where: { id: body.copyFromId } })
        : null;
      const year = await tx.academicYear.create({
        data: { name: body.name.trim(), policy: source?.policy ?? undefined },
      });
      if (body.copyFromId) {
        const classes = await tx.schoolClass.findMany({
          where: { academicYearId: body.copyFromId },
          include: { subjects: true, package: { include: { subjects: true } } },
        });
        for (const c of classes) {
          const nc = await tx.schoolClass.create({
            data: {
              academicYearId: year.id,
              name: c.name,
              gradeLevel: c.gradeLevel,
              capacity: c.capacity,
              category: c.category,
              isPackageClass: c.isPackageClass,
            },
          });
          for (const rel of c.subjects)
            await tx.classSubject.create({
              data: {
                classId: nc.id,
                subjectId: rel.subjectId,
                periods: rel.periods,
              },
            });
          if (c.package) {
            const pkg = await tx.classPackage.create({
              data: {
                academicYearId: year.id,
                classId: nc.id,
                title: c.package.title,
                description: c.package.description,
                capacity: c.package.capacity,
                status: "DRAFT",
              },
            });
            for (const rel of c.package.subjects)
              await tx.packageSubject.create({
                data: {
                  packageId: pkg.id,
                  subjectId: rel.subjectId,
                  isSelection: rel.isSelection,
                  selectionWeight: rel.selectionWeight,
                },
              });
          }
        }
      }
      return year;
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: { name?: string; status?: string },
  ) {
    const yearId = Number(id);
    const existing = await this.prisma.academicYear.findUnique({ where: { id: yearId } });
    if (!existing) throw new BadRequestException('Tahun ajaran tidak ditemukan');

    const data: any = {};
    if (body.name !== undefined && body.name.trim()) data.name = body.name.trim();
    if (body.status !== undefined) data.status = body.status;

    return this.prisma.academicYear.update({
      where: { id: yearId },
      data,
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Delete(":id")
  async remove(@Param("id") id: string) {
    const yearId = Number(id);
    const existing = await this.prisma.academicYear.findUnique({ where: { id: yearId } });
    if (!existing) throw new BadRequestException('Tahun ajaran tidak ditemukan');
    if (existing.isActive) {
      throw new BadRequestException('Tahun ajaran ini sedang aktif. Silakan aktifkan tahun ajaran lain terlebih dahulu sebelum menghapus.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Delete users linked to students in this year
      const students = await tx.student.findMany({ where: { academicYearId: yearId }, select: { id: true } });
      const studentIds = students.map((s) => s.id);
      if (studentIds.length > 0) {
        await tx.user.deleteMany({ where: { studentId: { in: studentIds } } });
      }

      // 2. Delete student data
      if (studentIds.length > 0) {
        const prefs = await tx.studentPreference.findMany({ where: { studentId: { in: studentIds } }, select: { id: true } });
        const prefIds = prefs.map((p) => p.id);
        if (prefIds.length > 0) {
          await tx.preferenceChoice.deleteMany({ where: { preferenceId: { in: prefIds } } });
          await tx.studentPreference.deleteMany({ where: { id: { in: prefIds } } });
        }
        await tx.placement.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.studentPackageScore.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.riasecScore.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.reportScore.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.tkaScore.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.student.deleteMany({ where: { academicYearId: yearId } });
      }

      // 4. Delete packages and classes
      const packages = await tx.classPackage.findMany({ where: { academicYearId: yearId }, select: { id: true } });
      const packageIds = packages.map((p) => p.id);
      if (packageIds.length > 0) {
        await tx.packageSubject.deleteMany({ where: { packageId: { in: packageIds } } });
        await tx.classPackage.deleteMany({ where: { id: { in: packageIds } } });
      }

      const classes = await tx.schoolClass.findMany({ where: { academicYearId: yearId }, select: { id: true } });
      const classIds = classes.map((c) => c.id);
      if (classIds.length > 0) {
        await tx.classSubject.deleteMany({ where: { classId: { in: classIds } } });
        await tx.schoolClass.deleteMany({ where: { id: { in: classIds } } });
      }

      // 5. Delete scoring configs
      await tx.scoringConfig.deleteMany({ where: { academicYearId: yearId } });

      // 6. Delete Academic Year
      await tx.academicYear.delete({ where: { id: yearId } });

      return { deleted: true, message: `Tahun ajaran "${existing.name}" beserta datanya berhasil dihapus.` };
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Post(":id/activate")
  async activate(@Param("id") id: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.academicYear.updateMany({ data: { isActive: false } });
      return tx.academicYear.update({
        where: { id: Number(id) },
        data: { isActive: true },
      });
    });
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(":id/policy")
  policy(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.prisma.academicYear.update({
      where: { id: Number(id) },
      data: { policy: body as Prisma.InputJsonValue },
    });
  }
}
