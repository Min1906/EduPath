import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await hash('Admin123!', 12);
  const staffHash = await hash('GuruBK123!', 12);
  const studentHash = await hash('Siswa123!', 12);

  const year = await prisma.academicYear.upsert({
    where: { name: '2026/2027' },
    update: { isActive: true },
    create: {
      name: '2026/2027',
      isActive: true,
      policy: { scoresFrozen: false, maxClassSize: 36 },
    },
  });

  await prisma.academicYear.updateMany({
    where: { id: { not: year.id } },
    data: { isActive: false },
  });

  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminHash, role: UserRole.SUPER_ADMIN },
    create: {
      username: 'admin',
      name: 'Super Administrator',
      passwordHash: adminHash,
      role: UserRole.SUPER_ADMIN,
    },
  });

  const bk = await prisma.teacher.upsert({
    where: { employeeNo: 'BK001' },
    update: { name: 'Guru BK' },
    create: { employeeNo: 'BK001', name: 'Guru BK', subjectText: 'Bimbingan Konseling' },
  });

  await prisma.user.upsert({
    where: { username: 'guru.bk' },
    update: { passwordHash: staffHash, role: UserRole.ADMIN, teacherId: bk.id, isActive: true },
    create: {
      username: 'guru.bk',
      name: 'Guru BK',
      passwordHash: staffHash,
      role: UserRole.ADMIN,
      teacherId: bk.id,
    },
  });

  const defs = [
    ['MTK', 'Matematika', 'UMUM'],
    ['FIS', 'Fisika', 'IPA'],
    ['BIO', 'Biologi', 'IPA'],
    ['KIM', 'Kimia', 'IPA'],
    ['GEO', 'Geografi', 'IPS'],
    ['SEJ', 'Sejarah', 'IPS'],
    ['EKO', 'Ekonomi', 'IPS'],
    ['SOS', 'Sosiologi', 'IPS'],
    ['INF', 'Informatika', 'TEKNOLOGI'],
    ['AGM', 'Agama', 'UMUM'],
    ['SEN', 'Kesenian', 'SENI'],
  ];

  const subjects = new Map<string, number>();
  for (const [code, name, groupName] of defs) {
    const s = await prisma.subject.upsert({
      where: { code },
      update: { name, groupName },
      create: { code, name, groupName },
    });
    subjects.set(name, s.id);
  }

  const classDefs = [
    ['X-1', 'X', 'REGULER'],
    ['X-2', 'X', 'REGULER'],
    ['XI IPA 1', 'XI', 'Mayoritas IPA'],
    ['XI IPA 2', 'XI', 'Mayoritas IPA'],
    ['XI IPS 1', 'XI', 'Mayoritas IPS'],
    ['XI IPS 2', 'XI', 'Mayoritas IPS'],
  ];

  const classes = new Map<string, number>();
  for (const [name, gradeLevel, category] of classDefs) {
    const c = await prisma.schoolClass.upsert({
      where: { academicYearId_name: { academicYearId: year.id, name } },
      update: { gradeLevel, category, isPackageClass: gradeLevel === 'XI' },
      create: {
        academicYearId: year.id,
        name,
        gradeLevel,
        category,
        isPackageClass: gradeLevel === 'XI',
        capacity: 36,
      },
    });
    classes.set(name, c.id);
  }

  const packageDefs = [
    {
      className: 'XI IPA 1',
      title: 'Sains Murni',
      weights: { Matematika: 25, Fisika: 25, Biologi: 25, Kimia: 25 },
      extras: ['Agama', 'Sejarah'],
    },
    {
      className: 'XI IPA 2',
      title: 'Sains Teknologi',
      weights: { Matematika: 30, Fisika: 30, Kimia: 25, Informatika: 15 },
      extras: ['Sejarah'],
    },
    {
      className: 'XI IPS 1',
      title: 'Sosial Digital',
      weights: { Matematika: 20, Sejarah: 20, Geografi: 25, Sosiologi: 20, Informatika: 15 },
      extras: [],
    },
    {
      className: 'XI IPS 2',
      title: 'Sosial Seni',
      weights: { Matematika: 20, Sejarah: 20, Geografi: 25, Sosiologi: 20, Kesenian: 15 },
      extras: [],
    },
  ];

  const packages = new Map<string, number>();
  for (const d of packageDefs) {
    const classId = classes.get(d.className)!;
    const pkg = await prisma.classPackage.upsert({
      where: { classId },
      update: { title: d.title },
      create: {
        academicYearId: year.id,
        classId,
        title: d.title,
        description: Object.keys(d.weights).join(', '),
        capacity: 36,
      },
    });
    packages.set(d.className, pkg.id);
    await prisma.packageSubject.deleteMany({ where: { packageId: pkg.id } });
    await prisma.classSubject.deleteMany({ where: { classId } });

    for (const [name, weight] of Object.entries(d.weights)) {
      const subjectId = subjects.get(name)!;
      await prisma.packageSubject.create({
        data: { packageId: pkg.id, subjectId, isSelection: true, selectionWeight: weight },
      });
      await prisma.classSubject.create({ data: { classId, subjectId } });
    }
    for (const name of d.extras) {
      const subjectId = subjects.get(name)!;
      await prisma.packageSubject.create({
        data: { packageId: pkg.id, subjectId, isSelection: false, selectionWeight: 0 },
      });
      await prisma.classSubject.create({ data: { classId, subjectId } });
    }
  }

  const students = [
    ['10001', 'Ahmad Fauzan', 'L', 'X-1', 88, 86],
    ['10002', 'Budi Santoso', 'L', 'X-1', 80, 82],
    ['10003', 'Citra Lestari', 'P', 'X-1', 91, 90],
    ['10004', 'Dinda Maharani', 'P', 'X-1', 84, 87],
    ['10005', 'Eka Saputra', 'L', 'X-2', 76, 78],
    ['10006', 'Farah Nabila', 'P', 'X-2', 89, 91],
    ['10007', 'Rizky Maulana', 'L', 'X-2', 83, 85],
    ['10008', 'Siti Rahma', 'P', 'X-2', 87, 88],
  ];

  for (let i = 0; i < students.length; i++) {
    const [nis, name, gender, origin, tka, base] = students[i];
    const s = await prisma.student.upsert({
      where: { academicYearId_nis: { academicYearId: year.id, nis: String(nis) } },
      update: {
        name: String(name),
        gender: String(gender),
        originClassId: classes.get(String(origin)),
      },
      create: {
        academicYearId: year.id,
        nis: String(nis),
        name: String(name),
        gender: String(gender),
        originClassId: classes.get(String(origin)),
      },
    });

    await prisma.user.upsert({
      where: { username: String(nis) },
      update: {
        name: String(name),
        passwordHash: studentHash,
        role: UserRole.STUDENT,
        studentId: s.id,
        isActive: true,
      },
      create: {
        username: String(nis),
        name: String(name),
        passwordHash: studentHash,
        role: UserRole.STUDENT,
        studentId: s.id,
        mustChangePassword: true,
      },
    });

    await prisma.tkaScore.upsert({
      where: { studentId: s.id },
      update: { score: Number(tka) },
      create: { studentId: s.id, score: Number(tka) },
    });

    let idx = 0;
    for (const subjectId of subjects.values()) {
      for (const sem of [1, 2]) {
        await prisma.reportScore.upsert({
          where: {
            studentId_subjectId_semester: {
              studentId: s.id,
              subjectId,
              semester: sem,
            },
          },
          update: { score: Number(base) + (idx % 5) - 2 + sem },
          create: {
            studentId: s.id,
            subjectId,
            semester: sem,
            score: Number(base) + (idx%5) - 2 + sem,
          },
        });
      }
      idx++;
    }

    const pref = await prisma.studentPreference.upsert({
      where: { studentId: s.id },
      update: {},
      create: { studentId: s.id },
    });

    await prisma.preferenceChoice.deleteMany({ where: { preferenceId: pref.id } });
    const order = i % 2 === 0 ? ['XI IPA 2', 'XI IPA 1', 'XI IPS 1'] : ['XI IPS 1', 'XI IPS 2', 'XI IPA 2'];
    for (let p = 0; p < order.length; p++) {
      await prisma.preferenceChoice.create({
        data: {
          preferenceId: pref.id,
          packageId: packages.get(order[p])!,
          priority: p + 1,
        },
      });
    }
  }

  await prisma.scoringConfig.upsert({
    where: { academicYearId_name: { academicYearId: year.id, name: 'Default 60-30-10' } },
    update: { isActive: true },
    create: {
      academicYearId: year.id,
      name: 'Default 60-30-10',
      academicWeight: 60,
      tkaWeight: 30,
      preferenceWeight: 10,
      passingGrade: 70,
      isActive: true,
    },
  });
}

main().finally(() => prisma.$disconnect());

