import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async get(@Query('academicYearId') yearIdQuery?: string) {
    let y = yearIdQuery && yearIdQuery !== 'ALL'
      ? await this.prisma.academicYear.findUnique({ where: { id: Number(yearIdQuery) } })
      : null;

    if (!y) {
      y = await this.prisma.academicYear.findFirst({ where: { isActive: true } });
    }
    if (!y) {
      y = await this.prisma.academicYear.findFirst({ orderBy: { createdAt: 'desc' } });
    }
    if (!y) {
      throw new Error('Tahun ajaran belum tersedia');
    }

    const [students, classes, subjects, unplaced, studentList, placedList] = await Promise.all([
      this.prisma.student.count({ where: { academicYearId: y.id } }),
      this.prisma.schoolClass.count({ where: { academicYearId: y.id } }),
      this.prisma.subject.count({ where: { isActive: true } }),
      this.prisma.student.count({ where: { academicYearId: y.id, placedClassId: null } }),
      this.prisma.student.findMany({
        where: { academicYearId: y.id },
        include: {
          riasecScore: true,
          originClass: true,
        },
      }),
      this.prisma.student.findMany({
        where: { academicYearId: y.id, placedClassId: { not: null } },
        include: {
          riasecScore: true,
          placedClass: {
            include: {
              package: {
                include: {
                  subjects: {
                    include: {
                      subject: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    // Calculate RIASEC statistics for the cohort
    const testedStudents = studentList.filter((s) => s.riasecScore !== null);
    const totalTested = testedStudents.length;

    let overallAverages = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
    const dominantCountMap: Record<string, number> = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

    if (totalTested > 0) {
      let sumR = 0, sumI = 0, sumA = 0, sumS = 0, sumE = 0, sumC = 0;
      for (const s of testedStudents) {
        const rs = s.riasecScore!;
        const r = Number(rs.rScore) || 0;
        const i = Number(rs.iScore) || 0;
        const a = Number(rs.aScore) || 0;
        const sc = Number(rs.sScore) || 0;
        const e = Number(rs.eScore) || 0;
        const c = Number(rs.cScore) || 0;

        sumR += r;
        sumI += i;
        sumA += a;
        sumS += sc;
        sumE += e;
        sumC += c;

        // Primary trait
        const topTrait = rs.dominantTraits?.charAt(0) || [
          { k: 'R', v: r },
          { k: 'I', v: i },
          { k: 'A', v: a },
          { k: 'S', v: sc },
          { k: 'E', v: e },
          { k: 'C', v: c },
        ].sort((x, y) => y.v - x.v)[0]?.k || 'I';

        if (dominantCountMap[topTrait] !== undefined) {
          dominantCountMap[topTrait]++;
        }
      }

      overallAverages = {
        R: Number((sumR / totalTested).toFixed(1)),
        I: Number((sumI / totalTested).toFixed(1)),
        A: Number((sumA / totalTested).toFixed(1)),
        S: Number((sumS / totalTested).toFixed(1)),
        E: Number((sumE / totalTested).toFixed(1)),
        C: Number((sumC / totalTested).toFixed(1)),
      };
    }

    // Class-level RIASEC breakdown
    const classMap = new Map<string, { className: string; classId: number | null; total: number; tested: number; sumR: number; sumI: number; sumA: number; sumS: number; sumE: number; sumC: number; topTraits: Record<string, number> }>();

    for (const s of studentList) {
      const cName = s.originClass?.name || 'Tanpa Kelas Asal';
      const cId = s.originClassId;
      let entry = classMap.get(cName);
      if (!entry) {
        entry = {
          className: cName,
          classId: cId,
          total: 0,
          tested: 0,
          sumR: 0,
          sumI: 0,
          sumA: 0,
          sumS: 0,
          sumE: 0,
          sumC: 0,
          topTraits: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 },
        };
        classMap.set(cName, entry);
      }
      entry.total++;

      if (s.riasecScore) {
        entry.tested++;
        const r = Number(s.riasecScore.rScore) || 0;
        const i = Number(s.riasecScore.iScore) || 0;
        const a = Number(s.riasecScore.aScore) || 0;
        const sc = Number(s.riasecScore.sScore) || 0;
        const e = Number(s.riasecScore.eScore) || 0;
        const c = Number(s.riasecScore.cScore) || 0;

        entry.sumR += r;
        entry.sumI += i;
        entry.sumA += a;
        entry.sumS += sc;
        entry.sumE += e;
        entry.sumC += c;

        const topTrait = s.riasecScore.dominantTraits?.charAt(0) || 'I';
        if (entry.topTraits[topTrait] !== undefined) {
          entry.topTraits[topTrait]++;
        }
      }
    }

    const classBreakdown = Array.from(classMap.values())
      .map((entry) => {
        const t = entry.tested || 1;
        const dominantKey = Object.entries(entry.topTraits).sort((x, y) => y[1] - x[1])[0]?.[0] || 'I';

        return {
          className: entry.className,
          classId: entry.classId,
          totalStudents: entry.total,
          testedStudents: entry.tested,
          averages: {
            R: entry.tested > 0 ? Number((entry.sumR / t).toFixed(1)) : 0,
            I: entry.tested > 0 ? Number((entry.sumI / t).toFixed(1)) : 0,
            A: entry.tested > 0 ? Number((entry.sumA / t).toFixed(1)) : 0,
            S: entry.tested > 0 ? Number((entry.sumS / t).toFixed(1)) : 0,
            E: entry.tested > 0 ? Number((entry.sumE / t).toFixed(1)) : 0,
            C: entry.tested > 0 ? Number((entry.sumC / t).toFixed(1)) : 0,
          },
          dominantTrait: dominantKey,
          topTraits: entry.topTraits,
        };
      })
      .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: 'base' }));

    // ==========================================
    // RIASEC VS PLACEMENT ALIGNMENT CALCULATION
    // ==========================================
    const placedWithRiasec = placedList.filter((s) => s.riasecScore !== null);
    let highFitCount = 0;
    let mediumFitCount = 0;
    let lowFitCount = 0;
    let totalFitScoreSum = 0;

    const packageFitMap = new Map<string, {
      packageId: number;
      packageTitle: string;
      className: string;
      totalPlaced: number;
      testedPlaced: number;
      sumFitScore: number;
      highFit: number;
      mediumFit: number;
      lowFit: number;
      dominantTraits: Record<string, number>;
    }>();

    const divergentStudents: Array<{
      id: number;
      nis: string;
      name: string;
      placedClass: string;
      packageTitle: string;
      dominantTraits: string;
      fitScore: number;
      status: 'HIGH' | 'MEDIUM' | 'LOW';
      note: string;
    }> = [];

    // Helper to determine target RIASEC dimensions for a package
    function getPackageTargetDimensions(pkgTitle: string, subjectGroups: string[]): { primary: string[]; secondary: string[] } {
      const lower = pkgTitle.toLowerCase();
      const groups = subjectGroups.map((g) => g.toUpperCase());

      if (lower.includes('sains') || lower.includes('ipa') || lower.includes('mipa') || groups.includes('IPA')) {
        if (lower.includes('teknologi') || lower.includes('komput') || groups.includes('TEKNOLOGI')) {
          return { primary: ['I', 'R'], secondary: ['C'] };
        }
        return { primary: ['I'], secondary: ['R', 'A'] };
      }
      if (lower.includes('sosial') || lower.includes('ips') || groups.includes('IPS')) {
        if (lower.includes('seni') || groups.includes('SENI')) {
          return { primary: ['S', 'A'], secondary: ['E'] };
        }
        if (lower.includes('digital') || groups.includes('TEKNOLOGI')) {
          return { primary: ['S', 'E'], secondary: ['I', 'R'] };
        }
        return { primary: ['S', 'E'], secondary: ['C'] };
      }
      if (lower.includes('bahasa') || lower.includes('budaya') || groups.includes('SENI')) {
        return { primary: ['A', 'S'], secondary: ['E'] };
      }
      return { primary: ['I', 'S'], secondary: ['E', 'C'] };
    }

    for (const s of placedWithRiasec) {
      const rs = s.riasecScore!;
      const placedClass = s.placedClass;
      const pkg = placedClass?.package;
      const pkgTitle = pkg?.title || placedClass?.name || 'Paket Peminatan';
      const subjectGroups = pkg?.subjects?.map((ps) => ps.subject.groupName) || [];

      const targetDims = getPackageTargetDimensions(pkgTitle, subjectGroups);
      const studentDominants = rs.dominantTraits || 'I';
      const topTrait1 = studentDominants.charAt(0) || 'I';
      const topTrait2 = studentDominants.charAt(1) || '';

      const scores: Record<string, number> = {
        R: Number(rs.rScore) || 0,
        I: Number(rs.iScore) || 0,
        A: Number(rs.aScore) || 0,
        S: Number(rs.sScore) || 0,
        E: Number(rs.eScore) || 0,
        C: Number(rs.cScore) || 0,
      };

      // Calculate numeric fit score (0 - 100)
      let primaryScoreMax = 0;
      for (const d of targetDims.primary) {
        if (scores[d] > primaryScoreMax) primaryScoreMax = scores[d];
      }

      let secondaryScoreMax = 0;
      for (const d of targetDims.secondary) {
        if (scores[d] > secondaryScoreMax) secondaryScoreMax = scores[d];
      }

      let fitScore = primaryScoreMax * 0.7 + secondaryScoreMax * 0.3;
      if (targetDims.primary.includes(topTrait1)) {
        fitScore = Math.max(fitScore, 82 + (scores[topTrait1] % 18));
      } else if (targetDims.secondary.includes(topTrait1) || targetDims.primary.includes(topTrait2)) {
        fitScore = Math.max(fitScore, 68 + (scores[topTrait1] % 12));
      }

      fitScore = Number(Math.min(100, Math.max(20, fitScore)).toFixed(1));
      totalFitScoreSum += fitScore;

      let fitStatus: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
      if (fitScore >= 75) {
        fitStatus = 'HIGH';
        highFitCount++;
      } else if (fitScore >= 60) {
        fitStatus = 'MEDIUM';
        mediumFitCount++;
      } else {
        fitStatus = 'LOW';
        lowFitCount++;
        divergentStudents.push({
          id: s.id,
          nis: s.nis,
          name: s.name,
          placedClass: placedClass?.name || '-',
          packageTitle: pkgTitle,
          dominantTraits: studentDominants,
          fitScore,
          status: 'LOW',
          note: `Siswa bertipe ${studentDominants} ditempatkan di ${pkgTitle}. Perlu bimbingan intensif agar target belajar tercapai optimal.`,
        });
      }

      // Aggregate by package / placed class
      const key = placedClass?.name || 'Kelas Lain';
      let pEntry = packageFitMap.get(key);
      if (!pEntry) {
        pEntry = {
          packageId: pkg?.id || 0,
          packageTitle: pkgTitle,
          className: placedClass?.name || key,
          totalPlaced: 0,
          testedPlaced: 0,
          sumFitScore: 0,
          highFit: 0,
          mediumFit: 0,
          lowFit: 0,
          dominantTraits: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 },
        };
        packageFitMap.set(key, pEntry);
      }
      pEntry.totalPlaced++;
      pEntry.testedPlaced++;
      pEntry.sumFitScore += fitScore;
      if (fitStatus === 'HIGH') pEntry.highFit++;
      else if (fitStatus === 'MEDIUM') pEntry.mediumFit++;
      else pEntry.lowFit++;

      if (pEntry.dominantTraits[topTrait1] !== undefined) {
        pEntry.dominantTraits[topTrait1]++;
      }
    }

    const packageFitList = Array.from(packageFitMap.values())
      .map((p) => {
        const count = p.testedPlaced || 1;
        const dominantInClass = Object.entries(p.dominantTraits).sort((a, b) => b[1] - a[1])[0]?.[0] || 'I';
        return {
          packageId: p.packageId,
          packageTitle: p.packageTitle,
          className: p.className,
          totalPlaced: p.totalPlaced,
          testedPlaced: p.testedPlaced,
          averageFitScore: Number((p.sumFitScore / count).toFixed(1)),
          highFit: p.highFit,
          mediumFit: p.mediumFit,
          lowFit: p.lowFit,
          highFitPercentage: Number(((p.highFit / count) * 100).toFixed(1)),
          dominantTrait: dominantInClass,
        };
      })
      .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: 'base' }));

    const totalPlacedTested = placedWithRiasec.length;

    const placementRiasecFit = {
      totalPlacedStudents: placedList.length,
      totalPlacedWithRiasec: totalPlacedTested,
      coveragePercentage: placedList.length > 0 ? Math.round((totalPlacedTested / placedList.length) * 100) : 0,
      averageAlignmentScore: totalPlacedTested > 0 ? Number((totalFitScoreSum / totalPlacedTested).toFixed(1)) : 0,
      highFitCount,
      highFitPercentage: totalPlacedTested > 0 ? Number(((highFitCount / totalPlacedTested) * 100).toFixed(1)) : 0,
      mediumFitCount,
      mediumFitPercentage: totalPlacedTested > 0 ? Number(((mediumFitCount / totalPlacedTested) * 100).toFixed(1)) : 0,
      lowFitCount,
      lowFitPercentage: totalPlacedTested > 0 ? Number(((lowFitCount / totalPlacedTested) * 100).toFixed(1)) : 0,
      packageFitList,
      divergentStudents: divergentStudents.slice(0, 10),
    };

    return {
      academicYear: y,
      students,
      classes,
      subjects,
      unplaced,
      riasecStats: {
        totalStudents: students,
        totalTested,
        coveragePercentage: students > 0 ? Math.round((totalTested / students) * 100) : 0,
        overallAverages,
        dominantDistribution: Object.entries(dominantCountMap).map(([dimension, count]) => ({
          dimension,
          count,
          percentage: totalTested > 0 ? Number(((count / totalTested) * 100).toFixed(1)) : 0,
        })),
        classBreakdown,
      },
      placementRiasecFit,
    };
  }
}
