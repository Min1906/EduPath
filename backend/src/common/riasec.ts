export interface RiasecVector {
  R: number; // Realistic
  I: number; // Investigative
  A: number; // Artistic
  S: number; // Social
  E: number; // Enterprising
  C: number; // Conventional
}

export function getSubjectRiasecVector(subjectName: string): RiasecVector {
  const name = (subjectName || '').toLowerCase().trim();

  if (name.includes('matematika tingkat lanjut') || name.includes('matematika peminatan') || name.includes('matematika lanjut')) {
    return { R: 0.10, I: 0.70, A: 0.05, S: 0.05, E: 0.05, C: 0.05 };
  }
  if (name.includes('matematika')) {
    return { R: 0.15, I: 0.60, A: 0.05, S: 0.05, E: 0.05, C: 0.10 };
  }
  if (name.includes('fisika')) {
    return { R: 0.40, I: 0.50, A: 0.00, S: 0.00, E: 0.05, C: 0.05 };
  }
  if (name.includes('kimia')) {
    return { R: 0.35, I: 0.55, A: 0.00, S: 0.00, E: 0.05, C: 0.05 };
  }
  if (name.includes('biologi')) {
    return { R: 0.25, I: 0.60, A: 0.05, S: 0.10, E: 0.00, C: 0.00 };
  }
  if (name.includes('informatika') || name.includes('rekayasa perangkat lunak') || name.includes('tik') || name.includes('komputer')) {
    return { R: 0.20, I: 0.45, A: 0.10, S: 0.00, E: 0.05, C: 0.20 };
  }
  if (name.includes('ekonomi') || name.includes('kewirausahaan') || name.includes('pkwu') || name.includes('bisnis') || name.includes('manajemen')) {
    return { R: 0.05, I: 0.15, A: 0.05, S: 0.15, E: 0.50, C: 0.10 };
  }
  if (name.includes('akuntansi') || name.includes('keuangan') || name.includes('administrasi')) {
    return { R: 0.05, I: 0.15, A: 0.00, S: 0.05, E: 0.25, C: 0.50 };
  }
  if (name.includes('sosiologi') || name.includes('sosial')) {
    return { R: 0.00, I: 0.20, A: 0.10, S: 0.55, E: 0.10, C: 0.05 };
  }
  if (name.includes('antropologi')) {
    return { R: 0.05, I: 0.25, A: 0.15, S: 0.50, E: 0.05, C: 0.00 };
  }
  if (name.includes('geografi')) {
    return { R: 0.30, I: 0.40, A: 0.05, S: 0.15, E: 0.05, C: 0.05 };
  }
  if (name.includes('sejarah')) {
    return { R: 0.05, I: 0.35, A: 0.15, S: 0.35, E: 0.05, C: 0.05 };
  }
  if (name.includes('bahasa indonesia') || name.includes('sastra indonesia') || name.includes('sastra')) {
    return { R: 0.00, I: 0.15, A: 0.55, S: 0.25, E: 0.05, C: 0.00 };
  }
  if (name.includes('bahasa inggris') || name.includes('bahasa jepang') || name.includes('bahasa arab') || name.includes('bahasa jerman') || name.includes('bahasa mandarin') || name.includes('bahasa')) {
    return { R: 0.00, I: 0.15, A: 0.45, S: 0.30, E: 0.10, C: 0.00 };
  }
  if (name.includes('seni budaya') || name.includes('seni rupa') || name.includes('seni musik') || name.includes('seni tari') || name.includes('seni teater') || name.includes('dkv') || name.includes('desain')) {
    return { R: 0.10, I: 0.05, A: 0.75, S: 0.10, E: 0.00, C: 0.00 };
  }
  if (name.includes('pjok') || name.includes('pendidikan jasmani') || name.includes('olahraga')) {
    return { R: 0.70, I: 0.05, A: 0.05, S: 0.15, E: 0.05, C: 0.00 };
  }
  if (name.includes('agama') || name.includes('pai') || name.includes('ppkn') || name.includes('pancasila')) {
    return { R: 0.00, I: 0.10, A: 0.05, S: 0.70, E: 0.10, C: 0.05 };
  }

  // Default balanced vector
  return { R: 0.166, I: 0.166, A: 0.166, S: 0.166, E: 0.166, C: 0.166 };
}

export function calculateRiasecFit(
  riasec: { rScore: number | any; iScore: number | any; aScore: number | any; sScore: number | any; eScore: number | any; cScore: number | any } | null | undefined,
  subjects: Array<{ name: string; weight?: number }>,
): number {
  if (!riasec) return 75; // Default neutral score if student has not taken RIASEC test

  const r = Number(riasec.rScore ?? 0);
  const i = Number(riasec.iScore ?? 0);
  const a = Number(riasec.aScore ?? 0);
  const s = Number(riasec.sScore ?? 0);
  const e = Number(riasec.eScore ?? 0);
  const c = Number(riasec.cScore ?? 0);

  if (r === 0 && i === 0 && a === 0 && s === 0 && e === 0 && c === 0) {
    return 75;
  }

  if (!subjects || subjects.length === 0) {
    return (r + i + a + s + e + c) / 6;
  }

  const totalWeight = subjects.reduce((sum, item) => sum + (item.weight && item.weight > 0 ? item.weight : 1), 0);
  let totalFit = 0;

  for (const item of subjects) {
    const w = (item.weight && item.weight > 0 ? item.weight : 1) / totalWeight;
    const v = getSubjectRiasecVector(item.name);
    const subjectFit = v.R * r + v.I * i + v.A * a + v.S * s + v.E * e + v.C * c;
    totalFit += subjectFit * w;
  }

  return Number(Math.min(100, Math.max(0, totalFit)).toFixed(2));
}

export function getDominantHollandCode(r: number, i: number, a: number, s: number, e: number, c: number): string {
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
