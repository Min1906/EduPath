import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';

const defaultTemplates = [
  { key: 'science-pure', title: 'Sains Murni', category: 'Mayoritas IPA', subjects: ['Matematika', 'Fisika', 'Biologi', 'Kimia'] },
  { key: 'science-tech', title: 'Sains Teknologi', category: 'Mayoritas IPA', subjects: ['Matematika', 'Fisika', 'Kimia', 'Informatika'] },
  { key: 'social-digital', title: 'Sosial Digital', category: 'Mayoritas IPS', subjects: ['Matematika', 'Sejarah', 'Geografi', 'Sosiologi', 'Informatika'] },
];

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('packages')
export class PackagesController {
  constructor(private prisma: PrismaService) {}

  private async activeYear() {
    let year = await this.prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!year) {
      year = await this.prisma.academicYear.findFirst({ orderBy: { createdAt: 'desc' } });
    }
    if (!year) {
      throw new BadRequestException('Tahun ajaran belum tersedia');
    }
    return year;
  }

  private async yearId() {
    return (await this.activeYear()).id;
  }

  private async getTemplatesList() {
    const year = await this.activeYear();
    const policy = (year.policy as any) ?? {};
    if (Array.isArray(policy.packageTemplates) && policy.packageTemplates.length > 0) {
      return policy.packageTemplates;
    }
    return defaultTemplates;
  }

  private async saveTemplatesList(templatesList: any[]) {
    const year = await this.activeYear();
    const policy = (year.policy as any) ?? {};
    policy.packageTemplates = templatesList;
    await this.prisma.academicYear.update({
      where: { id: year.id },
      data: { policy },
    });
    return templatesList;
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STUDENT)
  @Get()
  async list() {
    return this.prisma.classPackage.findMany({
      where: { academicYearId: await this.yearId() },
      include: {
        class: true,
        subjects: { include: { subject: true } },
        _count: { select: { choices: true } },
      },
      orderBy: { class: { name: 'asc' } },
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get('templates')
  async getTemplates() {
    return this.getTemplatesList();
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('templates')
  async createTemplate(@Body() body: { title: string; category?: string; subjects: string[] }) {
    if (!body.title?.trim() || !Array.isArray(body.subjects) || !body.subjects.length) {
      throw new BadRequestException('Judul template dan minimal 1 mata pelajaran wajib diisi');
    }
    const currentList = await this.getTemplatesList();
    const key = body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const newTemplate = {
      key,
      title: body.title.trim(),
      category: body.category || 'Mayoritas IPA',
      subjects: body.subjects.map((s) => String(s).trim()).filter(Boolean),
    };
    const updated = [...currentList, newTemplate];
    await this.saveTemplatesList(updated);
    return newTemplate;
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Put('templates/:key')
  @Patch('templates/:key')
  async updateTemplate(@Param('key') key: string, @Body() body: { title: string; category?: string; subjects: string[] }) {
    if (!body.title?.trim() || !Array.isArray(body.subjects) || !body.subjects.length) {
      throw new BadRequestException('Judul template dan minimal 1 mata pelajaran wajib diisi');
    }
    const currentList = [...(await this.getTemplatesList())];
    const index = currentList.findIndex((t: any) => t.key === key);
    if (index === -1) throw new BadRequestException('Template tidak ditemukan');
    currentList[index] = {
      ...currentList[index],
      title: body.title.trim(),
      category: body.category || currentList[index].category || 'Mayoritas IPA',
      subjects: body.subjects.map((s) => String(s).trim()).filter(Boolean),
    };
    await this.saveTemplatesList(currentList);
    return currentList[index];
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete('templates/:key')
  async deleteTemplate(@Param('key') key: string) {
    const currentList = await this.getTemplatesList();
    const filtered = currentList.filter((t: any) => t.key !== key);
    if (filtered.length === currentList.length) throw new BadRequestException('Template tidak ditemukan');
    await this.saveTemplatesList(filtered);
    return { deleted: true, message: 'Template berhasil dihapus' };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  async create(@Body() body: any) {
    const selected = (body.subjects ?? []).filter((item: any) => item.isSelection);
    const total = selected.reduce((sum: number, item: any) => sum + Number(item.selectionWeight), 0);
    if (!selected.length || Math.abs(total - 100) > 0.01) throw new Error('Total bobot mapel seleksi harus 100%');
    const academicYearId = await this.yearId();
    return this.prisma.$transaction(async (tx) => {
      const cls = await tx.schoolClass.create({
        data: {
          academicYearId,
          name: body.className,
          gradeLevel: 'XI',
          capacity: Number(body.capacity),
          category: body.category,
          isPackageClass: true,
        },
      });
      const pkg = await tx.classPackage.create({
        data: {
          academicYearId,
          classId: cls.id,
          title: body.title,
          description: body.description,
          capacity: Number(body.capacity),
          subjects: {
            create: body.subjects.map((item: any) => ({
              subjectId: Number(item.subjectId),
              isSelection: Boolean(item.isSelection),
              selectionWeight: Number(item.selectionWeight ?? 0),
            })),
          },
        },
      });
      await tx.classSubject.createMany({
        data: body.subjects.map((item: any) => ({ classId: cls.id, subjectId: Number(item.subjectId) })),
      });
      return tx.classPackage.findUnique({
        where: { id: pkg.id },
        include: { class: true, subjects: { include: { subject: true } } },
      });
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('from-template/:key')
  async fromTemplate(@Param('key') key: string, @Body() body: any) {
    const templates = await this.getTemplatesList();
    const template = templates.find((item: any) => item.key === key);
    if (!template) throw new BadRequestException('Template tidak ditemukan');
    const subjects = await this.prisma.subject.findMany({ where: { name: { in: template.subjects } } });
    if (!subjects.length) throw new BadRequestException('Mata pelajaran template belum terdaftar dalam sistem');
    const weight = subjects.length ? 100 / subjects.length : 0;
    return this.create({
      className: body.className,
      title: template.title,
      capacity: body.capacity ?? 36,
      category: template.category,
      description: body.description ?? template.title,
      subjects: subjects.map((subject) => ({ subjectId: subject.id, isSelection: true, selectionWeight: weight })),
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    if (body.subjects) {
      const selected = body.subjects.filter((item: any) => item.isSelection);
      const total = selected.reduce((sum: number, item: any) => sum + Number(item.selectionWeight), 0);
      if (!selected.length || Math.abs(total - 100) > 0.01) throw new Error('Total bobot harus 100%');
    }
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.classPackage.findUniqueOrThrow({ where: { id: Number(id) } });
      if (body.subjects) {
        await tx.packageSubject.deleteMany({ where: { packageId: pkg.id } });
        await tx.classSubject.deleteMany({ where: { classId: pkg.classId } });
        await tx.packageSubject.createMany({
          data: body.subjects.map((item: any) => ({
            packageId: pkg.id,
            subjectId: Number(item.subjectId),
            isSelection: Boolean(item.isSelection),
            selectionWeight: Number(item.selectionWeight ?? 0),
          })),
        });
        await tx.classSubject.createMany({
          data: body.subjects.map((item: any) => ({ classId: pkg.classId, subjectId: Number(item.subjectId) })),
        });
      }
      await tx.schoolClass.update({
        where: { id: pkg.classId },
        data: { name: body.className, capacity: body.capacity, category: body.category },
      });
      return tx.classPackage.update({
        where: { id: pkg.id },
        data: { title: body.title, description: body.description, capacity: body.capacity },
        include: { class: true, subjects: { include: { subject: true } } },
      });
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const pkg = await this.prisma.classPackage.findUniqueOrThrow({
      where: { id: Number(id) },
      include: {
        _count: { select: { choices: true, scores: true } },
        class: { include: { _count: { select: { placedStudents: true } } } },
      },
    });
    if (pkg._count.choices + pkg._count.scores + pkg.class._count.placedStudents > 0) {
      return { deleted: false, message: 'Paket sudah digunakan' };
    }
    await this.prisma.schoolClass.delete({ where: { id: pkg.classId } });
    return { deleted: true };
  }
}
