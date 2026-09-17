'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, getUser, SessionUser } from '@/lib/api';
import { Button, Card, PageHeader, Select } from '@/components/ui';

interface RiasecAverages {
  R: number;
  I: number;
  A: number;
  S: number;
  E: number;
  C: number;
}

interface DominantDistribution {
  dimension: string;
  count: number;
  percentage: number;
}

interface ClassBreakdown {
  className: string;
  classId: number | null;
  totalStudents: number;
  testedStudents: number;
  averages: RiasecAverages;
  dominantTrait: string;
  topTraits: Record<string, number>;
}

interface RiasecStats {
  totalStudents: number;
  totalTested: number;
  coveragePercentage: number;
  overallAverages: RiasecAverages;
  dominantDistribution: DominantDistribution[];
  classBreakdown: ClassBreakdown[];
}

interface PackageFitItem {
  packageId: number;
  packageTitle: string;
  className: string;
  totalPlaced: number;
  testedPlaced: number;
  averageFitScore: number;
  highFit: number;
  mediumFit: number;
  lowFit: number;
  highFitPercentage: number;
  dominantTrait: string;
}

interface DivergentStudent {
  id: number;
  nis: string;
  name: string;
  placedClass: string;
  packageTitle: string;
  dominantTraits: string;
  fitScore: number;
  status: 'HIGH' | 'MEDIUM' | 'LOW';
  note: string;
}

interface PlacementRiasecFit {
  totalPlacedStudents: number;
  totalPlacedWithRiasec: number;
  coveragePercentage: number;
  averageAlignmentScore: number;
  highFitCount: number;
  highFitPercentage: number;
  mediumFitCount: number;
  mediumFitPercentage: number;
  lowFitCount: number;
  lowFitPercentage: number;
  packageFitList: PackageFitItem[];
  divergentStudents: DivergentStudent[];
}

interface DashboardData {
  academicYear?: { id: number; name: string; isActive: boolean };
  students?: number;
  classes?: number;
  subjects?: number;
  unplaced?: number;
  riasecStats?: RiasecStats;
  placementRiasecFit?: PlacementRiasecFit;
}

const RIASEC_META: Record<string, { name: string; label: string; color: string; bg: string; icon: string; focus: string; track: string }> = {
  R: {
    name: 'Realistic (Realistik)',
    label: 'Praktikal & Keteknikan',
    color: '#ef4444',
    bg: 'bg-red-50 text-red-700 border-red-200',
    icon: '🛠️',
    focus: 'Aktivitas fisik, mekanikal, teknologi terapan, eksperimen laboratorium nyata, dan keteknikan.',
    track: 'MIPA, Teknik & Informatika Terapan',
  },
  I: {
    name: 'Investigative (Investigatif)',
    label: 'Analitis & Sains MIPA',
    color: '#3b82f6',
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: '🔬',
    focus: 'Riset, pemecahan masalah matematis, observasi ilmiah, bioteknologi, kedokteran, dan logika komputasi.',
    track: 'MIPA Murni, Kedokteran & STEM',
  },
  A: {
    name: 'Artistic (Artistik)',
    label: 'Kreatif, Desain & Bahasa',
    color: '#ec4899',
    bg: 'bg-pink-50 text-pink-700 border-pink-200',
    icon: '🎨',
    focus: 'Ekspresi visual, seni, sastra, komunikasi multimedia, arsitektur kreatif, dan bahasa asing.',
    track: 'Bahasa & Budaya, Desain Komunikasi Visual',
  },
  S: {
    name: 'Social (Sosial)',
    label: 'Sosial & Pendidikan',
    color: '#10b981',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: '🤝',
    focus: 'Interaksi interpersonal, mengajar, konseling, kesehatan masyarakat, psikologi, dan pengabdian.',
    track: 'IPS Sosio-Humaniora, Psikologi & Pendidikan',
  },
  E: {
    name: 'Enterprising (Enterprising)',
    label: 'Kepemimpinan & Bisnis',
    color: '#f59e0b',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    icon: '📈',
    focus: 'Kepemimpinan, persuasi, kewirausahaan, diplomasi, manajemen organisasi, hukum, dan negosiasi.',
    track: 'IPS Bisnis, Manajemen, Hukum & HI',
  },
  C: {
    name: 'Conventional (Konvensional)',
    label: 'Terstruktur & Administrasi',
    color: '#8b5cf6',
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: '📋',
    focus: 'Keteraturan data, akurasi komputasi, akuntansi, sistem pengarsipan, administrasi, dan kepatuhan prosedur.',
    track: 'IPS Akuntansi, Keuangan, Statistika & Perbankan',
  },
};

// Safe number format helper to prevent NaN and ugly unrounded floats
const formatScore = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0.0';
  return Number(val).toFixed(1);
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [hoveredDimension, setHoveredDimension] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'RADAR' | 'FIT'>('RADAR');
  const [fitClusterFilter, setFitClusterFilter] = useState<'ALL' | 'SAINS' | 'SOSIAL' | 'CAMPURAN'>('ALL');
  const [hoveredFitSegment, setHoveredFitSegment] = useState<'HIGH' | 'MEDIUM' | 'LOW' | null>(null);
  const [divergentSearch, setDivergentSearch] = useState<string>('');
  const [divergentClassFilter, setDivergentClassFilter] = useState<string>('ALL');

  async function loadYears() {
    try {
      const years = await api<any[]>('/academic-years');
      setAcademicYears(years || []);
      const active = years?.find((y) => y.isActive);
      if (active) {
        setSelectedYearId(String(active.id));
      } else if (years && years.length > 0) {
        setSelectedYearId(String(years[0].id));
      }
    } catch (e) {
      console.error('Gagal memuat tahun ajaran:', e);
    }
  }

  async function loadDashboard(yearId?: string) {
    setLoading(true);
    try {
      const query = yearId ? `?academicYearId=${yearId}` : '';
      const d = await api<DashboardData>(`/dashboard${query}`);
      setData(d);
    } catch (e) {
      console.error('Gagal memuat dashboard:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setUser(getUser());
    loadYears();
  }, []);

  useEffect(() => {
    if (selectedYearId) {
      loadDashboard(selectedYearId);
    }
  }, [selectedYearId]);

  const totalStudents = data?.students ?? 0;
  const unplacedStudents = data?.unplaced ?? 0;
  const placedStudents = Math.max(0, totalStudents - unplacedStudents);
  const placementRate = totalStudents > 0 ? Math.round((placedStudents / totalStudents) * 100) : 0;

  // RIASEC stats & active scope computation
  const riasecStats = data?.riasecStats;
  const placementRiasecFit = data?.placementRiasecFit;
  const classBreakdown = riasecStats?.classBreakdown || [];

  const activeClassObj = useMemo(() => {
    if (selectedClass === 'ALL') return null;
    return classBreakdown.find((c) => c.className === selectedClass) || null;
  }, [selectedClass, classBreakdown]);

  // Current display averages based on class filter
  const currentAverages: RiasecAverages = useMemo(() => {
    if (activeClassObj && activeClassObj.testedStudents > 0) {
      return activeClassObj.averages;
    }
    return riasecStats?.overallAverages || { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };
  }, [activeClassObj, riasecStats]);

  const cohortAverages: RiasecAverages = riasecStats?.overallAverages || { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

  // Determine top dominant traits for narrative recommendation
  const sortedTraits = useMemo(() => {
    return Object.entries(currentAverages)
      .map(([k, v]) => ({ key: k, score: Number(v) || 0, meta: RIASEC_META[k] }))
      .sort((a, b) => b.score - a.score);
  }, [currentAverages]);

  const primaryTrait = sortedTraits[0]?.key || 'I';
  const secondaryTrait = sortedTraits[1]?.key || 'R';

  // SVG Radar Chart Coordinates (Center: 160, 160; Radius: 105)
  const radarCenter = 160;
  const radarRadius = 105;
  const dimensions = ['R', 'I', 'A', 'S', 'E', 'C'];

  function getRadarCoords(index: number, ratio: number) {
    const angle = (index * 60 - 90) * (Math.PI / 180);
    return {
      x: radarCenter + radarRadius * ratio * Math.cos(angle),
      y: radarCenter + radarRadius * ratio * Math.sin(angle),
    };
  }

  // Polygon points for active scope
  const activePolygonPoints = dimensions
    .map((dim, idx) => {
      const score = currentAverages[dim as keyof RiasecAverages] || 0;
      const ratio = Math.max(0.1, Math.min(1.0, (Number(score) || 0) / 100));
      const pt = getRadarCoords(idx, ratio);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  // Polygon points for cohort baseline (when class is selected)
  const cohortPolygonPoints = dimensions
    .map((dim, idx) => {
      const score = cohortAverages[dim as keyof RiasecAverages] || 0;
      const ratio = Math.max(0.1, Math.min(1.0, (Number(score) || 0) / 100));
      const pt = getRadarCoords(idx, ratio);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  // Helper to categorize class packages into cluster groups
  const getPackageCluster = (p: PackageFitItem): 'SAINS' | 'SOSIAL' | 'CAMPURAN' => {
    const text = `${p.packageTitle || ''} ${p.className || ''}`.toLowerCase();
    if (
      text.includes('mipa') ||
      text.includes('sains') ||
      text.includes('teknologi') ||
      text.includes('medika') ||
      text.includes('rekayasa') ||
      text.includes('ipa') ||
      text.includes('hayati') ||
      text.includes('kedokteran')
    ) {
      return 'SAINS';
    }
    if (
      text.includes('sosial') ||
      text.includes('ips') ||
      text.includes('humaniora') ||
      text.includes('ekonomi') ||
      text.includes('hukum') ||
      text.includes('bisnis') ||
      text.includes('bahasa') ||
      text.includes('komunikasi') ||
      text.includes('akuntansi')
    ) {
      return 'SOSIAL';
    }
    return 'CAMPURAN';
  };

  const filteredPackageFitList = useMemo(() => {
    const list = placementRiasecFit?.packageFitList || [];
    if (fitClusterFilter === 'ALL') return list;
    return list.filter((p) => getPackageCluster(p) === fitClusterFilter);
  }, [placementRiasecFit, fitClusterFilter]);

  const divergentClasses = useMemo(() => {
    const list = placementRiasecFit?.divergentStudents || [];
    const set = new Set<string>();
    list.forEach((s) => {
      if (s.placedClass) set.add(s.placedClass);
    });
    return Array.from(set).sort();
  }, [placementRiasecFit]);

  const filteredDivergentStudents = useMemo(() => {
    const list = placementRiasecFit?.divergentStudents || [];
    return list.filter((s) => {
      const matchesClass = divergentClassFilter === 'ALL' || s.placedClass === divergentClassFilter;
      const matchesSearch =
        !divergentSearch.trim() ||
        s.name.toLowerCase().includes(divergentSearch.toLowerCase()) ||
        s.nis.toLowerCase().includes(divergentSearch.toLowerCase()) ||
        s.placedClass.toLowerCase().includes(divergentSearch.toLowerCase()) ||
        s.packageTitle.toLowerCase().includes(divergentSearch.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [placementRiasecFit, divergentClassFilter, divergentSearch]);

  // Interactive Metric Cards linking to their respective pages
  const metricCards = [
    {
      title: 'Total Siswa',
      value: data?.students ?? 0,
      label: 'Siswa & Guru',
      description: 'Identitas, kelas asal & akun siswa',
      href: '/admin/students',
      icon: '👥',
      bgGradient: 'from-blue-500/10 to-indigo-500/10',
      accentColor: 'text-blue-700',
      badgeBg: 'bg-blue-100 text-blue-800',
    },
    {
      title: 'Rombel Kelas',
      value: data?.classes ?? 0,
      label: 'Kelas X & XI',
      description: 'Daftar kelas reguler & paket XI',
      href: '/admin/classes',
      icon: '🏫',
      bgGradient: 'from-sky-500/10 to-cyan-500/10',
      accentColor: 'text-sky-700',
      badgeBg: 'bg-sky-100 text-sky-800',
    },
    {
      title: 'Mata Pelajaran',
      value: data?.subjects ?? 0,
      label: 'Struktur Mapel',
      description: 'Mapel umum, peminatan & seleksi',
      href: '/admin/subjects',
      icon: '📚',
      bgGradient: 'from-violet-500/10 to-purple-500/10',
      accentColor: 'text-violet-700',
      badgeBg: 'bg-violet-100 text-violet-800',
    },
    {
      title: 'Belum Ditempatkan',
      value: data?.unplaced ?? 0,
      label: 'Placement XI',
      description: 'Siswa butuh penempatan paket',
      href: '/admin/placement',
      icon: '🎯',
      bgGradient: 'from-amber-500/10 to-orange-500/10',
      accentColor: 'text-amber-700',
      badgeBg: 'bg-amber-100 text-amber-800',
    },
    {
      title: 'Nilai & RIASEC',
      value: riasecStats?.totalTested ? `${riasecStats.totalTested} Siswa` : `${totalStudents} Data`,
      label: 'Asesmen & Rapor',
      description: 'Rapor S1–2, TKA & Minat RIASEC',
      href: '/admin/scores',
      icon: '📊',
      bgGradient: 'from-emerald-500/10 to-teal-500/10',
      accentColor: 'text-emerald-700',
      badgeBg: 'bg-emerald-100 text-emerald-800',
    },
  ];

  // Quick Action / Step Pipeline Cards
  const workflowSteps = [
    {
      step: '1',
      title: 'Siswa & Guru',
      subtitle: 'Impor & kelola data siswa, NIS, dan kelas asal',
      href: '/admin/students',
      tag: 'Data Utama',
      icon: '👤',
    },
    {
      step: '2',
      title: 'Nilai Akademik & RIASEC',
      subtitle: 'Input rapor S1-S2, TKA, tes RIASEC & pilihan 1-3',
      href: '/admin/scores',
      tag: 'Kriteria Seleksi',
      icon: '📝',
    },
    {
      step: '3',
      title: 'Paket Kelas XI',
      subtitle: 'Konfigurasi paket peminatan, kuota, & mapel prasyarat',
      href: '/admin/packages',
      tag: 'Konfigurasi Rombel',
      icon: '📦',
    },
    {
      step: '4',
      title: 'Seleksi & Ranking',
      subtitle: 'Simulasi bobot rapor/TKA/RIASEC, passing grade, & ranking',
      href: '/admin/selection',
      tag: 'Algoritma Scoring',
      icon: '🏆',
    },
    {
      step: '5',
      title: 'Placement & Plotting',
      subtitle: 'Penempatan otomatis, pemindahan siswa, & finalisasi',
      href: '/admin/placement',
      tag: 'Hasil Akhir',
      icon: '✅',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard EduPath XI"
        description={`Tahun Ajaran: ${data?.academicYear?.name ?? 'Memuat...'}. Pantau metrik penempatan rombel, profil minat bakat RIASEC, dan kecocokan penempatan kelas siswa.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {academicYears.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium">Tahun Ajaran:</span>
                <Select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="h-9 py-1 text-xs font-bold w-44 bg-white shadow-2xs"
                >
                  {academicYears.map((y) => (
                    <option key={y.id} value={String(y.id)}>
                      {y.name} {y.isActive ? '(Aktif)' : ''}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {user?.role === 'SUPER_ADMIN' && (
              <Link
                href="/admin/settings"
                className="inline-flex items-center gap-1.5 h-9 rounded-xl border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 hover:bg-gray-50 transition shadow-2xs"
              >
                ⚙️ Kebijakan & Sistem
              </Link>
            )}
          </div>
        }
      />

      {/* INTERACTIVE METRIC CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800 tracking-wide uppercase">
            Ringkasan Statistik Sistem
          </h2>
          <span className="text-xs text-gray-500">Pilih kartu untuk membuka menu</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {metricCards.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group block focus:outline-hidden"
              title={`Klik untuk membuka menu ${c.label}`}
            >
              <Card className="h-full border-2 border-transparent transition-all duration-200 hover:border-[#2457d6] hover:shadow-lg hover:-translate-y-1 bg-white relative overflow-hidden flex flex-col justify-between">
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${c.bgGradient} rounded-bl-full pointer-events-none transition-transform group-hover:scale-110`} />
                
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{c.icon}</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.badgeBg}`}>
                      {c.label}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className={`text-3xl font-black ${c.accentColor}`}>
                      {loading ? (
                        <span className="inline-block h-8 w-16 bg-gray-200 animate-pulse rounded-md"></span>
                      ) : (
                        c.value
                      )}
                    </div>
                    <div className="text-xs font-bold text-gray-900 mt-1">{c.title}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">{c.description}</div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-[#2457d6] group-hover:text-blue-700">
                  <span>Buka Menu</span>
                  <span className="transform transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* SECTION RIASEC & KECOCOKAN PLACEMENT */}
      <Card className="border border-indigo-100 bg-white overflow-hidden shadow-xs">
        {/* TABS HEADER */}
        <div className="border-b border-gray-100 p-5 bg-gradient-to-r from-indigo-50/50 via-white to-blue-50/30">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white text-lg shadow-xs">
                🧭
              </span>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">
                  Analitik Minat Bakat RIASEC & Keselarasan Penempatan Kelas
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Pantau kecenderungan minat kepribadian siswa serta evaluasi kesesuaian penempatan kelas XI dengan profil RIASEC.
                </p>
              </div>
            </div>

            {/* TAB SELECTOR BUTTONS */}
            <div className="flex items-center gap-1.5 rounded-xl bg-gray-100 p-1">
              <button
                onClick={() => setActiveTab('RADAR')}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                  activeTab === 'RADAR'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📊 Radar Minat Kelas
              </button>
              <button
                onClick={() => setActiveTab('FIT')}
                className={`rounded-lg px-3 py-1.5 text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                  activeTab === 'FIT'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <span>🎯 Kecocokan Placement</span>
                {placementRiasecFit && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800">
                    {placementRiasecFit.averageAlignmentScore}%
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: RADAR MINAT RIASEC & BREAKDOWN KELAS */}
        {activeTab === 'RADAR' && (
          <div>
            <div className="border-b border-indigo-100/60 p-4 bg-slate-50/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-gray-700 whitespace-nowrap">
                    🏫 Filter Kelas Asal:
                  </label>
                  <Select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="h-8 py-0 text-xs font-bold w-48 bg-white border-indigo-200"
                  >
                    <option value="ALL">🌐 Semua Kelas (Agregat)</option>
                    {classBreakdown.map((c) => (
                      <option key={c.className} value={c.className}>
                        {c.className} ({c.testedStudents}/{c.totalStudents} Siswa)
                      </option>
                    ))}
                  </Select>
                </div>

                <span className="font-bold text-gray-800 border-l border-gray-200 pl-3">
                  Cakupan Asesmen:{' '}
                  <span className="text-indigo-700">
                    {selectedClass === 'ALL'
                      ? `${riasecStats?.totalTested ?? 0} dari ${riasecStats?.totalStudents ?? 0} Siswa (${riasecStats?.coveragePercentage ?? 0}%)`
                      : `${activeClassObj?.testedStudents ?? 0} dari ${activeClassObj?.totalStudents ?? 0} Siswa Kelas ${selectedClass}`}
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/admin/scores"
                  className="inline-flex items-center gap-1 h-7 rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition"
                >
                  📥 Impor Nilai RIASEC
                </Link>
              </div>
            </div>

            {/* MAIN RIASEC VISUAL & ANALYTICS BODY */}
            <div className="p-6 grid gap-6 lg:grid-cols-12 items-start">
              {/* RADAR CHART (5 cols) */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-50/70 border border-slate-100 relative">
                <div className="w-full text-center mb-1">
                  <span className="text-xs font-bold text-slate-800">
                    Grafik Radar 6 Dimensi RIASEC (Skala 0 - 100)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    {selectedClass === 'ALL'
                      ? 'Kecenderungan komposit seluruh siswa angkatan'
                      : `Kecenderungan rata-rata siswa kelas ${selectedClass}`}
                  </p>
                </div>

                <svg
                  viewBox="0 0 320 320"
                  className="w-full max-w-[300px] h-auto overflow-visible select-none my-2"
                >
                  <defs>
                    <radialGradient id="adminRiasecGrad" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="#4338ca" stopOpacity="0.15" />
                    </radialGradient>
                    <filter id="adminGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#4f46e5" floodOpacity="0.25" />
                    </filter>
                  </defs>

                  {/* Background Web Polygons (25%, 50%, 75%, 100%) */}
                  {[0.25, 0.5, 0.75, 1.0].map((levelRatio, lIdx) => {
                    const levelPoints = dimensions
                      .map((_, idx) => {
                        const pt = getRadarCoords(idx, levelRatio);
                        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                      })
                      .join(' ');
                    return (
                      <polygon
                        key={lIdx}
                        points={levelPoints}
                        fill={lIdx === 3 ? '#ffffff' : 'none'}
                        stroke="#e2e8f0"
                        strokeWidth={lIdx === 3 ? '1.5' : '1'}
                        strokeDasharray={lIdx === 3 ? 'none' : '2,2'}
                      />
                    );
                  })}

                  {/* Grid Lines from Center */}
                  {dimensions.map((_, idx) => {
                    const endPt = getRadarCoords(idx, 1.0);
                    return (
                      <line
                        key={idx}
                        x1={radarCenter}
                        y1={radarCenter}
                        x2={endPt.x}
                        y2={endPt.y}
                        stroke="#cbd5e1"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* Cohort Baseline Polygon (when a specific class is selected) */}
                  {selectedClass !== 'ALL' && (
                    <polygon
                      points={cohortPolygonPoints}
                      fill="#94a3b8"
                      fillOpacity="0.1"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeDasharray="4,4"
                    />
                  )}

                  {/* Active Scope Filled Polygon */}
                  <polygon
                    points={activePolygonPoints}
                    fill="url(#adminRiasecGrad)"
                    stroke="#4f46e5"
                    strokeWidth="2.5"
                    filter="url(#adminGlow)"
                    className="transition-all duration-300"
                  />

                  {/* Axis Vertex Markers & Labels */}
                  {dimensions.map((dimKey, idx) => {
                    const score = currentAverages[dimKey as keyof RiasecAverages] || 0;
                    const ratio = Math.max(0.1, Math.min(1.0, (Number(score) || 0) / 100));
                    const pt = getRadarCoords(idx, ratio);
                    const labelPt = getRadarCoords(idx, 1.25);
                    const meta = RIASEC_META[dimKey];
                    const isHovered = hoveredDimension === dimKey;

                    return (
                      <g key={dimKey}>
                        {/* Connecting point dot */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isHovered ? 6 : 4.5}
                          fill={meta.color}
                          stroke="#ffffff"
                          strokeWidth="2"
                          className="cursor-pointer transition-all duration-150"
                          onMouseEnter={() => setHoveredDimension(dimKey)}
                          onMouseLeave={() => setHoveredDimension(null)}
                        />

                        {/* Outer dimension tag with cleanly formatted score */}
                        <text
                          x={labelPt.x}
                          y={labelPt.y + 4}
                          textAnchor="middle"
                          className={`text-[11px] font-bold cursor-pointer transition ${
                            isHovered ? 'fill-indigo-950 font-black' : 'fill-gray-700'
                          }`}
                          onMouseEnter={() => setHoveredDimension(dimKey)}
                          onMouseLeave={() => setHoveredDimension(null)}
                        >
                          {dimKey} ({formatScore(score)})
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {/* Dominant Trait Summary Box */}
                <div className="mt-2 w-full p-2.5 rounded-xl bg-white border border-indigo-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-gray-500 font-medium">Tipe Dominan: </span>
                    <span className="font-black text-indigo-700">
                      {primaryTrait} & {secondaryTrait} ({RIASEC_META[primaryTrait]?.label})
                    </span>
                  </div>
                  <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-extrabold text-indigo-800">
                    Skor {formatScore(currentAverages[primaryTrait as keyof RiasecAverages])}
                  </span>
                </div>
              </div>

              {/* INSIGHT & DIMENSION BREAKDOWN (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* EDUCATIONAL POLICY & TRACK RECOMMENDATION CARD */}
                <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">💡</span>
                    <h4 className="text-xs font-black text-blue-900 uppercase tracking-wide">
                      Proyeksi Kebutuhan Rombel & Rekomendasi Peminatan
                    </h4>
                  </div>
                  
                  <p className="text-xs text-blue-950 leading-relaxed">
                    Berdasarkan asesmen minat bakat pada{' '}
                    <b>{selectedClass === 'ALL' ? 'seluruh angkatan' : `Kelas ${selectedClass}`}</b>, 
                    dimensi dominan teratas adalah <b>{RIASEC_META[primaryTrait]?.name}</b> ({formatScore(currentAverages[primaryTrait as keyof RiasecAverages])}) dan{' '}
                    <b>{RIASEC_META[secondaryTrait]?.name}</b> ({formatScore(currentAverages[secondaryTrait as keyof RiasecAverages])}).
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/90 p-2.5 border border-blue-100">
                      <div className="text-[10px] font-bold text-gray-500 uppercase">Rumpun Peminatan Ideal</div>
                      <div className="text-xs font-extrabold text-blue-800 mt-0.5">
                        {RIASEC_META[primaryTrait]?.track}
                      </div>
                      <div className="text-[11px] text-gray-600 mt-1 line-clamp-2">
                        {RIASEC_META[primaryTrait]?.focus}
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/90 p-2.5 border border-blue-100">
                      <div className="text-[10px] font-bold text-gray-500 uppercase">Rumpun Pendukung / Sekunder</div>
                      <div className="text-xs font-extrabold text-indigo-800 mt-0.5">
                        {RIASEC_META[secondaryTrait]?.track}
                      </div>
                      <div className="text-[11px] text-gray-600 mt-1 line-clamp-2">
                        {RIASEC_META[secondaryTrait]?.focus}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6 RIASEC DIMENSION CARDS */}
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {dimensions.map((dimKey) => {
                    const meta = RIASEC_META[dimKey];
                    const score = currentAverages[dimKey as keyof RiasecAverages] || 0;
                    const isDominant = dimKey === primaryTrait || dimKey === secondaryTrait;
                    const isHovered = hoveredDimension === dimKey;

                    return (
                      <div
                        key={dimKey}
                        onMouseEnter={() => setHoveredDimension(dimKey)}
                        onMouseLeave={() => setHoveredDimension(null)}
                        className={`rounded-xl p-3 border transition cursor-pointer ${
                          isHovered
                            ? 'border-indigo-400 bg-indigo-50/50 shadow-xs'
                            : isDominant
                            ? `${meta.bg} shadow-2xs`
                            : 'border-gray-200 bg-gray-50/60 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{meta.icon}</span>
                            <span className="font-extrabold text-xs text-gray-900">
                              {dimKey} - {meta.name.split(' ')[0]}
                            </span>
                          </div>
                          <span className="font-black text-xs" style={{ color: meta.color }}>
                            {formatScore(score)}
                          </span>
                        </div>

                        <div className="text-[10px] text-gray-500 mt-1 font-medium line-clamp-1">
                          {meta.label}
                        </div>

                        <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(0, Number(score) || 0))}%`,
                              backgroundColor: meta.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* COMPARISON TABLE ACROSS ORIGIN CLASSES */}
            {classBreakdown.length > 0 && (
              <div className="border-t border-gray-100 p-5 bg-slate-50/40">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-xs font-black text-gray-800 uppercase tracking-wide">
                      Tabel Rekapitulasi & Komparasi Minat Antar Kelas Asal
                    </h4>
                    <p className="text-[11px] text-gray-500">
                      Perbandingan rata-rata dimensi RIASEC tiap kelas asal untuk acuan perancangan rombel paket XI.
                    </p>
                  </div>
                </div>

                <div className="table-wrap bg-white rounded-xl border border-gray-200">
                  <table>
                    <thead>
                      <tr>
                        <th>Kelas Asal</th>
                        <th>Total Siswa</th>
                        <th>Tes Terisi</th>
                        <th>Dominan</th>
                        <th>R (Realistik)</th>
                        <th>I (Investigatif)</th>
                        <th>A (Artistik)</th>
                        <th>S (Sosial)</th>
                        <th>E (Enterprising)</th>
                        <th>C (Konvensional)</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classBreakdown.map((c) => {
                        const isSelected = selectedClass === c.className;
                        const domMeta = RIASEC_META[c.dominantTrait] || RIASEC_META.I;

                        return (
                          <tr
                            key={c.className}
                            className={isSelected ? 'bg-indigo-50/60 font-semibold' : ''}
                          >
                            <td className="font-extrabold text-gray-900">
                              {c.className}
                              {isSelected && (
                                <span className="ml-1.5 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                                  Aktif
                                </span>
                              )}
                            </td>
                            <td>{c.totalStudents} siswa</td>
                            <td>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                                {c.testedStudents} siswa
                              </span>
                            </td>
                            <td>
                              <span
                                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-black"
                                style={{ backgroundColor: `${domMeta.color}15`, color: domMeta.color }}
                              >
                                {domMeta.icon} {c.dominantTrait} ({domMeta.label.split(' ')[0]})
                              </span>
                            </td>
                            <td className="font-mono text-xs">{formatScore(c.averages.R)}</td>
                            <td className="font-mono text-xs">{formatScore(c.averages.I)}</td>
                            <td className="font-mono text-xs">{formatScore(c.averages.A)}</td>
                            <td className="font-mono text-xs">{formatScore(c.averages.S)}</td>
                            <td className="font-mono text-xs">{formatScore(c.averages.E)}</td>
                            <td className="font-mono text-xs">{formatScore(c.averages.C)}</td>
                            <td>
                              <Button
                                variant={isSelected ? 'primary' : 'ghost'}
                                className="text-xs h-7 px-2"
                                onClick={() => setSelectedClass(c.className)}
                              >
                                {isSelected ? '✓ Terpilih' : 'Lihat Grafik'}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GRAFIK KECOCOKAN HASIL PLACEMENT DENGAN RIASEC SISWA */}
        {activeTab === 'FIT' && (
          <div className="p-6 space-y-6">
            {/* TOP HEADER & CONTEXT */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎯</span>
                  <h3 className="text-base font-black text-gray-900 tracking-tight">
                    Tingkat Keselarasan Hasil Placement vs Profil Minat Bakat RIASEC
                  </h3>
                  <span className="badge bg-emerald-100 text-emerald-800 font-extrabold text-[11px]">
                    Kurikulum Merdeka
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Visualisasi analitik untuk mengukur seberapa linear penempatan paket kelas XI dengan kecenderungan minat alami siswa.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/admin/placement"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 border border-indigo-200 transition"
                >
                  <span>⚙️ Kelola Placement</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            {/* DUAL VISUALIZER: SVG DONUT RING CHART + DIAGNOSTIC CARDS */}
            <div className="grid gap-6 lg:grid-cols-12 items-stretch">
              {/* LEFT / DONUT CHART CARD */}
              <div className="lg:col-span-5 rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/50 p-5 flex flex-col justify-between shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <span className="text-xs font-black text-gray-800 uppercase tracking-wide">
                    Distribusi Keselarasan Siswa
                  </span>
                  <span className="text-[11px] font-bold text-gray-500 font-mono">
                    {placementRiasecFit?.totalPlacedWithRiasec ?? 0} Siswa Terplot
                  </span>
                </div>

                {/* SVG DONUT RING GAUGE */}
                {(() => {
                  const highPct = placementRiasecFit?.highFitPercentage ?? 0;
                  const medPct = placementRiasecFit?.mediumFitPercentage ?? 0;
                  const lowPct = placementRiasecFit?.lowFitPercentage ?? 0;
                  const C = 2 * Math.PI * 54; // ~339.292
                  const lenHigh = (highPct / 100) * C;
                  const lenMed = (medPct / 100) * C;
                  const lenLow = (lowPct / 100) * C;
                  const avgScore = placementRiasecFit?.averageAlignmentScore ?? 0;

                  return (
                    <div className="relative my-4 flex flex-col items-center justify-center">
                      <svg className="w-52 h-52 -rotate-90 transform" viewBox="0 0 200 200">
                        {/* Background track circle */}
                        <circle
                          cx="100"
                          cy="100"
                          r="54"
                          stroke="#e2e8f0"
                          strokeWidth="20"
                          fill="transparent"
                        />

                        {/* High Fit Arc (Emerald) */}
                        {highPct > 0 && (
                          <circle
                            cx="100"
                            cy="100"
                            r="54"
                            stroke="#10b981"
                            strokeWidth="20"
                            strokeDasharray={`${lenHigh} ${C - lenHigh}`}
                            strokeDashoffset={0}
                            strokeLinecap="round"
                            fill="transparent"
                            className="cursor-pointer transition-all duration-300 hover:opacity-80"
                            onMouseEnter={() => setHoveredFitSegment('HIGH')}
                            onMouseLeave={() => setHoveredFitSegment(null)}
                          />
                        )}

                        {/* Medium Fit Arc (Sky) */}
                        {medPct > 0 && (
                          <circle
                            cx="100"
                            cy="100"
                            r="54"
                            stroke="#0ea5e9"
                            strokeWidth="20"
                            strokeDasharray={`${lenMed} ${C - lenMed}`}
                            strokeDashoffset={-lenHigh}
                            strokeLinecap="round"
                            fill="transparent"
                            className="cursor-pointer transition-all duration-300 hover:opacity-80"
                            onMouseEnter={() => setHoveredFitSegment('MEDIUM')}
                            onMouseLeave={() => setHoveredFitSegment(null)}
                          />
                        )}

                        {/* Low Fit Arc (Amber) */}
                        {lowPct > 0 && (
                          <circle
                            cx="100"
                            cy="100"
                            r="54"
                            stroke="#f59e0b"
                            strokeWidth="20"
                            strokeDasharray={`${lenLow} ${C - lenLow}`}
                            strokeDashoffset={-(lenHigh + lenMed)}
                            strokeLinecap="round"
                            fill="transparent"
                            className="cursor-pointer transition-all duration-300 hover:opacity-80"
                            onMouseEnter={() => setHoveredFitSegment('LOW')}
                            onMouseLeave={() => setHoveredFitSegment(null)}
                          />
                        )}
                      </svg>

                      {/* DONUT CENTER STATS */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                        {hoveredFitSegment === 'HIGH' ? (
                          <div className="animate-fadeIn">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                              Sangat Selaras
                            </span>
                            <div className="text-2xl font-black text-emerald-700 mt-1">
                              {placementRiasecFit?.highFitCount ?? 0}
                              <span className="text-xs font-bold text-gray-500 ml-1">Siswa</span>
                            </div>
                            <span className="text-[11px] font-black text-emerald-600">
                              {formatScore(highPct)}% dari total
                            </span>
                          </div>
                        ) : hoveredFitSegment === 'MEDIUM' ? (
                          <div className="animate-fadeIn">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                              Cukup Selaras
                            </span>
                            <div className="text-2xl font-black text-sky-700 mt-1">
                              {placementRiasecFit?.mediumFitCount ?? 0}
                              <span className="text-xs font-bold text-gray-500 ml-1">Siswa</span>
                            </div>
                            <span className="text-[11px] font-black text-sky-600">
                              {formatScore(medPct)}% dari total
                            </span>
                          </div>
                        ) : hoveredFitSegment === 'LOW' ? (
                          <div className="animate-fadeIn">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Perlu Bimbingan BK
                            </span>
                            <div className="text-2xl font-black text-amber-700 mt-1">
                              {placementRiasecFit?.lowFitCount ?? 0}
                              <span className="text-xs font-bold text-gray-500 ml-1">Siswa</span>
                            </div>
                            <span className="text-[11px] font-black text-amber-600">
                              {formatScore(lowPct)}% dari total
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">
                              Indeks Keselarasan
                            </span>
                            <div className="text-3xl font-black text-gray-900 mt-0.5 tracking-tight">
                              {formatScore(avgScore)}%
                            </div>
                            <span
                              className={`inline-block mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                avgScore >= 75
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : avgScore >= 60
                                  ? 'bg-sky-50 text-sky-700 border-sky-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}
                            >
                              {avgScore >= 75 ? '🌟 Sangat Optimal' : avgScore >= 60 ? '⚖️ Cukup Baik' : '⚠️ Perlu Evaluasi'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* INTERACTIVE LEGEND PILLS */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100 text-center">
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredFitSegment('HIGH')}
                    onMouseLeave={() => setHoveredFitSegment(null)}
                    className={`rounded-xl p-2 transition text-left ${
                      hoveredFitSegment === 'HIGH' ? 'bg-emerald-100/80 ring-2 ring-emerald-400' : 'bg-emerald-50/50 hover:bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                      <span className="text-[10px] font-bold text-emerald-950 uppercase truncate">Selaras</span>
                    </div>
                    <div className="text-sm font-black text-emerald-800 mt-1">
                      {placementRiasecFit?.highFitCount ?? 0}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-600">
                      {formatScore(placementRiasecFit?.highFitPercentage)}%
                    </div>
                  </button>

                  <button
                    type="button"
                    onMouseEnter={() => setHoveredFitSegment('MEDIUM')}
                    onMouseLeave={() => setHoveredFitSegment(null)}
                    className={`rounded-xl p-2 transition text-left ${
                      hoveredFitSegment === 'MEDIUM' ? 'bg-sky-100/80 ring-2 ring-sky-400' : 'bg-sky-50/50 hover:bg-sky-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-sky-500 shrink-0"></span>
                      <span className="text-[10px] font-bold text-sky-950 uppercase truncate">Sedang</span>
                    </div>
                    <div className="text-sm font-black text-sky-800 mt-1">
                      {placementRiasecFit?.mediumFitCount ?? 0}
                    </div>
                    <div className="text-[10px] font-bold text-sky-600">
                      {formatScore(placementRiasecFit?.mediumFitPercentage)}%
                    </div>
                  </button>

                  <button
                    type="button"
                    onMouseEnter={() => setHoveredFitSegment('LOW')}
                    onMouseLeave={() => setHoveredFitSegment(null)}
                    className={`rounded-xl p-2 transition text-left ${
                      hoveredFitSegment === 'LOW' ? 'bg-amber-100/80 ring-2 ring-amber-400' : 'bg-amber-50/50 hover:bg-amber-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0"></span>
                      <span className="text-[10px] font-bold text-amber-950 uppercase truncate">Perlu BK</span>
                    </div>
                    <div className="text-sm font-black text-amber-800 mt-1">
                      {placementRiasecFit?.lowFitCount ?? 0}
                    </div>
                    <div className="text-[10px] font-bold text-amber-600">
                      {formatScore(placementRiasecFit?.lowFitPercentage)}%
                    </div>
                  </button>
                </div>
              </div>

              {/* RIGHT / DIAGNOSTICS & KPI TIERS */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                {/* 3 TIERS CARDS */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900">
                        Linearitas Tinggi
                      </span>
                      <span className="text-base">🌟</span>
                    </div>
                    <div className="text-2xl font-black text-emerald-800 mt-2">
                      {placementRiasecFit?.highFitCount ?? 0}
                      <span className="text-xs font-bold text-emerald-600 ml-1">
                        ({formatScore(placementRiasecFit?.highFitPercentage)}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-1 leading-snug">
                      Siswa ditempatkan pada paket kelas yang linear dengan bakat minat utama RIASEC.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-sky-900">
                        Minat Sekunder
                      </span>
                      <span className="text-base">⚖️</span>
                    </div>
                    <div className="text-2xl font-black text-sky-800 mt-2">
                      {placementRiasecFit?.mediumFitCount ?? 0}
                      <span className="text-xs font-bold text-sky-600 ml-1">
                        ({formatScore(placementRiasecFit?.mediumFitPercentage)}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-sky-700 mt-1 leading-snug">
                      Siswa memiliki fleksibilitas belajar yang baik dan minat sekunder yang mendukung.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                        Pendampingan BK
                      </span>
                      <span className="text-base">🤝</span>
                    </div>
                    <div className="text-2xl font-black text-amber-800 mt-2">
                      {placementRiasecFit?.lowFitCount ?? 0}
                      <span className="text-xs font-bold text-amber-700 ml-1">
                        ({formatScore(placementRiasecFit?.lowFitPercentage)}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-1 leading-snug">
                      Terdapat divergensi minat vs kelas karena kuota/nilai, butuh bimbingan adaptasi.
                    </p>
                  </div>
                </div>

                {/* STACKED GLOBAL DISTRIBUTION BAR */}
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-800">
                      Rasio Kumulatif Keselarasan Angkatan:
                    </span>
                    <span className="text-xs font-mono font-black text-gray-600">
                      {placementRiasecFit?.highFitCount} Selaras · {placementRiasecFit?.mediumFitCount} Sedang · {placementRiasecFit?.lowFitCount} Butuh BK
                    </span>
                  </div>

                  <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden flex shadow-inner">
                    <div
                      style={{ width: `${placementRiasecFit?.highFitPercentage ?? 0}%` }}
                      className="bg-emerald-500 h-full transition-all duration-500 flex items-center justify-center text-[10px] font-black text-white"
                      title={`Sangat Selaras: ${placementRiasecFit?.highFitCount} siswa (${formatScore(placementRiasecFit?.highFitPercentage)}%)`}
                    >
                      {(placementRiasecFit?.highFitPercentage ?? 0) > 12 ? `${formatScore(placementRiasecFit?.highFitPercentage)}%` : ''}
                    </div>
                    <div
                      style={{ width: `${placementRiasecFit?.mediumFitPercentage ?? 0}%` }}
                      className="bg-sky-500 h-full transition-all duration-500 flex items-center justify-center text-[10px] font-black text-white"
                      title={`Cukup Selaras: ${placementRiasecFit?.mediumFitCount} siswa (${formatScore(placementRiasecFit?.mediumFitPercentage)}%)`}
                    >
                      {(placementRiasecFit?.mediumFitPercentage ?? 0) > 12 ? `${formatScore(placementRiasecFit?.mediumFitPercentage)}%` : ''}
                    </div>
                    <div
                      style={{ width: `${placementRiasecFit?.lowFitPercentage ?? 0}%` }}
                      className="bg-amber-500 h-full transition-all duration-500 flex items-center justify-center text-[10px] font-black text-white"
                      title={`Perlu Pendampingan: ${placementRiasecFit?.lowFitCount} siswa (${formatScore(placementRiasecFit?.lowFitPercentage)}%)`}
                    >
                      {(placementRiasecFit?.lowFitPercentage ?? 0) > 12 ? `${formatScore(placementRiasecFit?.lowFitPercentage)}%` : ''}
                    </div>
                  </div>
                </div>

                {/* DIAGNOSTIC SUMMARY CALLOUT */}
                <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-teal-50/40 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">💡</span>
                    <div>
                      <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                        Rekomendasi Kebijakan Kurikulum Merdeka
                      </h4>
                      <p className="text-xs text-indigo-900 mt-1 leading-relaxed">
                        {(placementRiasecFit?.averageAlignmentScore ?? 0) >= 75
                          ? 'Tingkat keselarasan penempatan kelas sangat optimal. Sebagian besar siswa berada di ekosistem belajar yang sesuai dengan potensi minat alaminya.'
                          : (placementRiasecFit?.averageAlignmentScore ?? 0) >= 60
                          ? 'Tingkat keselarasan cukup baik. Guru BK dan Wali Kelas disarankan memfasilitasi bimbingan orientasi karier di kelas-kelas dengan minat campuran.'
                          : 'Tingkat divergensi minat cukup signifikan. Disarankan melakukan simulasi ulang dengan menaikkan bobot RIASEC pada scoring profile.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CLASS PACKAGE FIT BREAKDOWN BARS WITH CLUSTER FILTER */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-100">
                <div>
                  <h4 className="text-xs font-black text-gray-800 uppercase tracking-wide flex items-center gap-2">
                    <span>📊</span>
                    <span>Tingkat Keselarasan Minat RIASEC Per Rombel Paket Kelas XI</span>
                  </h4>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Evaluasi kesesuaian komposisi siswa di tiap kelas paket peminatan dengan fokus disiplin keilmuan.
                  </p>
                </div>

                {/* CLUSTER FILTER PILLS */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFitClusterFilter('ALL')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      fitClusterFilter === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Semua Paket ({placementRiasecFit?.packageFitList?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitClusterFilter('SAINS')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      fitClusterFilter === 'SAINS'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    🔬 Sains MIPA
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitClusterFilter('SOSIAL')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      fitClusterFilter === 'SOSIAL'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    📈 Sosial & Bisnis
                  </button>
                  <button
                    type="button"
                    onClick={() => setFitClusterFilter('CAMPURAN')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      fitClusterFilter === 'CAMPURAN'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                    }`}
                  >
                    🌐 Multidisiplin
                  </button>
                </div>
              </div>

              {/* HORIZONTAL GAUGE CARDS GRID */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPackageFitList.map((p) => {
                  const domMeta = RIASEC_META[p.dominantTrait] || RIASEC_META.I;
                  const testedTotal = p.testedPlaced || 1;
                  const highRatio = (p.highFit / testedTotal) * 100;
                  const medRatio = (p.mediumFit / testedTotal) * 100;
                  const lowRatio = (p.lowFit / testedTotal) * 100;

                  return (
                    <div
                      key={p.className}
                      className="rounded-xl border border-gray-200 p-4 bg-gray-50/40 hover:bg-white hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div>
                        {/* Header Class & Score */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-gray-900">{p.className}</span>
                              <span className="badge bg-indigo-100 text-indigo-900 font-bold text-[10px]">
                                {p.packageTitle}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-1.5">
                              <span>Dominan:</span>
                              <span className="font-bold text-gray-800 inline-flex items-center gap-1">
                                <span>{domMeta.icon}</span>
                                <span>{p.dominantTrait} ({domMeta.label.split(' ')[0]})</span>
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div
                              className={`text-lg font-black ${
                                p.averageFitScore >= 75
                                  ? 'text-emerald-700'
                                  : p.averageFitScore >= 60
                                  ? 'text-sky-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {formatScore(p.averageFitScore)}%
                            </div>
                            <span className="text-[10px] font-bold text-gray-400">Skor Keselarasan</span>
                          </div>
                        </div>

                        {/* Visual Linear Progress Bar */}
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden flex shadow-inner">
                            <div
                              style={{ width: `${highRatio}%` }}
                              className="bg-emerald-500 h-full transition-all"
                              title={`Sangat Selaras: ${p.highFit} siswa (${formatScore(highRatio)}%)`}
                            />
                            <div
                              style={{ width: `${medRatio}%` }}
                              className="bg-sky-500 h-full transition-all"
                              title={`Cukup Selaras: ${p.mediumFit} siswa (${formatScore(medRatio)}%)`}
                            />
                            <div
                              style={{ width: `${lowRatio}%` }}
                              className="bg-amber-500 h-full transition-all"
                              title={`Kurang Selaras: ${p.lowFit} siswa (${formatScore(lowRatio)}%)`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Breakdown */}
                      <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500 font-medium">
                        <span className="text-emerald-700 font-bold">✓ {p.highFit} Selaras</span>
                        <span className="text-sky-700 font-bold">~ {p.mediumFit} Sedang</span>
                        <span className={p.lowFit > 0 ? 'text-amber-700 font-black' : 'text-gray-400'}>
                          {p.lowFit > 0 ? `⚠️ ${p.lowFit} Butuh BK` : '0 Butuh BK'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIASEC TO EDUPATH CURRICULUM CORRELATION GUIDE */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">🧭</span>
                <h4 className="text-xs font-black text-gray-800 uppercase tracking-wide">
                  Matriks Korelasi Domain Minat RIASEC dengan Rumpun Mapel Peminatan
                </h4>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(RIASEC_META).map(([key, meta]) => (
                  <div
                    key={key}
                    className={`rounded-xl border p-3.5 transition ${meta.bg}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{meta.icon}</span>
                      <div>
                        <div className="font-black text-xs">{meta.name}</div>
                        <div className="text-[10px] font-bold opacity-80">{meta.label}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] leading-snug opacity-90">
                      <b>Rumpun Kelas:</b> {meta.track}
                    </div>
                    <p className="mt-1 text-[10px] opacity-75 line-clamp-2">
                      {meta.focus}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* BK COUNSELING & DIVERGENT STUDENTS TABLE */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                      Daftar Siswa Butuh Pendampingan Guru BK (Divergensi Minat vs Penempatan)
                    </h4>
                  </div>
                  <p className="text-xs text-amber-900 mt-0.5">
                    Siswa berikut memiliki tipe RIASEC berbeda dari profil utama paket kelas. Direkomendasikan dilakukan bimbingan adaptasi belajar.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="badge bg-amber-200 text-amber-900 font-extrabold text-xs">
                    {filteredDivergentStudents.length} Siswa Terfilter
                  </span>
                </div>
              </div>

              {/* SEARCH & FILTER CONTROLS */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    value={divergentSearch}
                    onChange={(e) => setDivergentSearch(e.target.value)}
                    placeholder="Cari nama, NIS, paket..."
                    className="w-full text-xs rounded-xl border border-amber-300 bg-white px-3 py-2 pl-8 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
                </div>

                <div className="w-full sm:w-48">
                  <select
                    value={divergentClassFilter}
                    onChange={(e) => setDivergentClassFilter(e.target.value)}
                    className="w-full text-xs rounded-xl border border-amber-300 bg-white px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                  >
                    <option value="ALL">Semua Kelas Terplot</option>
                    {divergentClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        Kelas {cls}
                      </option>
                    ))}
                  </select>
                </div>

                {(divergentSearch || divergentClassFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setDivergentSearch('');
                      setDivergentClassFilter('ALL');
                    }}
                    className="text-xs text-amber-800 font-bold hover:underline shrink-0"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              {/* TABLE */}
              {filteredDivergentStudents.length > 0 ? (
                <div className="table-wrap bg-white rounded-xl border border-amber-200">
                  <table>
                    <thead>
                      <tr>
                        <th>NIS</th>
                        <th>Nama Siswa</th>
                        <th>Kelas Terplot</th>
                        <th>Paket Kelas</th>
                        <th>Tipe RIASEC</th>
                        <th>Skor Fit</th>
                        <th>Catatan Pendampingan BK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDivergentStudents.map((s) => (
                        <tr key={s.id}>
                          <td className="font-mono text-xs">{s.nis}</td>
                          <td className="font-bold text-gray-900">{s.name}</td>
                          <td>
                            <span className="badge bg-blue-100 text-blue-900 font-bold">
                              {s.placedClass}
                            </span>
                          </td>
                          <td className="text-xs text-gray-800">{s.packageTitle}</td>
                          <td>
                            <span className="font-mono text-xs font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                              {s.dominantTraits}
                            </span>
                          </td>
                          <td>
                            <span className="font-bold text-amber-700 font-mono text-xs bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              {formatScore(s.fitScore)}%
                            </span>
                          </td>
                          <td className="text-xs text-gray-600 leading-snug">{s.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center bg-white rounded-xl border border-amber-200 text-gray-500">
                  <span className="text-3xl">✨</span>
                  <div className="mt-2 text-xs font-bold text-gray-700">
                    Tidak ada siswa yang memerlukan pendampingan khusus pada filter ini.
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Semua penempatan siswa telah selaras dengan minat atau filter pencarian tidak menemukan hasil.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* PLACEMENT READINESS & PROGRESS BANNER */}
      <Card className="bg-gradient-to-r from-[#10285f] to-[#1c4096] text-white p-6 relative overflow-hidden">
        <div className="relative z-10 grid gap-6 md:grid-cols-3 items-center">
          <div className="md:col-span-2 space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-xs px-3 py-1 text-xs font-semibold text-blue-200">
              <span>🎯 Status Penempatan Siswa Kelas XI</span>
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">
              {placementRate}% Siswa Telah Ditempatkan ke Rombel XI
            </h3>
            <p className="text-xs text-blue-100 max-w-xl leading-relaxed">
              Sebanyak <b>{placedStudents}</b> dari <b>{totalStudents}</b> siswa telah dialokasikan ke kelas paket peminatan. 
              {unplacedStudents > 0
                ? ` Masih ada ${unplacedStudents} siswa yang belum mendapatkan kelas atau butuh review manual.`
                : ' Seluruh siswa telah berhasil mendapatkan kelas XI.'}
            </p>

            <div className="pt-2">
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden backdrop-blur-xs">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${placementRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row md:flex-col justify-center items-stretch">
            <Link
              href="/admin/placement"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#10285f] shadow-md hover:bg-blue-50 transition active:scale-95 text-center"
            >
              <span>Kelola Plotting & Placement</span>
              <span>→</span>
            </Link>
            <Link
              href="/admin/selection"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition active:scale-95 text-center"
            >
              <span>Jalankan Simulasi Seleksi</span>
            </Link>
          </div>
        </div>
      </Card>

      {/* PIPELINE & WORKFLOW QUICK ACCESS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-gray-800 tracking-wide uppercase">
              Alur Kerja Penjurusan EduPath XI
            </h2>
            <p className="text-xs text-gray-500">
              Akses cepat setiap tahapan proses peminatan dari persiapan data hingga finalisasi penempatan.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {workflowSteps.map((s) => (
            <Link
              key={s.step}
              href={s.href}
              className="group block focus:outline-hidden"
            >
              <Card className="h-full border border-gray-200 transition duration-200 hover:border-[#2457d6] hover:shadow-md bg-white p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#10285f] text-white text-xs font-black">
                      {s.step}
                    </span>
                    <span className="text-lg">{s.icon}</span>
                  </div>

                  <div className="mt-3">
                    <h4 className="font-black text-sm text-gray-900 group-hover:text-[#2457d6] transition">
                      {s.title}
                    </h4>
                    <span className="inline-block mt-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                      {s.tag}
                    </span>
                    <p className="mt-2 text-[11px] text-gray-500 leading-normal">
                      {s.subtitle}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-600 group-hover:text-[#2457d6]">
                  <span>Masuk Menu</span>
                  <span className="transform transition-transform group-hover:translate-x-1">→</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
