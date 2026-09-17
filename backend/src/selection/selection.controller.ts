import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { calculateRiasecFit } from '../common/riasec';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('selection')
export class SelectionController {
  constructor(private prisma: PrismaService) {}

  private async activeYear() {
    return this.prisma.academicYear.findFirstOrThrow({ where: { isActive: true } });
  }

  @Get('configs')
  async configs() {
    const year = await this.activeYear();
    return this.prisma.scoringConfig.findMany({ where: { academicYearId: year.id }, orderBy: { createdAt: 'desc' } });
  }

  @Post('configs')
  async create(@Body() body: any) {
    const academicWeight = Number(body.academicWeight ?? 0);
    const tkaWeight = Number(body.tkaWeight ?? 0);
    const riasecWeight = Number(body.riasecWeight ?? body.preferenceWeight ?? 0);
    const total = academicWeight + tkaWeight + riasecWeight;
    if (Math.abs(total - 100) > 0.01) throw new Error('Total bobot harus 100%');
    const year = await this.activeYear();
    return this.prisma.scoringConfig.create({
      data: {
        academicYearId: year.id,
        name: body.name,
        academicWeight,
        tkaWeight,
        riasecWeight,
        preferenceWeight: Number(body.preferenceWeight ?? 0),
        passingGrade: body.passingGrade ?? 0,
      },
    });
  }

  @Post('configs/activate')
  async activate(@Body() body: { id: number }) {
    const config = await this.prisma.scoringConfig.findUniqueOrThrow({ where: { id: body.id } });
    await this.prisma.scoringConfig.updateMany({ where: { academicYearId: config.academicYearId }, data: { isActive: false } });
    return this.prisma.scoringConfig.update({ where: { id: config.id }, data: { isActive: true } });
  }

  @Delete('configs/:id')
  async deleteConfig(@Param('id') id: string) {
    const configId = Number(id);
    const config = await this.prisma.scoringConfig.findUnique({
      where: { id: configId },
    });
    if (!config) throw new BadRequestException('Konfigurasi scoring tidak ditemukan');

    return this.prisma.$transaction(async (tx) => {
      // Delete associated scores
      await tx.studentPackageScore.deleteMany({ where: { configId } });
      await tx.scoringConfig.delete({ where: { id: configId } });

      // If deleted config was active, find another one to activate
      if (config.isActive) {
        const nextConfig = await tx.scoringConfig.findFirst({
          where: { academicYearId: config.academicYearId },
          orderBy: { createdAt: 'desc' },
        });
        if (nextConfig) {
          await tx.scoringConfig.update({
            where: { id: nextConfig.id },
            data: { isActive: true },
          });
        }
      }
      return { message: `Versi scoring "${config.name}" dan riwayat nilainya berhasil dihapus.` };
    });
  }

  @Delete('scores')
  async resetScores(@Query('configId') configId?: string) {
    const year = await this.activeYear();
    let count = 0;
    if (configId) {
      const res = await this.prisma.studentPackageScore.deleteMany({
        where: { configId: Number(configId) },
      });
      count = res.count;
    } else {
      const res = await this.prisma.studentPackageScore.deleteMany({
        where: { student: { academicYearId: year.id } },
      });
      count = res.count;
    }
    return { message: `Berhasil mereset dan menghapus ${count} riwayat scoring.` };
  }

  @Post('run')
  async run() {
    const year = await this.activeYear();
    const policy = (year.policy as any) ?? {};
    let config = await this.prisma.scoringConfig.findFirst({ where: { academicYearId: year.id, isActive: true } });
    if (!config) {
      config = await this.prisma.scoringConfig.create({
        data: {
          academicYearId: year.id,
          name: 'Default 50-30-20 (RIASEC)',
          academicWeight: 50,
          tkaWeight: 30,
          riasecWeight: 20,
          preferenceWeight: 0,
          passingGrade: 70,
          isActive: true,
        },
      });
    }
    const students = await this.prisma.student.findMany({
      where: { academicYearId: year.id },
      include: {
        reportScores: true,
        tkaScore: true,
        riasecScore: true,
        preference: { include: { choices: true } },
      },
    });
    const packages = await this.prisma.classPackage.findMany({
      where: { academicYearId: year.id, status: { not: 'ARCHIVED' } },
      include: { subjects: { include: { subject: true } } },
    });
    const usePassingGrade = policy.usePassingGrade !== false;
    const requireComplete = policy.requireCompleteSelectionSubjects !== false;
    const minAcademicFit = Number(policy.minAcademicFit ?? 0);
    const minTka = Number(policy.minTka ?? 0);
    const minFinalScore = Number(policy.minFinalScore ?? config.passingGrade);
    let calculated = 0;

    const academicWeight = Number(config.academicWeight);
    const tkaWeight = Number(config.tkaWeight);
    const effectiveRiasecWeight = Number(config.riasecWeight) > 0 ? Number(config.riasecWeight) : Number(config.preferenceWeight || 0);

    for (const pkg of packages) {
      const selectionSubjects = pkg.subjects.filter((item) => item.isSelection);
      const pkgSubjectsForRiasec = (selectionSubjects.length > 0 ? selectionSubjects : pkg.subjects).map((s) => ({
        name: s.subject?.name || '',
        weight: Number(s.selectionWeight || 1),
      }));

      for (const student of students) {
        let academicFit = 0;
        let complete = selectionSubjects.length > 0;
        for (const relation of selectionSubjects) {
          const scores = student.reportScores.filter((row) => row.subjectId === relation.subjectId);
          if (!scores.length) {
            complete = false;
            continue;
          }
          const average = scores.reduce((sum, row) => sum + Number(row.score), 0) / scores.length;
          academicFit += average * (Number(relation.selectionWeight) / 100);
        }

        const choice = student.preference?.choices.find((item) => item.packageId === pkg.id);
        const preferenceScore = choice?.priority === 1 ? 100 : choice?.priority === 2 ? 80 : choice?.priority === 3 ? 60 : 0;
        const tka = student.tkaScore ? Number(student.tkaScore.score) : 0;
        const riasecFit = calculateRiasecFit(student.riasecScore, pkgSubjectsForRiasec);

        const finalScore =
          academicFit * (academicWeight / 100) +
          tka * (tkaWeight / 100) +
          riasecFit * (effectiveRiasecWeight / 100);

        const completeEligible = requireComplete ? complete : true;
        const gradeEligible = usePassingGrade
          ? academicFit >= minAcademicFit && tka >= minTka && finalScore >= minFinalScore
          : true;
        const eligible = completeEligible && gradeEligible;

        await this.prisma.studentPackageScore.upsert({
          where: { studentId_packageId_configId: { studentId: student.id, packageId: pkg.id, configId: config.id } },
          update: { academicFit, tkaScore: tka, preferenceScore, riasecScore: riasecFit, finalScore, eligible },
          create: { studentId: student.id, packageId: pkg.id, configId: config.id, academicFit, tkaScore: tka, preferenceScore, riasecScore: riasecFit, finalScore, eligible },
        });
        calculated++;
      }
      const ranked = await this.prisma.studentPackageScore.findMany({
        where: { packageId: pkg.id, configId: config.id },
        orderBy: { finalScore: 'desc' },
      });
      for (let index = 0; index < ranked.length; index++) {
        await this.prisma.studentPackageScore.update({ where: { id: ranked[index].id }, data: { rank: index + 1 } });
      }
    }
    return {
      calculated,
      students: students.length,
      packages: packages.length,
      config,
      passingGrade: { usePassingGrade, minAcademicFit, minTka, minFinalScore, requireComplete },
    };
  }

  @Get('ranking')
  async ranking(
    @Query('packageId') packageId?: string,
    @Query('configId') configId?: string,
    @Query('search') search = '',
    @Query('sortBy') sortBy = 'rank',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'asc',
  ) {
    const year = await this.activeYear();
    let targetConfigId: number | undefined;

    if (configId) {
      targetConfigId = Number(configId);
    } else {
      const active = await this.prisma.scoringConfig.findFirst({
        where: { academicYearId: year.id, isActive: true },
      });
      targetConfigId = active?.id;
      if (!targetConfigId) {
        const latest = await this.prisma.scoringConfig.findFirst({
          where: { academicYearId: year.id },
          orderBy: { createdAt: 'desc' },
        });
        targetConfigId = latest?.id;
      }
    }

    if (!targetConfigId) return [];
    let orderBy: any = { rank: sortOrder };
    if (sortBy === 'originClass') {
      orderBy = { student: { originClass: { name: sortOrder } } };
    } else if (sortBy === 'name') {
      orderBy = { student: { name: sortOrder } };
    } else if (sortBy === 'nis') {
      orderBy = { student: { nis: sortOrder } };
    } else if (['rank', 'finalScore', 'academicFit', 'tkaScore', 'riasecScore'].includes(sortBy)) {
      orderBy = { [sortBy]: sortOrder };
    }

    return this.prisma.studentPackageScore.findMany({
      where: {
        configId: targetConfigId,
        ...(packageId ? { packageId: Number(packageId) } : {}),
        student: search ? { OR: [{ name: { contains: search } }, { nis: { contains: search } }] } : undefined,
      },
      include: {
        student: {
          include: {
            originClass: true,
            placedClass: true,
            riasecScore: true,
            preference: {
              include: {
                choices: {
                  include: { package: { include: { class: true } } },
                  orderBy: { priority: 'asc' },
                },
              },
            },
          },
        },
        package: { include: { class: true } },
        config: true,
      },
      orderBy,
    });
  }
}
