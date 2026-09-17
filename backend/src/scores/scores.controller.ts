import { Controller, Get, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { cleanNis, cleanNumber, cleanString, parseWorkbook, workbookBuffer } from '../common/excel';

function calculateDominantTraits(r: number, i: number, a: number, s: number, e: number, c: number): string {
  const list = [
    { trait: 'R', score: r },
    { trait: 'I', score: i },
    { trait: 'A', score: a },
    { trait: 'S', score: s },
    { trait: 'E', score: e },
    { trait: 'C', score: c },
  ];
  list.sort((x, y) => y.score - x.score);
  return list.slice(0, 3).map((item) => item.trait).join('');
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('scores')
export class ScoresController {
  constructor(private prisma: PrismaService) {}

  private year() {
    return this.prisma.academicYear.findFirstOrThrow({ where: { isActive: true } });
  }

  private async state() {
    const y = await this.year();
    return { year: y, frozen: Boolean((y.policy as any)?.scoresFrozen) };
  }

  @Get('summary')
  async summary(@Query('search') search = '') {
    const y = await this.year();
    const students = await this.prisma.student.findMany({
      where: {
        academicYearId: y.id,
        ...(search ? { OR: [{ name: { contains: search } }, { nis: { contains: search } }] } : {}),
      },
      include: {
        reportScores: { include: { subject: true } },
        tkaScore: true,
        riasecScore: true,
        preference: {
          include: {
            choices: {
              include: { package: { include: { class: true } } },
              orderBy: { priority: 'asc' },
            },
          },
        },
        originClass: true,
      },
      orderBy: { name: 'asc' },
    });

    return students.map((s) => {
      const semesters = [1, 2].map((sem) => {
        const rows = s.reportScores.filter((r) => r.semester === sem);
        return rows.length ? rows.reduce((a, b) => a + Number(b.score), 0) / rows.length : null;
      });

      return {
        id: s.id,
        nis: s.nis,
        name: s.name,
        originClass: s.originClass?.name ?? '-',
        semester1: semesters[0],
        semester2: semesters[1],
        reportAverage: s.reportScores.length
          ? s.reportScores.reduce((a, b) => a + Number(b.score), 0) / s.reportScores.length
          : null,
        tka: s.tkaScore ? Number(s.tkaScore.score) : null,
        riasec: s.riasecScore
          ? {
              r: Number(s.riasecScore.rScore),
              i: Number(s.riasecScore.iScore),
              a: Number(s.riasecScore.aScore),
              s: Number(s.riasecScore.sScore),
              e: Number(s.riasecScore.eScore),
              c: Number(s.riasecScore.cScore),
              dominant: s.riasecScore.dominantTraits || calculateDominantTraits(
                Number(s.riasecScore.rScore),
                Number(s.riasecScore.iScore),
                Number(s.riasecScore.aScore),
                Number(s.riasecScore.sScore),
                Number(s.riasecScore.eScore),
                Number(s.riasecScore.cScore),
              ),
            }
          : null,
        choices:
          s.preference?.choices.map((c) => ({
            priority: c.priority,
            packageId: c.packageId,
            className: c.package.class.name,
          })) ?? [],
      };
    });
  }

  @Get('status')
  async status() {
    const s = await this.state();
    return { frozen: s.frozen, academicYearId: s.year.id };
  }

  @Post('freeze')
  async freeze() {
    const y = await this.year();
    await this.prisma.academicYear.update({
      where: { id: y.id },
      data: { policy: { ...(((y.policy as any) ?? {})), scoresFrozen: true, scoresFrozenAt: new Date().toISOString() } },
    });
    return { frozen: true };
  }

  @Post('unfreeze')
  async unfreeze() {
    const y = await this.year();
    await this.prisma.academicYear.update({
      where: { id: y.id },
      data: { policy: { ...(((y.policy as any) ?? {})), scoresFrozen: false } },
    });
    return { frozen: false };
  }

  @Get('report-template')
  async reportTemplate(@Res() res: Response) {
    const subjects = await this.prisma.subject.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
    const row: any = { NIS: '10001', Semester: 1 };
    for (const s of subjects) row[s.name] = 80;
    const b = workbookBuffer('Nilai Rapor', [row]);
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-rapor.xlsx"');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(b);
  }

  @Get('tka-template')
  tkaTemplate(@Res() res: Response) {
    const b = workbookBuffer('Nilai TKA', [{ NIS: '10001', 'Nilai TKA': 85 }]);
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-tka.xlsx"');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(b);
  }

  @Get('riasec-template')
  riasecTemplate(@Res() res: Response) {
    const sampleRows = [
      {
        NIS: '10001',
        'R (Realistic)': 85,
        'I (Investigative)': 90,
        'A (Artistic)': 65,
        'S (Social)': 70,
        'E (Enterprising)': 75,
        'C (Conventional)': 80,
      },
      {
        NIS: '10002',
        'R (Realistic)': 60,
        'I (Investigative)': 75,
        'A (Artistic)': 92,
        'S (Social)': 88,
        'E (Enterprising)': 70,
        'C (Conventional)': 65,
      },
    ];
    const b = workbookBuffer('Nilai RIASEC', sampleRows);
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-riasec.xlsx"');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(b);
  }

  @Post('import-report')
  @UseInterceptors(FileInterceptor('file'))
  async importReport(@UploadedFile() file: Express.Multer.File) {
    const st = await this.state();
    if (st.frozen) throw new BadRequestException('Data nilai sedang di-freeze (dikunci). Buka freeze terlebih dahulu.');
    const rows = parseWorkbook(file);
    if (!rows || rows.length === 0) {
      throw new BadRequestException('File Excel/CSV tidak memiliki baris data yang valid.');
    }

    // ── Preload subjects & students into Maps ─────────────────────────
    const subjects = await this.prisma.subject.findMany();
    const byName = new Map(subjects.map((s) => [s.name.toLowerCase().trim(), s]));
    const byCode = new Map(subjects.map((s) => [s.code.toLowerCase().trim(), s]));

    const allStudents = await this.prisma.student.findMany({
      where: { academicYearId: st.year.id },
      select: { id: true, nis: true },
    });
    const studentMap = new Map<string, number>(); // nis → studentId
    allStudents.forEach((s) => studentMap.set(s.nis, s.id));

    let success = 0;
    const errors: any[] = [];

    // ── Collect all upsert ops, then run in chunks ───────────────────
    type ScoreOp = { studentId: number; subjectId: number; semester: number; score: number };
    const ops: ScoreOp[] = [];
    const rowIndexMap: number[] = []; // which row each op came from

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

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

        const rawNis = getVal('NIS', 'nis', 'No Induk', 'Nomor Induk', 'Nis', 'no_induk', 'id_siswa');
        const nis = cleanNis(rawNis);
        if (!nis) throw new Error('NIS tidak boleh kosong');

        const rawSem = getVal('Semester', 'semester', 'Sem', 'sem', 'SMT', 'smt');
        let semester = cleanNumber(rawSem);
        if (semester === null) {
          if (rawSem.toLowerCase().includes('2') || rawSem.toLowerCase().includes('genap')) semester = 2;
          else if (rawSem.toLowerCase().includes('1') || rawSem.toLowerCase().includes('ganjil')) semester = 1;
        }
        if (!semester || ![1, 2].includes(semester))
          throw new Error(`Semester harus 1 atau 2 (ditemukan: "${rawSem || '-'}")`);

        const studentId = studentMap.get(nis);
        if (!studentId)
          throw new Error(`Siswa dengan NIS "${nis}" tidak ditemukan pada tahun ajaran aktif.`);

        for (const [key, value] of Object.entries(row)) {
          const lowerKey = key.toLowerCase().trim();
          if (['nis', 'semester', 'sem', 'smt', 'no', 'nama', 'nama siswa'].includes(lowerKey) || value === '' || value === null || value === undefined) continue;

          let subject = byName.get(lowerKey) ?? byCode.get(lowerKey);
          if (!subject) {
            // Create subject (rare path) outside transaction
            subject = await this.prisma.subject.create({
              data: {
                code: key.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 30) || `SUBJ_${Date.now()}`,
                name: key.trim(),
                groupName: 'IMPORT',
              },
            });
            byName.set(lowerKey, subject);
          }

          const score = cleanNumber(value);
          if (score === null || score < 0 || score > 100)
            throw new Error(`Nilai ${key} harus berupa angka antara 0-100 (ditemukan: "${value}")`);

          ops.push({ studentId, subjectId: subject.id, semester, score });
          rowIndexMap.push(i);
        }
        success++;
      } catch (error) {
        errors.push({ row: i + 2, message: error instanceof Error ? error.message : 'Gagal memproses baris nilai rapor' });
      }
    }

    // ── Batch upsert in chunks of 100 ops ────────────────────────────
    const CHUNK = 100;
    for (let c = 0; c < ops.length; c += CHUNK) {
      const chunk = ops.slice(c, c + CHUNK);
      await this.prisma.$transaction(
        chunk.map((op) =>
          this.prisma.reportScore.upsert({
            where: { studentId_subjectId_semester: { studentId: op.studentId, subjectId: op.subjectId, semester: op.semester } },
            update: { score: op.score },
            create: op,
          }),
        ),
      );
    }

    try {
      await this.prisma.importBatch.create({
        data: {
          kind: 'REPORT_SCORE',
          fileName: file.originalname,
          totalRows: rows.length,
          successRows: success,
          failedRows: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch {}

    return {
      total: rows.length,
      success,
      failed: errors.length,
      errors,
      message: `${success} dari ${rows.length} baris nilai rapor berhasil dibaca dan disimpan ke database.`
    };
  }

  @Post('import-tka')
  @UseInterceptors(FileInterceptor('file'))
  async importTka(@UploadedFile() file: Express.Multer.File) {
    const st = await this.state();
    if (st.frozen) throw new BadRequestException('Data nilai sedang di-freeze (dikunci). Buka freeze terlebih dahulu.');
    const rows = parseWorkbook(file);
    if (!rows || rows.length === 0) {
      throw new BadRequestException('File Excel/CSV tidak memiliki baris data yang valid.');
    }

    // ── Preload all students once ─────────────────────────────────────
    const allStudents = await this.prisma.student.findMany({
      where: { academicYearId: st.year.id },
      select: { id: true, nis: true },
    });
    const studentMap = new Map<string, number>();
    allStudents.forEach((s) => studentMap.set(s.nis, s.id));

    let success = 0;
    const errors: any[] = [];
    type TkaOp = { studentId: number; score: number };
    const ops: TkaOp[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

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

        const rawNis = getVal('NIS', 'nis', 'No Induk', 'Nomor Induk', 'Nis', 'no_induk', 'id_siswa');
        const nis = cleanNis(rawNis);
        if (!nis) throw new Error('NIS tidak boleh kosong');

        const rawScore = getVal('Nilai TKA', 'TKA', 'tka', 'Nilai', 'Skor TKA', 'score', 'tka_score', 'Nilai_TKA');
        const score = cleanNumber(rawScore);
        if (score === null || score < 0 || score > 100)
          throw new Error(`Nilai TKA harus angka antara 0-100 (ditemukan: "${rawScore || '-'}")`);

        const studentId = studentMap.get(nis);
        if (!studentId)
          throw new Error(`Siswa dengan NIS "${nis}" tidak ditemukan pada tahun ajaran aktif.`);

        ops.push({ studentId, score });
        success++;
      } catch (error) {
        errors.push({ row: i + 2, message: error instanceof Error ? error.message : 'Gagal memproses baris TKA' });
      }
    }

    // ── Batch upsert in a single transaction ─────────────────────────
    if (ops.length > 0) {
      await this.prisma.$transaction(
        ops.map((op) =>
          this.prisma.tkaScore.upsert({
            where: { studentId: op.studentId },
            update: { score: op.score, source: 'IMPORT' },
            create: { studentId: op.studentId, score: op.score, source: 'IMPORT' },
          }),
        ),
      );
    }

    try {
      await this.prisma.importBatch.create({
        data: {
          kind: 'TKA_SCORE',
          fileName: file.originalname,
          totalRows: rows.length,
          successRows: success,
          failedRows: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch {}

    return {
      total: rows.length,
      success,
      failed: errors.length,
      errors,
      message: `${success} dari ${rows.length} nilai TKA siswa berhasil dibaca dan disimpan ke database.`
    };
  }

  @Post('import-riasec')
  @UseInterceptors(FileInterceptor('file'))
  async importRiasec(@UploadedFile() file: Express.Multer.File) {
    const st = await this.state();
    if (st.frozen) throw new BadRequestException('Data nilai sedang di-freeze (dikunci). Buka freeze terlebih dahulu.');
    const rows = parseWorkbook(file);
    if (!rows || rows.length === 0) {
      throw new BadRequestException('File Excel/CSV tidak memiliki baris data yang valid.');
    }
    let success = 0;
    const errors: any[] = [];

    const getDimScore = (row: any, ...keys: string[]): number => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
          const val = cleanNumber(row[k]);
          if (val === null || val < 0 || val > 100) {
            throw new Error(`Skor ${k} harus berupa angka antara 0-100 (ditemukan: "${row[k]}")`);
          }
          return val;
        }
      }
      const rowKeys = Object.keys(row);
      for (const k of keys) {
        const matched = rowKeys.find((rk) => rk.toLowerCase().trim() === k.toLowerCase().trim());
        if (matched && row[matched] !== undefined && row[matched] !== null && String(row[matched]).trim() !== '') {
          const val = cleanNumber(row[matched]);
          if (val === null || val < 0 || val > 100) {
            throw new Error(`Skor ${matched} harus berupa angka antara 0-100 (ditemukan: "${row[matched]}")`);
          }
          return val;
        }
      }
      return 0;
    };

    // ── Preload all students once ─────────────────────────────────────
    const allStudentsR = await this.prisma.student.findMany({
      where: { academicYearId: st.year.id },
      select: { id: true, nis: true },
    });
    const studentMapR = new Map<string, number>();
    allStudentsR.forEach((s) => studentMapR.set(s.nis, s.id));

    type RiasecOp = { studentId: number; rScore: number; iScore: number; aScore: number; sScore: number; eScore: number; cScore: number; dominantTraits: string };
    const ops: RiasecOp[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

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

        const rawNis = getVal('NIS', 'nis', 'No Induk', 'Nomor Induk', 'Nis', 'no_induk', 'id_siswa');
        const nis = cleanNis(rawNis);
        if (!nis) throw new Error('NIS tidak boleh kosong');

        const studentId = studentMapR.get(nis);
        if (!studentId)
          throw new Error(`Siswa dengan NIS "${nis}" tidak ditemukan pada tahun ajaran aktif.`);

        const rScore = getDimScore(row, 'R (Realistic)', 'Realistic', 'R', 'r', 'Realis', 'Realistik');
        const iScore = getDimScore(row, 'I (Investigative)', 'Investigative', 'I', 'i', 'Investigatif');
        const aScore = getDimScore(row, 'A (Artistic)', 'Artistic', 'A', 'a', 'Artistik', 'Art');
        const sScore = getDimScore(row, 'S (Social)', 'Social', 'S', 's', 'Sosial');
        const eScore = getDimScore(row, 'E (Enterprising)', 'Enterprising', 'E', 'e', 'Wirausaha', 'Bisnis', 'Enterpreneur');
        const cScore = getDimScore(row, 'C (Conventional)', 'Conventional', 'C', 'c', 'Konvensional', 'Konven');
        const dominantTraits = calculateDominantTraits(rScore, iScore, aScore, sScore, eScore, cScore);

        ops.push({ studentId, rScore, iScore, aScore, sScore, eScore, cScore, dominantTraits });
        success++;
      } catch (error) {
        errors.push({ row: i + 2, message: error instanceof Error ? error.message : 'Gagal memproses baris RIASEC' });
      }
    }

    // ── Batch upsert in a single transaction ─────────────────────────
    if (ops.length > 0) {
      await this.prisma.$transaction(
        ops.map((op) =>
          this.prisma.riasecScore.upsert({
            where: { studentId: op.studentId },
            update: { rScore: op.rScore, iScore: op.iScore, aScore: op.aScore, sScore: op.sScore, eScore: op.eScore, cScore: op.cScore, dominantTraits: op.dominantTraits, source: 'IMPORT' },
            create: { studentId: op.studentId, rScore: op.rScore, iScore: op.iScore, aScore: op.aScore, sScore: op.sScore, eScore: op.eScore, cScore: op.cScore, dominantTraits: op.dominantTraits, source: 'IMPORT' },
          }),
        ),
      );
    }

    try {
      await this.prisma.importBatch.create({
        data: {
          kind: 'RIASEC_SCORE',
          fileName: file.originalname,
          totalRows: rows.length,
          successRows: success,
          failedRows: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      });
    } catch {}

    return {
      total: rows.length,
      success,
      failed: errors.length,
      errors,
      message: `${success} dari ${rows.length} profil tes RIASEC siswa berhasil dibaca dan disimpan ke database.`
    };
  }
}

