import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subjects')
export class SubjectsController {
  constructor(private prisma: PrismaService) {}

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STUDENT)
  @Get()
  async list(
    @Query('search') search = '',
    @Query('academicYearId') yearId?: string,
  ) {
    const subjects = await this.prisma.subject.findMany({
      where: search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : undefined,
      include: {
        _count: {
          select: { reportScores: true, classSubjects: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const scoreWhere: any = {};
    if (yearId && yearId !== 'ALL') {
      scoreWhere.student = { academicYearId: Number(yearId) };
    }

    const avgs = await this.prisma.reportScore.groupBy({
      by: ['subjectId'],
      where: Object.keys(scoreWhere).length > 0 ? scoreWhere : undefined,
      _avg: { score: true },
      _count: { score: true },
    });

    const avgMap = new Map(
      avgs.map((item) => [
        item.subjectId,
        {
          avgScore: item._avg.score !== null ? Number(item._avg.score) : null,
          count: item._count.score,
        },
      ]),
    );

    return subjects.map((sub) => {
      const stats = avgMap.get(sub.id);
      return {
        ...sub,
        avgScore: stats?.avgScore ?? null,
        scoreCount: stats?.count ?? 0,
      };
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  create(@Body() body: { code: string; name: string; groupName?: string }) {
    return this.prisma.subject.create({
      data: {
        code: body.code.trim().toUpperCase(),
        name: body.name.trim(),
        groupName: body.groupName ?? 'UMUM',
      },
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    const data: any = {};
    if (body.code !== undefined && body.code !== null) {
      data.code = String(body.code).trim().toUpperCase();
    }
    if (body.name !== undefined && body.name !== null) {
      data.name = String(body.name).trim();
    }
    if (body.groupName !== undefined && body.groupName !== null) {
      data.groupName = String(body.groupName).trim();
    }
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
    }
    return this.prisma.subject.update({
      where: { id: Number(id) },
      data,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const row = await this.prisma.subject.findUnique({
      where: { id: Number(id) },
      include: {
        _count: {
          select: { reportScores: true, classSubjects: true },
        },
      },
    });
    if (!row) return { deleted: false };
    if (row._count.reportScores + row._count.classSubjects > 0) {
      return this.prisma.subject.update({
        where: { id: row.id },
        data: { isActive: false },
      });
    }
    await this.prisma.subject.delete({ where: { id: row.id } });
    return { deleted: true };
  }
}
