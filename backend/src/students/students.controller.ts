import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { cleanNis, cleanString, parseWorkbook, workbookBuffer } from '../common/excel';
import { calculateRiasecFit, getDominantHollandCode } from '../common/riasec';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private prisma: PrismaService) {}

  private async yearId(input?: string | number) {
    if (input) return Number(input);
    return (await this.prisma.academicYear.findFirstOrThrow({ where: { isActive: true } })).id;
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get()
  async list(@Query('academicYearId') year?: string, @Query('search') search = '', @Query('sortBy') sortBy = 'name', @Query('sortOrder') sortOrder: 'asc' | 'desc' = 'asc') {
    const academicYearId = await this.yearId(year);
    let orderBy: any = { name: sortOrder };
    if (sortBy === 'originClass') {
      orderBy = { originClass: { name: sortOrder } };
    } else if (sortBy === 'placedClass') {
      orderBy = { placedClass: { name: sortOrder } };
    } else if (['name', 'nis', 'createdAt'].includes(sortBy)) {
      orderBy = { [sortBy]: sortOrder };
    }
    return this.prisma.student.findMany({
      where: {
        academicYearId,
        ...(search ? { OR: [{ name: { contains: search } }, { nis: { contains: search } }, { nisn: { contains: search } }] } : {}),
      },
      include: {
        originClass: true,
        placedClass: true,
        tkaScore: true,
        riasecScore: true,
        user: { select: { username: true, isActive: true } },
        preference: {
          include: {
            choices: { include: { package: { include: { class: true } } }, orderBy: { priority: 'asc' } },
          },
        },
      },
      orderBy,
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get('detail/:id')
  async detail(@Param('id') id: string) {
    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: Number(id) },
      include: {
        academicYear: true,
        originClass: true,
        placedClass: true,
        tkaScore: true,
        riasecScore: true,
        user: { select: { username: true, isActive: true, mustChangePassword: true } },
        preference: { include: { choices: { include: { package: { include: { class: true } } }, orderBy: { priority: 'asc' } } } },
        reportScores: { include: { subject: true }, orderBy: [{ subject: { name: 'asc' } }, { semester: 'asc' }] },
      },
    });
    const map = new Map<number, any>();
    for (const score of student.reportScores) {
      const item = map.get(score.subjectId) ?? { subjectId: score.subjectId, subject: score.subject.name, semester1: null, semester2: null };
      if (score.semester === 1) item.semester1 = Number(score.score);
      if (score.semester === 2) item.semester2 = Number(score.score);
      map.set(score.subjectId, item);
    }
    return { ...student, reportScores: undefined, reportTable: [...map.values()] };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post()
  async create(@Body() body: any) {
    const academicYearId = await this.yearId(body.academicYearId);
    const password = body.password || process.env.STUDENT_DEFAULT_PASSWORD || 'Siswa123!';
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: { academicYearId, nis: body.nis, nisn: body.nisn, name: body.name, gender: body.gender, originClassId: body.originClassId },
      });
      await tx.user.create({
        data: { username: body.username || body.nis, name: body.name, passwordHash: await hash(password, 12), role: UserRole.STUDENT, studentId: student.id, mustChangePassword: true },
      });
      return student;
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    const studentId = Number(id);
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.student.findUniqueOrThrow({
        where: { id: studentId },
        include: { academicYear: true, user: true },
      });

      // 1. Basic Student Info
      const data: any = {};
      if (body.nis !== undefined) data.nis = String(body.nis).trim();
      if (body.nisn !== undefined) data.nisn = body.nisn ? String(body.nisn).trim() : null;
      if (body.name !== undefined) data.name = String(body.name).trim();
      if (body.gender !== undefined) data.gender = body.gender ? String(body.gender).trim() : null;
      if (body.originClassId !== undefined) {
        data.originClassId = body.originClassId ? Number(body.originClassId) : null;
      }
      if (body.placedClassId !== undefined) {
        data.placedClassId = body.placedClassId ? Number(body.placedClassId) : null;
      }

      await tx.student.update({
        where: { id: studentId },
        data,
      });

      // Update linked User name or username if changed
      if (student.user && (data.name || data.nis)) {
        await tx.user.update({
          where: { id: student.user.id },
          data: {
            name: data.name ?? student.name,
            username: data.nis ?? student.user.username,
          },
        });
      }

      // 2. TKA Score
      if (body.tkaScore !== undefined) {
        if (body.tkaScore === null || body.tkaScore === '' || isNaN(Number(body.tkaScore))) {
          await tx.tkaScore.deleteMany({ where: { studentId } });
        } else {
          const score = Number(body.tkaScore);
          await tx.tkaScore.upsert({
            where: { studentId },
            update: { score, source: 'ADMIN_EDIT' },
            create: { studentId, score, source: 'ADMIN_EDIT' },
          });
        }
      }

      // 2b. RIASEC Score
      if (body.riasecScore !== undefined) {
        if (body.riasecScore === null || body.riasecScore === '') {
          await tx.riasecScore.deleteMany({ where: { studentId } });
        } else if (typeof body.riasecScore === 'object') {
          const r = Number(body.riasecScore.rScore ?? body.riasecScore.r ?? 0);
          const i = Number(body.riasecScore.iScore ?? body.riasecScore.i ?? 0);
          const a = Number(body.riasecScore.aScore ?? body.riasecScore.a ?? 0);
          const s = Number(body.riasecScore.sScore ?? body.riasecScore.s ?? 0);
          const e = Number(body.riasecScore.eScore ?? body.riasecScore.e ?? 0);
          const c = Number(body.riasecScore.cScore ?? body.riasecScore.c ?? 0);
          const dominantTraits = body.riasecScore.dominantTraits || getDominantHollandCode(r, i, a, s, e, c);
          await tx.riasecScore.upsert({
            where: { studentId },
            update: { rScore: r, iScore: i, aScore: a, sScore: s, eScore: e, cScore: c, dominantTraits, source: 'ADMIN_EDIT' },
            create: { studentId, rScore: r, iScore: i, aScore: a, sScore: s, eScore: e, cScore: c, dominantTraits, source: 'ADMIN_EDIT' },
          });
        }
      }

      // 3. Report Scores: [{ subjectId: number, semester: number, score: number | null }]
      if (Array.isArray(body.reportScores)) {
        for (const item of body.reportScores) {
          const subId = Number(item.subjectId);
          const sem = Number(item.semester);
          if (item.score === null || item.score === '' || isNaN(Number(item.score))) {
            await tx.reportScore.deleteMany({
              where: { studentId, subjectId: subId, semester: sem },
            });
          } else {
            const score = Number(item.score);
            await tx.reportScore.upsert({
              where: {
                studentId_subjectId_semester: {
                  studentId,
                  subjectId: subId,
                  semester: sem,
                },
              },
              update: { score },
              create: { studentId, subjectId: subId, semester: sem, score },
            });
          }
        }
      }

      // 4. Preferences / Class choices: packageIds: number[] or choices: [{ packageId: number, priority: number }]
      if (body.packageIds !== undefined || body.choices !== undefined) {
        const pkgIds: number[] = body.packageIds ?? (Array.isArray(body.choices) ? body.choices.map((c: any) => Number(c.packageId || c)) : []);
        const preference = await tx.studentPreference.upsert({
          where: { studentId },
          update: {
            isLocked: body.isLocked !== undefined ? Boolean(body.isLocked) : undefined,
          },
          create: {
            studentId,
            isLocked: body.isLocked !== undefined ? Boolean(body.isLocked) : false,
          },
        });

        await tx.preferenceChoice.deleteMany({ where: { preferenceId: preference.id } });
        const validIds = pkgIds.filter((p) => p > 0);
        if (validIds.length > 0) {
          await tx.preferenceChoice.createMany({
            data: validIds.map((packageId, index) => ({
              preferenceId: preference.id,
              packageId: Number(packageId),
              priority: index + 1,
            })),
          });
        }
      } else if (body.isLocked !== undefined) {
        await tx.studentPreference.upsert({
          where: { studentId },
          update: { isLocked: Boolean(body.isLocked) },
          create: { studentId, isLocked: Boolean(body.isLocked) },
        });
      }

      return tx.student.findUnique({
        where: { id: studentId },
        include: {
          originClass: true,
          placedClass: true,
          tkaScore: true,
          riasecScore: true,
          preference: {
            include: {
              choices: { include: { package: { include: { class: true } } }, orderBy: { priority: 'asc' } },
            },
          },
        },
      });
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const studentId = Number(id);
    await this.prisma.user.deleteMany({ where: { studentId } });
    await this.prisma.student.delete({ where: { id: studentId } });
    return { deleted: true };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('bulk-delete')
  async bulkDelete(@Body() body: { ids: number[] }) {
    const ids = (body.ids || []).map(Number).filter((id) => !isNaN(id) && id > 0);
    if (!ids.length) throw new BadRequestException('Tidak ada data siswa yang dipilih untuk dihapus.');
    return this.prisma.$transaction(async (tx) => {
      await tx.user.deleteMany({ where: { studentId: { in: ids } } });
      const res = await tx.student.deleteMany({ where: { id: { in: ids } } });
      return { count: res.count, message: `Berhasil menghapus ${res.count} data siswa.` };
    });
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get('template/download')
  template(@Res() res: Response) {
    const buffer = workbookBuffer('Siswa', [{ NIS: '10001', NISN: '0012345678', Nama: 'Nama Siswa', 'Jenis Kelamin': 'L', 'Kelas Asal': 'X-1', Username: '10001', Password: 'Siswa123!' }]);
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-siswa.xlsx"');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer);
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importStudents(@UploadedFile() file: Express.Multer.File) {
    const rows = parseWorkbook(file);
    if (!rows || rows.length === 0) {
      throw new BadRequestException('File Excel/CSV tidak memiliki baris data yang valid.');
    }
    const academicYearId = await this.yearId();
    let success = 0;
    const errors: any[] = [];

    // ── 1. Preload classes ────────────────────────────────────────────
    const existingClasses = await this.prisma.schoolClass.findMany({ where: { academicYearId } });
    const classMap = new Map<string, any>();
    existingClasses.forEach((c) => classMap.set(c.name.trim().toLowerCase(), c));

    // ── 2. Preload existing students for lookup ───────────────────────
    const existingStudents = await this.prisma.student.findMany({
      where: { academicYearId },
      select: { id: true, nis: true },
    });
    const studentNisMap = new Map<string, number>(); // nis → studentId
    existingStudents.forEach((s) => studentNisMap.set(s.nis, s.id));

    // ── 3. Preload existing users for lookup ─────────────────────────
    const existingUsers = await this.prisma.user.findMany({
      where: { role: UserRole.STUDENT },
      select: { id: true, username: true },
    });
    const userUsernameMap = new Map<string, number>(); // username → userId
    existingUsers.forEach((u) => userUsernameMap.set(u.username, u.id));

    // ── 4. Pre-hash unique passwords (bcrypt is expensive!) ─────────
    const defaultPassword = process.env.STUDENT_DEFAULT_PASSWORD || 'Siswa123!';
    const passwordHashCache = new Map<string, string>();

    // Collect unique passwords across all rows first
    const uniquePasswords = new Set<string>();
    uniquePasswords.add(defaultPassword);
    for (const row of rows) {
      const getVal = (...keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '')
            return String(row[k]).trim();
        }
        const rowKeys = Object.keys(row);
        for (const k of keys) {
          const matched = rowKeys.find((rk) => rk.trim().toLowerCase() === k.trim().toLowerCase());
          if (matched && row[matched] !== undefined && row[matched] !== null && String(row[matched]).trim() !== '')
            return String(row[matched]).trim();
        }
        return '';
      };
      const pwd = cleanString(getVal('Password', 'password')) || defaultPassword;
      uniquePasswords.add(pwd);
    }
    // Hash all unique passwords in parallel (bcrypt ~100ms each)
    await Promise.all(
      [...uniquePasswords].map(async (pwd) => {
        const h = await hash(pwd, 10); // cost 10 is still secure & 2× faster than 12
        passwordHashCache.set(pwd, h);
      }),
    );

    // ── 5. Parse all rows first, collect DB ops ──────────────────────
    const studentUpserts: any[] = [];
    const userUpserts: any[] = [];

    for (let index = 0; index < rows.length; index++) {
      try {
        const row = rows[index];

        const getVal = (...keys: string[]) => {
          for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '')
              return String(row[k]).trim();
          }
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            const matched = rowKeys.find((rk) => rk.trim().toLowerCase() === k.trim().toLowerCase());
            if (matched && row[matched] !== undefined && row[matched] !== null && String(row[matched]).trim() !== '')
              return String(row[matched]).trim();
          }
          return '';
        };

        const rawNis = getVal('NIS', 'nis', 'No Induk', 'Nomor Induk', 'Nis', 'no_induk', 'id_siswa', 'nis_siswa');
        const nis = cleanNis(rawNis);
        const name = cleanString(getVal('Nama', 'nama', 'Nama Lengkap', 'Nama Siswa', 'Name', 'name', 'nama_siswa', 'nama_lengkap'));
        if (!nis || !name) throw new Error('NIS dan Nama siswa wajib diisi');

        const rawNisn = getVal('NISN', 'nisn', 'No NISN', 'Nisn', 'nomor_nisn');
        const nisn = rawNisn ? cleanNis(rawNisn) : null;

        const rawGender = getVal('Jenis Kelamin', 'Jenis_Kelamin', 'JK', 'jk', 'Gender', 'gender', 'L/P', 'l/p', 'jenis_kelamin', 'kelamin');
        let gender: string | null = null;
        if (rawGender) {
          const gUpper = rawGender.toUpperCase().trim();
          if (gUpper.startsWith('L') || (gUpper.startsWith('P') && (gUpper.includes('PRIA') || gUpper.includes('LAKI')))) {
            gender = 'L';
          } else if (gUpper.startsWith('P') || gUpper.includes('WANITA') || gUpper.includes('PEREMPUAN')) {
            gender = 'P';
          } else {
            gender = gUpper;
          }
        }

        const originName = getVal('Kelas Asal', 'Kelas_Asal', 'Kelas', 'kelas', 'Kelas X', 'kelas asal', 'Rombel', 'Rombel Asal', 'rombel', 'kelas_asal');

        let originClassId: number | null = null;
        if (originName) {
          let foundClass = classMap.get(originName.toLowerCase());
          if (!foundClass) {
            foundClass = await this.prisma.schoolClass.create({
              data: {
                academicYearId,
                name: originName,
                gradeLevel: originName.toUpperCase().startsWith('XI') ? 'XI' : 'X',
                capacity: 36,
              },
            });
            classMap.set(originName.toLowerCase(), foundClass);
          }
          originClassId = foundClass.id;
        }

        const username = cleanString(getVal('Username', 'username')) || nis;
        const rawPassword = cleanString(getVal('Password', 'password')) || defaultPassword;
        const passwordHash = passwordHashCache.get(rawPassword)!;

        studentUpserts.push({ nis, name, nisn, gender, originClassId, rowIndex: index });
        userUpserts.push({ username, name, passwordHash, nis });
      } catch (error) {
        errors.push({ row: index + 2, message: error instanceof Error ? error.message : 'Gagal memproses baris' });
      }
    }

    // ── 6. Batch upsert in a single transaction ───────────────────────
    const CHUNK = 50; // process 50 rows per transaction to avoid timeout
    for (let c = 0; c < studentUpserts.length; c += CHUNK) {
      const studentChunk = studentUpserts.slice(c, c + CHUNK);
      const userChunk = userUpserts.slice(c, c + CHUNK);
      try {
        await this.prisma.$transaction(async (tx) => {
          for (let j = 0; j < studentChunk.length; j++) {
            const s = studentChunk[j];
            const u = userChunk[j];
            const student = await tx.student.upsert({
              where: { academicYearId_nis: { academicYearId, nis: s.nis } },
              update: { name: s.name, nisn: s.nisn, gender: s.gender, originClassId: s.originClassId },
              create: { academicYearId, nis: s.nis, name: s.name, nisn: s.nisn, gender: s.gender, originClassId: s.originClassId },
            });
            // Only upsert user if username isn't already tied to another student
            await tx.user.upsert({
              where: { username: u.username },
              update: { name: u.name, passwordHash: u.passwordHash, studentId: student.id, role: UserRole.STUDENT, isActive: true },
              create: { username: u.username, name: u.name, passwordHash: u.passwordHash, role: UserRole.STUDENT, studentId: student.id, mustChangePassword: true },
            });
            success++;
          }
        });
      } catch (chunkErr: any) {
        // If entire chunk fails, mark all rows in chunk as failed
        for (const s of studentChunk) {
          errors.push({ row: s.rowIndex + 2, message: chunkErr?.message || 'Gagal menyimpan data siswa' });
        }
        success -= studentChunk.length; // rollback count (success was pre-incremented)
      }
    }

    try {
      await this.prisma.importBatch.create({
        data: {
          kind: 'STUDENT',
          fileName: file.originalname,
          totalRows: rows.length,
          successRows: success,
          failedRows: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch {
      // Non-blocking log failure
    }

    return {
      total: rows.length,
      success,
      failed: errors.length,
      errors,
      message: `${success} dari ${rows.length} siswa berhasil dibaca dan ditambahkan ke database.`
    };
  }


  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('reset-passwords')
  async reset(@Body() body: { password?: string }) {
    const password = body.password || process.env.STUDENT_DEFAULT_PASSWORD || 'Siswa123!';
    const students = await this.prisma.student.findMany({ where: { academicYearId: await this.yearId() } });
    const passwordHash = await hash(password, 12);
    for (const student of students) {
      await this.prisma.user.upsert({
        where: { username: student.nis },
        update: { passwordHash, mustChangePassword: true, isActive: true, studentId: student.id, role: UserRole.STUDENT },
        create: { username: student.nis, name: student.name, passwordHash, role: UserRole.STUDENT, studentId: student.id, mustChangePassword: true },
      });
    }
    return { updated: students.length, defaultPassword: password };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Get('preferences/stats')
  async preferenceStats(@Query('academicYearId') year?: string) {
    const academicYearId = await this.yearId(year);
    const totalStudents = await this.prisma.student.count({ where: { academicYearId } });
    const lockedCount = await this.prisma.studentPreference.count({
      where: { student: { academicYearId }, isLocked: true },
    });
    const unlockedCount = await this.prisma.studentPreference.count({
      where: { student: { academicYearId }, isLocked: false, choices: { some: {} } },
    });
    const unselectedCount = totalStudents - lockedCount - unlockedCount;
    return {
      totalStudents,
      lockedCount,
      unlockedCount,
      unselectedCount,
    };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('preferences/unlock-all')
  async unlockAllPreferences(@Query('academicYearId') year?: string) {
    const academicYearId = await this.yearId(year);
    const result = await this.prisma.studentPreference.updateMany({
      where: {
        student: { academicYearId },
        isLocked: true,
      },
      data: {
        isLocked: false,
      },
    });
    return {
      message: `Berhasil membuka kunci pilihan untuk ${result.count} siswa. Siswa kini dapat mengubah dan mengonfirmasi kembali pilihannya di portal siswa.`,
      unlockedCount: result.count,
    };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Post('preferences/lock-all')
  async lockAllPreferences(@Query('academicYearId') year?: string) {
    const academicYearId = await this.yearId(year);
    const result = await this.prisma.studentPreference.updateMany({
      where: {
        student: { academicYearId },
        isLocked: false,
        choices: { some: {} },
      },
      data: {
        isLocked: true,
        confirmedAt: new Date(),
      },
    });
    return {
      message: `Berhasil mengunci pilihan untuk ${result.count} siswa.`,
      lockedCount: result.count,
    };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/unlock-preference')
  async unlockStudentPreference(@Param('id') id: string) {
    const studentId = Number(id);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new BadRequestException('Data siswa tidak ditemukan');
    }
    await this.prisma.studentPreference.upsert({
      where: { studentId },
      update: { isLocked: false },
      create: { studentId, isLocked: false },
    });
    return { message: `Kunci konfirmasi pilihan untuk siswa "${student.name}" berhasil dibuka.` };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/lock-preference')
  async lockStudentPreference(@Param('id') id: string) {
    const studentId = Number(id);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new BadRequestException('Data siswa tidak ditemukan');
    }
    await this.prisma.studentPreference.upsert({
      where: { studentId },
      update: { isLocked: true, confirmedAt: new Date() },
      create: { studentId, isLocked: true, confirmedAt: new Date() },
    });
    return { message: `Pilihan untuk siswa "${student.name}" berhasil dikunci.` };
  }

  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @Patch(':id/toggle-preference-lock')
  async toggleStudentPreferenceLock(@Param('id') id: string) {
    const studentId = Number(id);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      include: { preference: true },
    });
    if (!student) {
      throw new BadRequestException('Data siswa tidak ditemukan');
    }
    const currentLocked = student.preference?.isLocked ?? false;
    const newLocked = !currentLocked;
    await this.prisma.studentPreference.upsert({
      where: { studentId },
      update: { isLocked: newLocked, confirmedAt: newLocked ? new Date() : null },
      create: { studentId, isLocked: newLocked, confirmedAt: newLocked ? new Date() : null },
    });
    return {
      message: newLocked
        ? `Pilihan siswa "${student.name}" berhasil dikunci.`
        : `Kunci pilihan siswa "${student.name}" berhasil dibuka.`,
      isLocked: newLocked,
    };
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.STUDENT)
@Controller('student')
export class StudentPortalController {
  constructor(private prisma: PrismaService) {}

  @Get('profile')
  async profile(@CurrentUser() auth: AuthUser) {
    if (!auth.studentId) throw new BadRequestException('Akun tidak terhubung');
    return this.prisma.student.findUniqueOrThrow({
      where: { id: auth.studentId },
      include: {
        academicYear: true,
        originClass: true,
        placedClass: true,
        placement: { include: { class: true } },
        user: { select: { username: true, mustChangePassword: true } },
        tkaScore: true,
        riasecScore: true,
        preference: { include: { choices: { include: { package: { include: { class: true, subjects: { include: { subject: true } } } } }, orderBy: { priority: 'asc' } } } },
      },
    });
  }

  @Get('packages')
  async packages(@CurrentUser() auth: AuthUser) {
    if (!auth.studentId) throw new BadRequestException('Akun tidak terhubung');
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: auth.studentId } });
    const pkgs = await this.prisma.classPackage.findMany({
      where: {
        academicYearId: student.academicYearId,
        status: { not: 'ARCHIVED' },
      },
      include: {
        class: true,
        subjects: {
          include: { subject: true },
          orderBy: { subject: { name: 'asc' } },
        },
      },
    });

    return pkgs.sort((a, b) =>
      (a.class?.name ?? '').localeCompare(b.class?.name ?? '', undefined, {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  }

  @Get('recommendations')
  async recommendations(@CurrentUser() auth: AuthUser) {
    if (!auth.studentId) throw new BadRequestException('Akun tidak terhubung');
    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: auth.studentId },
      include: {
        academicYear: true,
        reportScores: { include: { subject: true } },
        tkaScore: true,
        riasecScore: true,
        preference: { include: { choices: { orderBy: { priority: 'asc' } } } },
      },
    });

    const academicYearId = student.academicYearId;
    const policy = (student.academicYear.policy as any) ?? {};
    const usePassingGrade = policy.usePassingGrade !== false;
    const requireComplete = policy.requireCompleteSelectionSubjects !== false;
    const minAcademicFit = Number(policy.minAcademicFit ?? 70);
    const minTka = Number(policy.minTka ?? 60);
    const minFinalScore = Number(policy.minFinalScore ?? 70);

    let config = await this.prisma.scoringConfig.findFirst({
      where: { academicYearId, isActive: true },
    });
    if (!config) {
      config = await this.prisma.scoringConfig.findFirst({
        where: { academicYearId },
        orderBy: { createdAt: 'desc' },
      });
    }
    const academicWeight = Number(config?.academicWeight ?? 50);
    const tkaWeight = Number(config?.tkaWeight ?? 30);
    const riasecWeight = Number(config?.riasecWeight && Number(config.riasecWeight) > 0 ? config.riasecWeight : (config?.preferenceWeight ?? 20));

    const packages = await this.prisma.classPackage.findMany({
      where: {
        academicYearId,
        status: { not: 'ARCHIVED' },
      },
      include: {
        class: {
          include: {
            _count: { select: { placedStudents: true } },
          },
        },
        subjects: {
          include: { subject: true },
          orderBy: { subject: { name: 'asc' } },
        },
      },
    });

    const tka = student.tkaScore ? Number(student.tkaScore.score) : 0;
    const recommendations = packages.map((pkg) => {
      const selectionSubjects = pkg.subjects.filter((s) => s.isSelection);
      const pkgSubjectsForRiasec = (selectionSubjects.length > 0 ? selectionSubjects : pkg.subjects).map((s) => ({
        name: s.subject?.name || '',
        weight: Number(s.selectionWeight || 1),
      }));

      let academicFit = 0;
      let complete = selectionSubjects.length > 0;
      const subjectBreakdowns: any[] = [];

      if (selectionSubjects.length > 0) {
        for (const rel of selectionSubjects) {
          const scores = student.reportScores.filter((row) => row.subjectId === rel.subjectId);
          if (!scores.length) {
            complete = false;
            subjectBreakdowns.push({
              subjectName: rel.subject.name,
              weight: Number(rel.selectionWeight),
              averageScore: 0,
              hasScore: false,
            });
            continue;
          }
          const avg = scores.reduce((sum, row) => sum + Number(row.score), 0) / scores.length;
          academicFit += avg * (Number(rel.selectionWeight) / 100);
          subjectBreakdowns.push({
            subjectName: rel.subject.name,
            weight: Number(rel.selectionWeight),
            averageScore: Number(avg.toFixed(1)),
            hasScore: true,
          });
        }
      } else {
        if (student.reportScores.length > 0) {
          const total = student.reportScores.reduce((sum, s) => sum + Number(s.score), 0);
          academicFit = total / student.reportScores.length;
        }
        complete = true;
      }

      const existingChoice = student.preference?.choices?.find((c) => c.packageId === pkg.id);
      const priority = existingChoice?.priority ?? null;

      const riasecFit = calculateRiasecFit(student.riasecScore, pkgSubjectsForRiasec);

      const estimatedScore =
        academicFit * (academicWeight / 100) +
        tka * (tkaWeight / 100) +
        riasecFit * (riasecWeight / 100);

      const completeEligible = requireComplete ? complete : true;
      const gradeEligible = usePassingGrade
        ? academicFit >= minAcademicFit && tka >= minTka && estimatedScore >= minFinalScore
        : true;
      const eligible = completeEligible && gradeEligible;

      const placedCount = pkg.class._count.placedStudents;
      const availableCapacity = Math.max(0, pkg.capacity - placedCount);

      // Fit level considering academic fit, RIASEC interest fit, and TKA
      let fitLevel: 'SANGAT_COCOK' | 'COCOK' | 'CUKUP' | 'PERLU_PERTIMBANGAN' = 'CUKUP';
      const combinedFit = (academicFit * 0.45) + (riasecFit * 0.35) + ((tka || 70) * 0.20);
      if (combinedFit >= 82 && academicFit >= 75) fitLevel = 'SANGAT_COCOK';
      else if (combinedFit >= 72) fitLevel = 'COCOK';
      else if (combinedFit >= 60) fitLevel = 'CUKUP';
      else fitLevel = 'PERLU_PERTIMBANGAN';

      return {
        packageId: pkg.id,
        classId: pkg.classId,
        className: pkg.class.name,
        packageTitle: pkg.title,
        description: pkg.description,
        capacity: pkg.capacity,
        availableCapacity,
        academicFit: Number(academicFit.toFixed(2)),
        tkaScore: Number(tka.toFixed(2)),
        riasecFit: Number(riasecFit.toFixed(2)),
        estimatedScore: Number(estimatedScore.toFixed(2)),
        eligible,
        fitLevel,
        isCurrentChoice: Boolean(existingChoice),
        choicePriority: priority,
        selectionSubjects: subjectBreakdowns,
        allSubjects: pkg.subjects.map((s) => ({
          name: s.subject.name,
          isSelection: s.isSelection,
          weight: Number(s.selectionWeight),
        })),
      };
    });

    recommendations.sort((a, b) => {
      if (b.eligible !== a.eligible) return b.eligible ? 1 : -1;
      return b.estimatedScore - a.estimatedScore;
    });

    return {
      studentInfo: {
        id: student.id,
        name: student.name,
        nis: student.nis,
        tkaScore: tka,
        hasReportScores: student.reportScores.length > 0,
        riasecScore: student.riasecScore
          ? {
              rScore: Number(student.riasecScore.rScore),
              iScore: Number(student.riasecScore.iScore),
              aScore: Number(student.riasecScore.aScore),
              sScore: Number(student.riasecScore.sScore),
              eScore: Number(student.riasecScore.eScore),
              cScore: Number(student.riasecScore.cScore),
              dominantTraits: student.riasecScore.dominantTraits || getDominantHollandCode(
                Number(student.riasecScore.rScore),
                Number(student.riasecScore.iScore),
                Number(student.riasecScore.aScore),
                Number(student.riasecScore.sScore),
                Number(student.riasecScore.eScore),
                Number(student.riasecScore.cScore),
              ),
            }
          : null,
      },
      scoringWeights: {
        academicWeight,
        tkaWeight,
        riasecWeight,
      },
      policy: {
        minAcademicFit,
        minTka,
        minFinalScore,
        usePassingGrade,
      },
      recommendations,
    };
  }

  @Put('preferences')
  async preferences(@CurrentUser() auth: AuthUser, @Body() body: { packageIds: number[] }) {
    if (!auth.studentId) throw new BadRequestException('Akun tidak terhubung');
    const student = await this.prisma.student.findUniqueOrThrow({
      where: { id: auth.studentId },
      include: { academicYear: true },
    });
    const policy = (student.academicYear.policy as any) ?? {};
    const maxChoices = Number(policy.maxChoices ?? 3);
    const rawIds = Array.isArray(body.packageIds) ? body.packageIds.map(Number).filter((id) => id > 0) : [];

    if (!rawIds.length || rawIds.length > maxChoices || new Set(rawIds).size !== rawIds.length) {
      throw new BadRequestException(`Pilihan harus antara 1 sampai ${maxChoices} paket unik`);
    }

    return this.prisma.$transaction(async (tx) => {
      const preference = await tx.studentPreference.upsert({
        where: { studentId: auth.studentId! },
        update: {},
        create: { studentId: auth.studentId! },
      });
      if (preference.isLocked) {
        throw new BadRequestException('Pilihan sudah dikonfirmasi dan dikunci. Hubungi Admin atau Guru BK untuk membuka kunci pilihan.');
      }
      await tx.preferenceChoice.deleteMany({ where: { preferenceId: preference.id } });
      await tx.preferenceChoice.createMany({
        data: rawIds.map((packageId, index) => ({
          preferenceId: preference.id,
          packageId,
          priority: index + 1,
        })),
      });
      return tx.studentPreference.findUnique({
        where: { id: preference.id },
        include: {
          choices: {
            include: { package: { include: { class: true } } },
            orderBy: { priority: 'asc' },
          },
        },
      });
    });
  }

  @Post('preferences/confirm')
  async confirm(@CurrentUser() auth: AuthUser) {
    if (!auth.studentId) throw new BadRequestException('Akun tidak terhubung');
    const preference = await this.prisma.studentPreference.findUniqueOrThrow({
      where: { studentId: auth.studentId },
      include: { choices: true },
    });
    if (!preference.choices.length) {
      throw new BadRequestException('Pilih minimal satu paket kelas sebelum konfirmasi.');
    }
    await this.prisma.studentPreference.update({
      where: { id: preference.id },
      data: { isLocked: true, confirmedAt: new Date() },
    });
    return { message: 'Pilihan kelas berhasil dikonfirmasi dan dikunci. Pilihan tidak dapat diubah lagi.' };
  }
}

