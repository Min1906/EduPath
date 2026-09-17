import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { parseWorkbook, workbookBuffer } from '../common/excel';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller()
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('users')
  async list(
    @Query('search') search = '',
    @Query('sortBy') sortBy = 'name',
    @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'asc',
    @Query('academicYearId') academicYearId?: string,
  ) {
    let orderBy: any = { name: sortOrder };
    if (sortBy === 'originClass') {
      orderBy = { student: { originClass: { name: sortOrder } } };
    } else if (['name', 'username', 'role', 'isActive', 'createdAt'].includes(sortBy)) {
      orderBy = { [sortBy]: sortOrder };
    }

    const whereConditions: any[] = [];

    if (search) {
      whereConditions.push({
        OR: [
          { name: { contains: search } },
          { username: { contains: search } },
          { student: { originClass: { name: { contains: search } } } },
        ],
      });
    }

    if (academicYearId) {
      const yearIdNum = Number(academicYearId);
      whereConditions.push({
        OR: [
          { student: { academicYearId: yearIdNum } },
          { role: { not: UserRole.STUDENT } },
        ],
      });
    }

    const where = whereConditions.length > 0 ? { AND: whereConditions } : undefined;

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        teacherId: true,
        studentId: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            academicYearId: true,
            originClass: { select: { id: true, name: true } },
            placedClass: { select: { id: true, name: true } },
            preference: {
              select: {
                id: true,
                isLocked: true,
                confirmedAt: true,
                choices: { select: { id: true, priority: true } },
              },
            },
          },
        },
      },
      orderBy,
    });
  }

  @Post('users/admin')
  async createAdmin(
    @Body()
    body: {
      username: string;
      name: string;
      password: string;
      teacherId?: number;
    },
  ) {
    return this.prisma.user.create({
      data: {
        username: body.username,
        name: body.name,
        passwordHash: await hash(body.password, 12),
        role: UserRole.ADMIN,
        teacherId: body.teacherId,
        mustChangePassword: true,
      },
      select: { id: true, username: true, name: true, role: true },
    });
  }

  @Patch('users/:id/password')
  async reset(
    @Param('id') id: string,
    @Body() body: { password: string; mustChangePassword?: boolean },
  ) {
    return this.prisma.user.update({
      where: { id: Number(id) },
      data: {
        passwordHash: await hash(body.password, 12),
        mustChangePassword: body.mustChangePassword ?? true,
      },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        mustChangePassword: true,
      },
    });
  }

  @Patch('users/:id/status')
  status(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.prisma.user.update({
      where: { id: Number(id) },
      data: { isActive: body.isActive },
      select: { id: true, username: true, name: true, isActive: true },
    });
  }

  @Get('teachers')
  teachers(@Query('search') search = '') {
    return this.prisma.teacher.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search } },
              { employeeNo: { contains: search } },
            ],
          }
        : undefined,
      include: {
        user: { select: { id: true, username: true, role: true, isActive: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Get('teachers/template')
  template(@Res() res: Response) {
    const b = workbookBuffer('Guru', [
      {
        'NIP/NIK': '19880001',
        Nama: 'Guru BK',
        'Mata Pelajaran': 'Bimbingan Konseling',
        Email: 'bk@sekolah.sch.id',
        'No HP': '081234567890',
        'Buat Akun Admin': 'YA',
        Username: 'guru.bk',
        Password: 'GuruBK123!',
      },
    ]);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="template-import-guru.xlsx"',
    );
    res
      .type(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .send(b);
  }

  @Post('teachers/import')
  @UseInterceptors(FileInterceptor('file'))
  async importTeachers(@UploadedFile() file: Express.Multer.File) {
    const rows = parseWorkbook(file);
    let success = 0;
    const errors: any[] = [];

    // ── Pre-hash unique passwords (bcrypt is expensive!) ─────────────
    const passwordHashCache = new Map<string, string>();
    const uniquePasswords = new Set<string>();
    for (const row of rows) {
      const createAdmin = String(row['Buat Akun Admin'] ?? row.Admin ?? row.isAdmin ?? '').toUpperCase();
      if (['YA', 'YES', '1', 'TRUE'].includes(createAdmin)) {
        const pwd = String(row.Password ?? row.password ?? 'GuruBK123!').trim();
        uniquePasswords.add(pwd);
      }
    }
    await Promise.all(
      [...uniquePasswords].map(async (pwd) => {
        passwordHashCache.set(pwd, await hash(pwd, 10));
      }),
    );

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const name = String(row.Nama ?? row.nama ?? row['Nama Lengkap'] ?? '').trim();
        if (!name) throw new Error('Nama guru/staff wajib diisi');
        await this.prisma.$transaction(async (tx) => {
          const rawEmp = row['NIP/NIK'] ?? row.NIP ?? row.NIK ?? row.employeeNo ?? '';
          let emp = String(rawEmp).trim();
          if (/^\d+\.0+$/.test(emp)) emp = emp.split('.')[0];

          const teacher = emp
            ? await tx.teacher.upsert({
                where: { employeeNo: emp },
                update: {
                  name,
                  subjectText: String(row['Mata Pelajaran'] ?? row.Mapel ?? row.subjectText ?? '').trim(),
                  email: String(row.Email ?? row.email ?? '').trim(),
                  phone: String(row['No HP'] ?? row.phone ?? row.Telepon ?? '').trim(),
                },
                create: {
                  employeeNo: emp,
                  name,
                  subjectText: String(row['Mata Pelajaran'] ?? row.Mapel ?? row.subjectText ?? '').trim(),
                  email: String(row.Email ?? row.email ?? '').trim(),
                  phone: String(row['No HP'] ?? row.phone ?? row.Telepon ?? '').trim(),
                },
              })
            : await tx.teacher.create({
                data: {
                  name,
                  subjectText: String(row['Mata Pelajaran'] ?? row.Mapel ?? row.subjectText ?? '').trim(),
                  email: String(row.Email ?? row.email ?? '').trim(),
                  phone: String(row['No HP'] ?? row.phone ?? row.Telepon ?? '').trim(),
                },
              });

          const createAdmin = String(row['Buat Akun Admin'] ?? row.Admin ?? row.isAdmin ?? '').toUpperCase();
          if (['YA', 'YES', '1', 'TRUE'].includes(createAdmin)) {
            const username = String(row.Username ?? row.username ?? emp).trim();
            const password = String(row.Password ?? row.password ?? 'GuruBK123!').trim();
            if (!username) throw new Error('Username wajib diisi untuk akun admin');
            const passwordHash = passwordHashCache.get(password) ?? await hash(password, 10);
            await tx.user.upsert({
              where: { username },
              update: {
                name,
                passwordHash,
                role: UserRole.ADMIN,
                teacherId: teacher.id,
                isActive: true,
              },
              create: {
                username,
                name,
                passwordHash,
                role: UserRole.ADMIN,
                teacherId: teacher.id,
                mustChangePassword: true,
              },
            });
          }
        });
        success++;
      } catch (error) {
        errors.push({
          row: i + 2,
          message: error instanceof Error ? error.message : 'Gagal memproses data guru',
        });
      }
    }
    return {
      total: rows.length,
      success,
      failed: errors.length,
      errors,
      message: `${success} dari ${rows.length} data guru/staff berhasil dibaca dan ditambahkan ke database.`
    };
  }
}


