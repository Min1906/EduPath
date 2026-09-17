import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PlacementStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard, Roles, RolesGuard } from '../common/auth';
import { calculateRiasecFit } from '../common/riasec';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller('placement')
export class PlacementController {
  constructor(private prisma: PrismaService) {}

  private async activeYear() {
    return this.prisma.academicYear.findFirstOrThrow({ where: { isActive: true } });
  }

  @Post('simulate')
  async simulate(@Body() body?: {
    configId?: number;
    autoAdjust?: boolean;
    preserveFinal?: boolean;
  }) {
    const year = await this.activeYear();
    const policy = (year.policy as any) ?? {};
    const maxChoices = Number(policy.maxChoices ?? 3);
    const academicYearId = year.id;
    const autoAdjust = body?.autoAdjust !== false; // default true
    const preserveFinal = body?.preserveFinal === true;

    // 1. Dapatkan config scoring aktif / dipilih
    let config: any = null;
    if (body?.configId) {
      config = await this.prisma.scoringConfig.findUnique({
        where: { id: Number(body.configId) },
      });
    }
    if (!config) {
      config = await this.prisma.scoringConfig.findFirst({
        where: { academicYearId, isActive: true },
      });
    }
    if (!config) {
      config = await this.prisma.scoringConfig.findFirst({
        where: { academicYearId },
        orderBy: { createdAt: 'desc' },
      });
    }
    if (!config) {
      config = await this.prisma.scoringConfig.create({
        data: {
          academicYearId,
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

    // 2. Dapatkan seluruh paket kelas XI aktif
    const packages = await this.prisma.classPackage.findMany({
      where: {
        academicYearId,
        status: { not: 'ARCHIVED' },
      },
      include: {
        class: true,
        subjects: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!packages.length) {
      throw new BadRequestException('Belum ada paket kelas XI pada tahun ajaran ini. Silakan buat paket kelas di menu Paket Kelas XI terlebih dahulu.');
    }

    // 3. Dapatkan seluruh siswa pada tahun ajaran aktif
    const students = await this.prisma.student.findMany({
      where: { academicYearId },
      include: {
        reportScores: true,
        tkaScore: true,
        riasecScore: true,
        preference: { include: { choices: { orderBy: { priority: 'asc' } } } },
        packageScores: { where: { configId: config.id } },
        placement: true,
      },
    });

    if (!students.length) {
      throw new BadRequestException('Belum ada data siswa pada tahun ajaran ini untuk disimulasikan.');
    }

    // 4. Pastikan nilai seleksi studentPackageScores terhitung secara akurat dengan RIASEC
    const usePassingGrade = policy.usePassingGrade !== false;
    const requireComplete = policy.requireCompleteSelectionSubjects !== false;
    const minAcademicFit = Number(policy.minAcademicFit ?? 0);
    const minTka = Number(policy.minTka ?? 0);
    const minFinalScore = Number(policy.minFinalScore ?? config.passingGrade);

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
        let existingScore = student.packageScores.find((ps) => ps.packageId === pkg.id);
        if (!existingScore) {
          let academicFit = 0;
          let complete = true;

          if (selectionSubjects.length > 0) {
            for (const relation of selectionSubjects) {
              const scores = student.reportScores.filter((row) => row.subjectId === relation.subjectId);
              if (!scores.length) {
                complete = false;
                continue;
              }
              const average = scores.reduce((sum, row) => sum + Number(row.score), 0) / scores.length;
              academicFit += average * (Number(relation.selectionWeight) / 100);
            }
          } else if (student.reportScores.length > 0) {
            academicFit = student.reportScores.reduce((sum, row) => sum + Number(row.score), 0) / student.reportScores.length;
          }

          const choice = student.preference?.choices.find((item) => item.packageId === pkg.id);
          const preferenceScore = choice?.priority === 1 ? 100 : choice?.priority === 2 ? 80 : choice?.priority === 3 ? 60 : 0;
          const tka = student.tkaScore ? Number(student.tkaScore.score) : 0;
          const riasecFit = calculateRiasecFit(student.riasecScore, pkgSubjectsForRiasec);

          const finalScore =
            academicFit * (academicWeight / 100) +
            tka * (tkaWeight / 100) +
            riasecFit * (effectiveRiasecWeight / 100);

          const completeEligible = requireComplete ? (selectionSubjects.length > 0 ? complete : true) : true;
          const gradeEligible = usePassingGrade
            ? academicFit >= minAcademicFit && tka >= minTka && finalScore >= minFinalScore
            : true;
          const eligible = completeEligible && gradeEligible;

          existingScore = await this.prisma.studentPackageScore.upsert({
            where: { studentId_packageId_configId: { studentId: student.id, packageId: pkg.id, configId: config.id } },
            update: { academicFit, tkaScore: tka, preferenceScore, riasecScore: riasecFit, finalScore, eligible },
            create: { studentId: student.id, packageId: pkg.id, configId: config.id, academicFit, tkaScore: tka, preferenceScore, riasecScore: riasecFit, finalScore, eligible },
          });
          student.packageScores.push(existingScore);
        }
      }
    }

    // 5. Algoritma Penempatan Siswa (Priority-based + Intelligent Auto-Adjustment)
    // Map: studentId -> { packageId, priority, reason }
    const assigned = new Map<number, { packageId: number; priority: number; reason: string }>();

    // Step 5a: Jika preserveFinal diaktifkan, pertahankan siswa yang sudah FINAL
    let countPreserved = 0;
    if (preserveFinal) {
      for (const s of students) {
        if (s.placement?.status === PlacementStatus.FINAL && s.placedClassId) {
          const matchedPkg = packages.find((p) => p.classId === s.placedClassId);
          if (matchedPkg) {
            assigned.set(s.id, {
              packageId: matchedPkg.id,
              priority: 0,
              reason: 'Mempertahankan Hasil Resmi (FINAL)',
            });
            countPreserved++;
          }
        }
      }
    }

    // Helper to get currently occupied slots for a package
    const getPackageOccupancy = (pkgId: number) => {
      let count = 0;
      for (const item of assigned.values()) {
        if (item.packageId === pkgId) count++;
      }
      return count;
    };

    // Step 5b: Alokasi Bertingkat Berdasarkan Pilihan 1..maxChoices
    let countP1 = 0;
    let countP2 = 0;
    let countP3 = 0;

    for (let priority = 1; priority <= maxChoices; priority++) {
      for (const pkg of packages) {
        const currentFilled = getPackageOccupancy(pkg.id);
        const slots = pkg.capacity - currentFilled;
        if (slots <= 0) continue;

        const candidates = students
          .filter(
            (s) =>
              !assigned.has(s.id) &&
              s.preference?.choices.some((c) => c.priority === priority && c.packageId === pkg.id),
          )
          .map((s) => {
            const scoreObj = s.packageScores.find((x) => x.packageId === pkg.id);
            return {
              s,
              score: scoreObj,
              finalScore: Number(scoreObj?.finalScore ?? 0),
              academicFit: Number(scoreObj?.academicFit ?? 0),
              riasecScore: Number(scoreObj?.riasecScore ?? 0),
              tkaScore: Number(scoreObj?.tkaScore ?? 0),
            };
          })
          .filter((x) => x.score?.eligible)
          .sort((a, b) => {
            if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
            if (b.academicFit !== a.academicFit) return b.academicFit - a.academicFit;
            if (b.riasecScore !== a.riasecScore) return b.riasecScore - a.riasecScore;
            if (b.tkaScore !== a.tkaScore) return b.tkaScore - a.tkaScore;
            return a.s.name.localeCompare(b.s.name);
          })
          .slice(0, slots);

        for (const c of candidates) {
          assigned.set(c.s.id, {
            packageId: pkg.id,
            priority,
            reason: `Sesuai Prioritas Pilihan ${priority} (Skor: ${c.finalScore.toFixed(1)})`,
          });
          if (priority === 1) countP1++;
          else if (priority === 2) countP2++;
          else if (priority === 3) countP3++;
        }
      }
    }

    // Step 5c: Auto-Adjustment untuk Siswa yang Belum Tertampung (Jika autoAdjust aktif)
    let countAutoAdjusted = 0;
    if (autoAdjust) {
      const unassignedStudents = students.filter((s) => !assigned.has(s.id));

      const unassignedWithBestFit = unassignedStudents.map((s) => {
        const availableOptions = packages
          .map((pkg) => {
            const availableSlots = pkg.capacity - getPackageOccupancy(pkg.id);
            const scoreObj = s.packageScores.find((x) => x.packageId === pkg.id);
            const finalScore = Number(scoreObj?.finalScore ?? 0);
            const riasecScore = Number(scoreObj?.riasecScore ?? 0);
            return {
              package: pkg,
              availableSlots,
              finalScore,
              riasecScore,
            };
          })
          .filter((opt) => opt.availableSlots > 0)
          .sort((a, b) => b.finalScore - a.finalScore || b.riasecScore - a.riasecScore);

        return {
          student: s,
          bestOption: availableOptions[0] || null,
          maxFinalScore: availableOptions[0]?.finalScore ?? 0,
        };
      });

      unassignedWithBestFit.sort((a, b) => b.maxFinalScore - a.maxFinalScore);

      for (const item of unassignedWithBestFit) {
        const candidatePackages = packages
          .map((pkg) => {
            const availableSlots = pkg.capacity - getPackageOccupancy(pkg.id);
            const scoreObj = item.student.packageScores.find((x) => x.packageId === pkg.id);
            return {
              package: pkg,
              availableSlots,
              finalScore: Number(scoreObj?.finalScore ?? 0),
              riasecScore: Number(scoreObj?.riasecScore ?? 0),
            };
          })
          .filter((opt) => opt.availableSlots > 0)
          .sort((a, b) => b.finalScore - a.finalScore || b.riasecScore - a.riasecScore);

        if (candidatePackages.length > 0) {
          const chosen = candidatePackages[0];
          assigned.set(item.student.id, {
            packageId: chosen.package.id,
            priority: 99,
            reason: `Penyesuaian kuota otomatis rombel ${chosen.package.class.name} (Skor Kesesuaian: ${chosen.finalScore.toFixed(1)})`,
          });
          countAutoAdjusted++;
        }
      }
    }

    // 6. Simpan Hasil Penempatan ke Database dalam Transaksi
    await this.prisma.$transaction(async (tx) => {
      for (const s of students) {
        const assignInfo = assigned.get(s.id);
        const pkgId = assignInfo?.packageId;
        const cls = pkgId ? packages.find((p) => p.id === pkgId)?.class : null;

        const isPreserved = assignInfo?.priority === 0 && s.placement?.status === PlacementStatus.FINAL;
        const newStatus = isPreserved
          ? PlacementStatus.FINAL
          : pkgId
          ? PlacementStatus.TEMPORARY
          : PlacementStatus.UNPLACED;

        await tx.student.update({
          where: { id: s.id },
          data: { placedClassId: cls?.id ?? null },
        });

        await tx.placement.upsert({
          where: { studentId: s.id },
          update: {
            classId: cls?.id ?? null,
            status: newStatus,
            reason: assignInfo?.reason ?? (autoAdjust ? 'Kapasitas seluruh rombel telah terisi penuh' : 'Tidak memperoleh kuota pada pilihan 1-3'),
          },
          create: {
            studentId: s.id,
            classId: cls?.id ?? null,
            status: newStatus,
            reason: assignInfo?.reason ?? (autoAdjust ? 'Kapasitas seluruh rombel telah terisi penuh' : 'Tidak memperoleh kuota pada pilihan 1-3'),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: 'PLACEMENT_SIMULATE',
          entity: 'Placement',
          entityId: String(year.id),
          detail: {
            totalStudents: students.length,
            assigned: assigned.size,
            unplaced: students.length - assigned.size,
            p1: countP1,
            p2: countP2,
            p3: countP3,
            autoAdjusted: countAutoAdjusted,
            preservedFinal: countPreserved,
            configId: config.id,
            autoAdjust,
          },
        },
      });
    });

    const unplacedCount = students.length - assigned.size;

    return {
      message: `Simulasi penempatan berhasil: ${assigned.size} siswa ditempatkan (${countP1} Pilihan 1, ${countP2} Pilihan 2, ${countP3} Pilihan 3${countAutoAdjusted > 0 ? `, ${countAutoAdjusted} Penyesuaian Kuota` : ''}), ${unplacedCount} siswa belum mendapatkan kelas.`,
      totalStudents: students.length,
      assigned: assigned.size,
      unplaced: unplacedCount,
      config: {
        id: config.id,
        name: config.name,
        academicWeight: Number(config.academicWeight),
        tkaWeight: Number(config.tkaWeight),
        riasecWeight: Number(config.riasecWeight),
        passingGrade: Number(config.passingGrade),
      },
      priorityDistribution: {
        p1: countP1,
        p2: countP2,
        p3: countP3,
        autoAdjusted: countAutoAdjusted,
        unplaced: unplacedCount,
        preservedFinal: countPreserved,
      },
      classes: packages.map((p) => {
        const placedCount = [...assigned.values()].filter((x) => x.packageId === p.id).length;
        return {
          id: p.class.id,
          name: p.class.name,
          packageTitle: p.title,
          capacity: p.capacity,
          placed: placedCount,
          available: Math.max(0, p.capacity - placedCount),
        };
      }),
    };
  }

  @Get('occupancy')
  async occupancy() {
    const year = await this.activeYear();
    const classes = await this.prisma.schoolClass.findMany({
      where: {
        academicYearId: year.id,
        OR: [{ gradeLevel: 'XI' }, { isPackageClass: true }],
      },
      include: {
        placedStudents: {
          select: {
            id: true,
            nis: true,
            name: true,
            gender: true,
            originClass: { select: { name: true } },
            placement: true,
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
        package: true,
      },
    });

    return classes.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }

  @Get('recap')
  async recap() {
    const year = await this.activeYear();
    const academicYearId = year.id;

    const [classes, students] = await Promise.all([
      this.prisma.schoolClass.findMany({
        where: {
          academicYearId,
          OR: [{ gradeLevel: 'XI' }, { isPackageClass: true }],
        },
        include: {
          package: true,
          placedStudents: {
            select: {
              id: true,
              nis: true,
              name: true,
              gender: true,
              originClass: { select: { name: true } },
              placement: true,
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
        },
      }),
      this.prisma.student.findMany({
        where: { academicYearId },
        include: {
          originClass: true,
          placedClass: true,
          placement: true,
          preference: {
            include: {
              choices: {
                include: { package: { include: { class: true } } },
                orderBy: { priority: 'asc' },
              },
            },
          },
        },
      }),
    ]);

    const sortedClasses = classes.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    );

    const totalStudents = students.length;
    const placedStudents = students.filter((s) => s.placedClassId != null);
    const unplacedStudents = students.filter((s) => s.placedClassId == null);

    let countP1 = 0;
    let countP2 = 0;
    let countP3 = 0;
    let countAdjustment = 0;
    let countNoPreference = 0;

    placedStudents.forEach((s) => {
      const choices = s.preference?.choices ?? [];
      if (!choices.length) {
        countNoPreference++;
      } else {
        const match = choices.find((c) => c.package?.classId === s.placedClassId);
        if (match?.priority === 1) countP1++;
        else if (match?.priority === 2) countP2++;
        else if (match?.priority === 3) countP3++;
        else countAdjustment++;
      }
    });

    const classSummaries = sortedClasses.map((cls) => {
      const placed = cls.placedStudents;
      const countL = placed.filter((s) => s.gender === 'L').length;
      const countP = placed.filter((s) => s.gender === 'P').length;
      const countOther = placed.length - countL - countP;
      const available = Math.max(0, cls.capacity - placed.length);
      const isFull = placed.length >= cls.capacity;

      const studentList = placed.map((s) => {
        const choices = s.preference?.choices ?? [];
        let choiceLabel = 'Penyesuaian';
        if (!choices.length) {
          choiceLabel = 'Tanpa Pilihan';
        } else {
          const match = choices.find((c) => c.package?.classId === cls.id);
          if (match?.priority === 1) choiceLabel = 'Pilihan 1';
          else if (match?.priority === 2) choiceLabel = 'Pilihan 2';
          else if (match?.priority === 3) choiceLabel = 'Pilihan 3';
        }

        return {
          id: s.id,
          nis: s.nis,
          name: s.name,
          gender: s.gender,
          originClass: s.originClass?.name ?? '-',
          status: s.placement?.status ?? 'TEMPORARY',
          choiceLabel,
        };
      });

      return {
        id: cls.id,
        name: cls.name,
        packageTitle: cls.package?.title ?? 'Paket Kelas',
        capacity: cls.capacity,
        totalPlaced: placed.length,
        available,
        isFull,
        countL,
        countP,
        countOther,
        occupancyPercent: cls.capacity > 0 ? Number(((placed.length / cls.capacity) * 100).toFixed(1)) : 0,
        students: studentList,
      };
    });

    const totalCapacity = sortedClasses.reduce((sum, c) => sum + c.capacity, 0);

    return {
      academicYearName: year.name,
      finalizedAt: new Date(),
      totals: {
        totalStudents,
        totalPlaced: placedStudents.length,
        totalUnplaced: unplacedStudents.length,
        totalCapacity,
        totalAvailable: Math.max(0, totalCapacity - placedStudents.length),
      },
      choiceDistribution: {
        p1: countP1,
        p2: countP2,
        p3: countP3,
        adjustment: countAdjustment,
        noPreference: countNoPreference,
        percentP1: placedStudents.length ? Number(((countP1 / placedStudents.length) * 100).toFixed(1)) : 0,
        percentP2: placedStudents.length ? Number(((countP2 / placedStudents.length) * 100).toFixed(1)) : 0,
        percentP3: placedStudents.length ? Number(((countP3 / placedStudents.length) * 100).toFixed(1)) : 0,
        percentAdjustment: placedStudents.length ? Number(((countAdjustment / placedStudents.length) * 100).toFixed(1)) : 0,
      },
      classes: classSummaries,
    };
  }

  @Get('unplaced')
  async unplaced() {
    const year = await this.activeYear();
    const academicYearId = year.id;
    let config = await this.prisma.scoringConfig.findFirst({ where: { academicYearId, isActive: true } });
    if (!config) {
      config = await this.prisma.scoringConfig.findFirst({ where: { academicYearId }, orderBy: { createdAt: 'desc' } });
    }
    const packages = await this.prisma.classPackage.findMany({
      where: { academicYearId, status: { not: 'ARCHIVED' } },
      include: { class: { include: { _count: { select: { placedStudents: true } } } } },
    });
    const students = await this.prisma.student.findMany({
      where: { academicYearId, placedClassId: null },
      include: {
        packageScores: { where: config ? { configId: config.id } : undefined, orderBy: { finalScore: 'desc' } },
        preference: {
          include: {
            choices: {
              include: { package: { include: { class: true } } },
              orderBy: { priority: 'asc' },
            },
          },
        },
      },
    });

    return students.map((student) => ({
      student,
      recommendations: student.packageScores
        .filter((s) => s.eligible)
        .map((s) => {
          const p = packages.find((x) => x.id === s.packageId);
          return p
            ? {
                packageId: p.id,
                classId: p.classId,
                className: p.class.name,
                score: Number(s.finalScore),
                available: p.capacity - p.class._count.placedStudents,
              }
            : null;
        })
        .filter((x: any) => x && x.available > 0)
        .slice(0, 3),
    }));
  }

  @Post('move')
  async move(@Body() b: { studentId: number; classId: number; reason: string }) {
    if (!b.reason?.trim()) throw new BadRequestException('Alasan pemindahan wajib diisi');
    return this.prisma.$transaction(async (tx) => {
      const cls = await tx.schoolClass.findUniqueOrThrow({
        where: { id: b.classId },
        include: { _count: { select: { placedStudents: true } } },
      });
      const old = await tx.placement.findUnique({ where: { studentId: b.studentId } });
      if (old?.classId !== b.classId && cls._count.placedStudents >= cls.capacity) {
        throw new BadRequestException('Kelas tujuan sudah penuh');
      }
      await tx.student.update({ where: { id: b.studentId }, data: { placedClassId: b.classId } });
      const p = await tx.placement.upsert({
        where: { studentId: b.studentId },
        update: {
          classId: b.classId,
          reason: b.reason,
          status: old?.status === PlacementStatus.FINAL ? PlacementStatus.FINAL : PlacementStatus.TEMPORARY,
        },
        create: {
          studentId: b.studentId,
          classId: b.classId,
          reason: b.reason,
          status: PlacementStatus.TEMPORARY,
        },
      });
      await tx.auditLog.create({
        data: { action: 'PLACEMENT_MOVE', entity: 'Placement', entityId: String(p.id), detail: b },
      });
      return p;
    });
  }

  @Post('finalize')
  async finalize() {
    const year = await this.activeYear();
    await this.prisma.placement.updateMany({
      where: { student: { academicYearId: year.id }, classId: { not: null } },
      data: { status: PlacementStatus.FINAL },
    });
    return { message: 'Placement berhasil difinalisasi menjadi hasil resmi. Penyesuaian pemindahan tetap dapat dilakukan dengan catatan alasan dan audit.' };
  }

  @Get('fairness-info')
  async fairnessInfo() {
    const year = await this.activeYear();
    const students = await this.prisma.student.findMany({
      where: { academicYearId: year.id },
      include: {
        placement: true,
        preference: {
          include: {
            choices: {
              include: { package: true },
              orderBy: { priority: 'asc' },
            },
          },
        },
      },
    });

    const placed = students.filter((s) => s.placedClassId != null);
    const unplaced = students.filter((s) => s.placedClassId == null);

    let p1 = 0;
    let p2 = 0;
    let p3 = 0;
    let adjustment = 0;
    let noPreference = 0;

    placed.forEach((s) => {
      const choices = s.preference?.choices ?? [];
      if (!choices.length) {
        noPreference++;
      } else {
        const match = choices.find((c) => c.package?.classId === s.placedClassId);
        if (match?.priority === 1) p1++;
        else if (match?.priority === 2) p2++;
        else if (match?.priority === 3) p3++;
        else adjustment++;
      }
    });

    return {
      total: students.length,
      placed: placed.length,
      unplaced: unplaced.length,
      p1,
      p2,
      p3,
      adjustment,
      noPreference,
      rateP1: placed.length ? Number(((p1 / placed.length) * 100).toFixed(1)) : 0,
      rateP2: placed.length ? Number(((p2 / placed.length) * 100).toFixed(1)) : 0,
      rateP3: placed.length ? Number(((p3 / placed.length) * 100).toFixed(1)) : 0,
      rateAdjustment: placed.length ? Number(((adjustment / placed.length) * 100).toFixed(1)) : 0,
    };
  }
}
