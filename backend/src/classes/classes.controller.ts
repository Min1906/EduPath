import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('classes')
export class ClassesController {
  constructor(private prisma: PrismaService) {}

  private async yearId(input?: string | number) {
    if (input) return Number(input);
    return (await this.prisma.academicYear.findFirstOrThrow({ where: { isActive: true } })).id;
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STUDENT)
  @Get()
  async list(@Query('academicYearId') year?: string, @Query('gradeLevel') grade?: string) {
    const academicYearId = await this.yearId(year);
    const classes = await this.prisma.schoolClass.findMany({
      where: {
        academicYearId,
        ...(grade && grade !== 'ALL' ? { gradeLevel: grade } : {}),
      },
      include: {
        subjects: { include: { subject: true } },
        package: true,
        placedStudents: {
          select: {
            id: true,
            nis: true,
            name: true,
            gender: true,
            originClass: { select: { name: true } },
          },
          orderBy: { name: 'asc' },
        },
        originStudents: {
          select: {
            id: true,
            nis: true,
            name: true,
            gender: true,
            placedClass: { select: { name: true } },
          },
          orderBy: { name: 'asc' },
        },
        _count: { select: { placedStudents: true, originStudents: true } },
      },
    });

    return classes.sort((a, b) => {
      if (a.gradeLevel !== b.gradeLevel) {
        return a.gradeLevel.localeCompare(b.gradeLevel);
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  async create(@Body() body: any) {
    if (!body.name?.trim()) throw new BadRequestException('Nama kelas wajib diisi');
    const academicYearId = await this.yearId(body.academicYearId);
    const gradeLevel = body.gradeLevel || 'X';
    const capacity = Number(body.capacity || 36);
    const category = body.category ? String(body.category).trim() : 'Reguler';
    const isPackageClass = gradeLevel === 'XI';

    return this.prisma.$transaction(async (tx) => {
      const cls = await tx.schoolClass.create({
        data: {
          academicYearId,
          name: body.name.trim(),
          gradeLevel,
          capacity,
          category,
          isPackageClass,
          subjects: {
            create: (body.subjectIds ?? []).map((subjectId: number) => ({
              subjectId: Number(subjectId),
            })),
          },
        },
        include: {
          subjects: { include: { subject: true } },
          package: true,
          _count: { select: { placedStudents: true, originStudents: true } },
        },
      });

      return cls;
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const classId = Number(id);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.schoolClass.findUniqueOrThrow({ where: { id: classId } });

      const data: any = {};
      if (body.name !== undefined) data.name = String(body.name).trim();
      if (body.gradeLevel !== undefined) {
        data.gradeLevel = body.gradeLevel;
        data.isPackageClass = body.gradeLevel === 'XI';
      }
      if (body.capacity !== undefined) data.capacity = Number(body.capacity);
      if (body.category !== undefined) data.category = body.category ? String(body.category).trim() : null;

      if (Array.isArray(body.subjectIds)) {
        await tx.classSubject.deleteMany({ where: { classId } });
        if (body.subjectIds.length > 0) {
          await tx.classSubject.createMany({
            data: body.subjectIds.map((subjectId: number) => ({
              classId,
              subjectId: Number(subjectId),
            })),
          });
        }
      }

      return tx.schoolClass.update({
        where: { id: classId },
        data,
        include: {
          subjects: { include: { subject: true } },
          package: true,
          placedStudents: { select: { id: true, nis: true, name: true, gender: true } },
          originStudents: { select: { id: true, nis: true, name: true, gender: true } },
          _count: { select: { placedStudents: true, originStudents: true } },
        },
      });
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const classId = Number(id);
    const cls = await this.prisma.schoolClass.findUnique({
      where: { id: classId },
      include: { _count: { select: { originStudents: true, placedStudents: true } } },
    });

    if (!cls) {
      throw new BadRequestException('Kelas tidak ditemukan');
    }

    if (cls._count.originStudents > 0 || cls._count.placedStudents > 0) {
      throw new BadRequestException(
        `Kelas "${cls.name}" tidak dapat dihapus karena masih memiliki ${cls._count.originStudents} siswa kelas asal dan ${cls._count.placedStudents} siswa penempatan. Pindahkan siswa terlebih dahulu.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.classSubject.deleteMany({ where: { classId } });
      await tx.classPackage.deleteMany({ where: { classId } });
      await tx.schoolClass.delete({ where: { id: classId } });
      return { deleted: true, message: `Kelas "${cls.name}" berhasil dihapus.` };
    });
  }
}

