'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser, logout } from '@/lib/api';
import { Button, Card, Input, Label, Modal, Select } from '@/components/ui';

interface RiasecDimension {
  key: string;
  name: string;
  shortName: string;
  color: string;
  score: number;
  description: string;
  tendencies: string;
}

function RiasecRadarChart({ riasec }: { riasec: any }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const r = Number(riasec?.rScore ?? 0);
  const i = Number(riasec?.iScore ?? 0);
  const a = Number(riasec?.aScore ?? 0);
  const s = Number(riasec?.sScore ?? 0);
  const e = Number(riasec?.eScore ?? 0);
  const c = Number(riasec?.cScore ?? 0);

  const dimensions: RiasecDimension[] = [
    { key: 'R', name: 'Realistic', shortName: 'R (Praktikal)', color: '#2563eb', score: r, description: 'Menyukai aktivitas fisik, mesin, alat praktis, rekayasa, dan eksperimen lapangan.', tendencies: 'Teknik, Fisika, Robotika, Mekatronika' },
    { key: 'I', name: 'Investigative', shortName: 'I (Analitis)', color: '#4f46e5', score: i, description: 'Menyukai riset ilmiah, pemecahan masalah teoritis, analisis data, dan logika matematika.', tendencies: 'Sains, Kedokteran, Riset, Informatika' },
    { key: 'A', name: 'Artistic', shortName: 'A (Kreatif)', color: '#db2777', score: a, description: 'Menyukai ekspresi seni, kreativitas visual, sastra, bahasa, dan ide-ide orisinal.', tendencies: 'Desain, Sastra, Komunikasi, Seni' },
    { key: 'S', name: 'Social', shortName: 'S (Sosial)', color: '#059669', score: s, description: 'Menyukai interaksi kemanusiaan, membantu sesama, mengajar, dan dinamika sosial.', tendencies: 'Psikologi, Hubungan Internasional, Pendidikan' },
    { key: 'E', name: 'Enterprising', shortName: 'E (Bisnis)', color: '#d97706', score: e, description: 'Menyukai inisiatif kepemimpinan, negosiasi bisnis, persuasi, dan pengambilan keputusan.', tendencies: 'Bisnis, Manajemen, Hukum, Ekonomi' },
    { key: 'C', name: 'Conventional', shortName: 'C (Struktur)', color: '#0891b2', score: c, description: 'Menyukai keteraturan, akurasi data, pembukuan, kepatuhan prosedur, dan sistem rapi.', tendencies: 'Akuntansi, Administrasi, Analisis Data' },
  ];

  // Radar geometry
  const size = 300;
  const center = size / 2;
  const radius = 100;
  const numAxes = dimensions.length;

  // Concentric levels (20%, 40%, 60%, 80%, 100%)
  const levels = [0.2, 0.4, 0.6, 0.8, 1.0];

  const getCoordinates = (angleIndex: number, scale: number) => {
    const angle = -Math.PI / 2 + (angleIndex * 2 * Math.PI) / numAxes;
    return {
      x: center + radius * scale * Math.cos(angle),
      y: center + radius * scale * Math.sin(angle),
    };
  };

  // Polygon points for student data
  const dataPoints = dimensions.map((dim, idx) => {
    const normalizedScore = Math.max(5, Math.min(100, dim.score)) / 100;
    return getCoordinates(idx, normalizedScore);
  });

  const polygonPath = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // Dominant trait detection
  const dominantTraits = riasec.dominantTraits || [...dimensions].sort((x, y) => y.score - x.score).slice(0, 3).map((d) => d.key).join('');

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
      {/* SVG Radar Chart */}
      <div className="relative flex flex-col items-center justify-center p-2">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible select-none">
          <defs>
            <linearGradient id="riasecGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.3" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Concentric grid rings */}
          {levels.map((level, lIdx) => {
            const levelPoints = dimensions
              .map((_, idx) => {
                const pt = getCoordinates(idx, level);
                return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
              })
              .join(' ');

            return (
              <polygon
                key={lIdx}
                points={levelPoints}
                fill={lIdx === levels.length - 1 ? '#f8fafc' : 'none'}
                stroke="#e2e8f0"
                strokeWidth={lIdx === levels.length - 1 ? '1.5' : '1'}
                strokeDasharray={lIdx === levels.length - 1 ? 'none' : '2,2'}
              />
            );
          })}

          {/* Grid lines from center to vertices */}
          {dimensions.map((_, idx) => {
            const endPt = getCoordinates(idx, 1.0);
            return (
              <line
                key={idx}
                x1={center}
                y1={center}
                x2={endPt.x}
                y2={endPt.y}
                stroke="#cbd5e1"
                strokeWidth="1"
              />
            );
          })}

          {/* Student Data Area (Filled Polygon) */}
          <polygon
            points={polygonPath}
            fill="url(#riasecGradient)"
            stroke="#6366f1"
            strokeWidth="2.5"
            filter="url(#glow)"
            className="transition-all duration-300"
          />

          {/* Axis Vertex Markers & Labels */}
          {dimensions.map((dim, idx) => {
            const pt = dataPoints[idx];
            const labelPt = getCoordinates(idx, 1.22);
            const isHovered = hoveredIndex === idx;

            return (
              <g key={dim.key}>
                {/* Connecting point marker */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 4.5}
                  fill={dim.color}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />

                {/* Dimension label around chart */}
                <text
                  x={labelPt.x}
                  y={labelPt.y + 4}
                  textAnchor="middle"
                  className={`text-[11px] font-bold transition cursor-pointer ${
                    isHovered ? 'fill-indigo-950 font-black scale-110' : 'fill-gray-700'
                  }`}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  {dim.key} ({dim.score})
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-gray-500">
          <span>🎯 Tipe Dominan Anda:</span>
          <span className="rounded bg-purple-100 px-2 py-0.5 font-black text-purple-900">{dominantTraits}</span>
        </div>
      </div>

      {/* Breakdown Cards & Narrative */}
      <div className="flex-1 space-y-2.5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {dimensions.map((dim, idx) => {
            const isTop = dominantTraits.includes(dim.key);
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={dim.key}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`cursor-pointer rounded-xl border p-2.5 transition ${
                  isHovered
                    ? 'border-indigo-500 bg-indigo-50/60 shadow-xs'
                    : isTop
                    ? 'border-purple-200 bg-purple-50/30'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800">{dim.shortName}</span>
                  <span
                    className="text-xs font-black"
                    style={{ color: dim.color }}
                  >
                    {dim.score}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, dim.score))}%`, backgroundColor: dim.color }}
                  />
                </div>
                <div className="mt-1 truncate text-[10px] text-gray-500" title={dim.tendencies}>
                  {dim.tendencies}
                </div>
              </div>
            );
          })}
        </div>

        {/* Narrative Box */}
        <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-3 text-xs text-purple-950">
          <div className="flex items-center gap-1.5 font-bold">
            <span>💡</span>
            <span>Interpretasi Minat Karir & Pilihan Mapel:</span>
          </div>
          <p className="mt-1 leading-relaxed text-purple-900/90">
            Hasil tes RIASEC Anda memperlihatkan keunggulan pada orientasi{' '}
            <b>{dimensions.filter((d) => dominantTraits.includes(d.key)).map((d) => d.name).join(', ')}</b>.
            Pilihan paket kelas XI yang memuat mata pelajaran analitis, praktikal sains, atau sosio-humaniora yang selaras dengan dimensi ini akan dihitung dengan skor kecocokan lebih tinggi.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function StudentPortal() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [recommendationsData, setRecommendationsData] = useState<any>(null);
  const [choices, setChoices] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [expandedRecId, setExpandedRecId] = useState<number | null>(null);
  const [packageSearch, setPackageSearch] = useState('');
  const [packageSort, setPackageSort] = useState<'class' | 'score' | 'title' | 'capacity'>('class');
  const [packageFilter, setPackageFilter] = useState<'ALL' | 'SELECTED' | 'UNSELECTED'>('ALL');

  async function load() {
    try {
      const [p, pk, rec] = await Promise.all([
        api('/student/profile'),
        api<any[]>('/student/packages'),
        api<any>('/student/recommendations').catch(() => null),
      ]);
      setProfile(p);
      const sortedPk = (pk || []).sort((a: any, b: any) =>
        (a.class?.name ?? '').localeCompare(b.class?.name ?? '', undefined, {
          numeric: true,
          sensitivity: 'base',
        }),
      );
      setPackages(sortedPk);
      setRecommendationsData(rec);
      const existingChoices = p.preference?.choices?.map((x: any) => x.packageId) ?? [];
      setChoices(existingChoices);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'STUDENT') {
      router.replace('/login');
      return;
    }
    load();
  }, [router]);

  const locked = Boolean(profile?.preference?.isLocked);
  const maxChoices = Number(profile?.academicYear?.policy?.maxChoices ?? 3);

  function toggleChoice(packageId: number) {
    if (locked) return;
    setError('');
    setMessage('');
    setChoices((prev) => {
      if (prev.includes(packageId)) {
        return prev.filter((id) => id !== packageId);
      }
      if (prev.length >= maxChoices) {
        setError(`Maksimal pilihan adalah ${maxChoices} paket kelas.`);
        return prev;
      }
      return [...prev, packageId];
    });
  }

  function addRecommendedChoice(packageId: number) {
    if (locked) return;
    if (choices.includes(packageId)) {
      setMessage('Paket ini sudah ada di dalam daftar pilihan Anda.');
      return;
    }
    if (choices.length >= maxChoices) {
      setError(`Maksimal pilihan adalah ${maxChoices} paket kelas. Batalkan salah satu pilihan terlebih dahulu jika ingin mengganti.`);
      return;
    }
    setChoices((prev) => [...prev, packageId]);
    setMessage('Paket berhasil ditambahkan ke daftar prioritas pilihan Anda. Jangan lupa klik "Simpan Sementara" atau "Konfirmasi & Kunci".');
  }

  function moveUp(index: number) {
    if (locked || index <= 0) return;
    setChoices((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  }

  function moveDown(index: number) {
    if (locked || index >= choices.length - 1) return;
    setChoices((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
  }

  async function savePreferences() {
    if (!choices.length) {
      setError('Pilih minimal 1 paket kelas.');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api('/student/preferences', {
        method: 'PUT',
        body: JSON.stringify({ packageIds: choices }),
      });
      setMessage('Pilihan sementara berhasil disimpan. Jangan lupa klik "Konfirmasi & Kunci" jika sudah yakin.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmPreferences() {
    if (!choices.length) {
      setError('Pilih minimal 1 paket kelas sebelum melakukan konfirmasi.');
      return;
    }
    if (!confirm('Apakah Anda yakin ingin mengonfirmasi dan mengunci pilihan ini? Setelah dikonfirmasi, pilihan TIDAK DAPAT diubah lagi kecuali dibuka oleh Admin.')) {
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api('/student/preferences', {
        method: 'PUT',
        body: JSON.stringify({ packageIds: choices }),
      });
      const r: any = await api('/student/preferences/confirm', { method: 'POST' });
      setMessage(r.message);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!pw.currentPassword || !pw.newPassword) {
      setError('Semua kolom password wajib diisi.');
      return;
    }
    try {
      const r: any = await api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(pw),
      });
      setPasswordOpen(false);
      setPw({ currentPassword: '', newPassword: '' });
      setMessage(r.message);
      setProfile((prev: any) =>
        prev
          ? {
              ...prev,
              user: { ...(prev.user || {}), mustChangePassword: false },
            }
          : prev,
      );
    } catch (e: any) {
      setError(e.message);
    }
  }

  const recommendations = recommendationsData?.recommendations ?? [];
  const riasecData = profile?.riasecScore ?? null;

  const sortedAndFilteredPackages = useMemo(() => {
    const recMap = new Map<number, number>();
    recommendations.forEach((r: any) => {
      recMap.set(r.packageId, Number(r.estimatedScore ?? 0));
    });

    const result = packages.filter((p) => {
      const isSelected = choices.includes(p.id);
      if (packageFilter === 'SELECTED' && !isSelected) return false;
      if (packageFilter === 'UNSELECTED' && isSelected) return false;

      if (packageSearch.trim()) {
        const query = packageSearch.toLowerCase().trim();
        const className = (p.class?.name ?? '').toLowerCase();
        const title = (p.title ?? '').toLowerCase();
        const desc = (p.description ?? '').toLowerCase();
        const subjects = (p.subjects || [])
          .map((s: any) => s.subject?.name?.toLowerCase() ?? '')
          .join(' ');

        if (
          !className.includes(query) &&
          !title.includes(query) &&
          !desc.includes(query) &&
          !subjects.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });

    result.sort((a, b) => {
      if (packageSort === 'score') {
        const scoreA = recMap.get(a.id) ?? -1;
        const scoreB = recMap.get(b.id) ?? -1;
        if (scoreB !== scoreA) return scoreB - scoreA;
      } else if (packageSort === 'title') {
        return (a.title ?? '').localeCompare(b.title ?? '', undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      } else if (packageSort === 'capacity') {
        return (b.capacity ?? 0) - (a.capacity ?? 0);
      }

      return (a.class?.name ?? '').localeCompare(b.class?.name ?? '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    return result;
  }, [packages, choices, packageSearch, packageSort, packageFilter, recommendations]);

  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f6f8fc] text-sm text-gray-500">
        Memuat data portal siswa...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8fc]">
      {/* Header */}
      <header className="bg-[#10285f] px-5 py-4 text-white shadow">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-black tracking-tight">EduPath XI · Portal Siswa</h1>
            <div className="text-xs text-blue-200">
              {profile.name} · NIS: <span className="font-mono font-bold text-white">{profile.nis}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="text-xs" onClick={() => setPasswordOpen(true)}>
              Ganti Password
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => {
                logout();
                router.replace('/login');
              }}
            >
              Keluar
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 p-5">
        {/* Warning Banner: Ganti Password Default */}
        {profile.user?.mustChangePassword && (
          <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 via-amber-100/70 to-orange-50 p-4 text-amber-950 shadow-sm animate-fadeIn">
            <div className="flex items-start gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-lg text-white shadow-xs">
                ⚠️
              </span>
              <div>
                <h3 className="font-bold text-sm text-amber-950">
                  Peringatan Keamanan: Anda Belum Mengganti Password Default Akun
                </h3>
                <p className="mt-0.5 text-xs text-amber-900/90 leading-relaxed">
                  Akun Anda masih menggunakan password awal dari sekolah. Demi keamanan akun dan kerahasiaan pilihan paket kelas Anda, <b>mohon segera ganti password Anda</b>.
                </p>
              </div>
            </div>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 h-9 shadow-xs whitespace-nowrap"
              onClick={() => setPasswordOpen(true)}
            >
              🔑 Ganti Password Sekarang
            </Button>
          </div>
        )}

        {/* Flash Messages */}
        {message && (
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800 shadow-sm animate-fadeIn">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="text-xs text-green-700 hover:text-green-900">✕</button>
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800 shadow-sm animate-fadeIn">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-xs text-red-700 hover:text-red-900">✕</button>
          </div>
        )}

        {/* Status Profile Cards */}
        <Card>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-[#667085]">Kelas Asal (Kelas X)</div>
              <div className="mt-1 font-bold text-base text-gray-900">{profile.originClass?.name ?? '-'}</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="text-xs text-[#667085]">Penempatan Kelas XI</div>
              <div className="mt-1 font-bold text-base text-gray-900">
                {profile.placedClass?.name ? (
                  <span className="text-green-700 font-black">{profile.placedClass.name}</span>
                ) : (
                  <span className="text-gray-400 font-normal text-sm">Belum diploting</span>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-xs text-blue-700">Nilai TKA</div>
              <div className="mt-1 font-bold text-base text-blue-900">
                {profile.tkaScore ? Number(profile.tkaScore.score).toFixed(2) : '-'}
              </div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <div className="text-xs text-purple-700">Tipe Dominan RIASEC</div>
              <div className="mt-1 font-black text-base text-purple-950">
                {profile.riasecScore?.dominantTraits || (profile.riasecScore ? 'Aktif' : 'Belum Ada')}
              </div>
            </div>
          </div>

          {/* Alasan Penempatan */}
          {(profile.placedClass || profile.placement?.reason) && (
            <div className="mt-4 pt-3.5 border-t border-gray-100">
              <div className="flex items-start gap-3 rounded-xl bg-blue-50/70 border border-blue-200/80 p-3.5 text-xs text-blue-950">
                <span className="text-base shrink-0">📋</span>
                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-blue-950">
                      Keterangan & Alasan Penempatan Kelas XI:
                    </span>
                    {profile.placement?.status && (
                      <span className={`badge text-[10px] font-bold ${
                        profile.placement.status === 'FINAL'
                          ? 'bg-green-100 text-green-800'
                          : profile.placement.status === 'TEMPORARY'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        Status: {profile.placement.status === 'FINAL'
                          ? 'Resmi (Final)'
                          : profile.placement.status === 'TEMPORARY'
                          ? 'Sementara (Dapat Berubah)'
                          : 'Belum Ditempatkan'}
                      </span>
                    )}
                  </div>
                  <p className="font-medium text-blue-900 leading-relaxed pt-0.5">
                    {profile.placement?.reason || 'Penempatan diproses sesuai prioritas pilihan dan hasil seleksi akademik.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* SECTION: GRAFIK HASIL TES RIASEC SISWA */}
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/40 via-indigo-50/30 to-white shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-purple-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-purple-700 text-sm text-white shadow-xs">
                🎯
              </span>
              <div>
                <h2 className="text-base font-black text-purple-950">
                  Grafik Profil Minat & Bakat RIASEC (Holland Code)
                </h2>
                <p className="text-xs text-purple-800/80">
                  Pemetaan 6 dimensi potensi minat karir Anda: Realistic, Investigative, Artistic, Social, Enterprising, dan Conventional.
                </p>
              </div>
            </div>
            {riasecData?.dominantTraits && (
              <span className="rounded-full border border-purple-300 bg-purple-100 px-3 py-1 text-xs font-black text-purple-900">
                Kode Dominan: {riasecData.dominantTraits}
              </span>
            )}
          </div>

          {riasecData ? (
            <RiasecRadarChart riasec={riasecData} />
          ) : (
            <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/30 p-8 text-center text-sm text-purple-900">
              <p className="font-bold">Data tes RIASEC belum tersedia</p>
              <p className="mt-1 text-xs text-purple-700">
                Pihak sekolah atau Guru BK belum mengunggah hasil tes minat bakat RIASEC Anda. Setelah data diunggah oleh admin, grafik profil minat Anda akan otomatis tampil di sini.
              </p>
            </div>
          )}
        </Card>

        {/* SECTION 1: REKOMENDASI PAKET KELAS (BERBASIS RAPOR, TKA & MINAT RIASEC) */}
        {recommendations.length > 0 && (
          <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-blue-50/40 to-white shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-black text-white">
                    ★
                  </span>
                  <h2 className="text-base font-black text-indigo-950">
                    Rekomendasi Paket Kelas XI untuk Anda
                  </h2>
                </div>
                <p className="mt-0.5 text-xs text-indigo-800/80">
                  Rekomendasi dihitung berdasarkan perpaduan <b>Kecocokan Nilai Rapor</b>, <b>Nilai TKA</b>, dan <b>Kecocokan Minat RIASEC</b> terhadap mata pelajaran yang diseleksikan pada masing-masing paket.
                </p>
              </div>
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-900">
                {recommendations.length} Paket Dianalisis
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {recommendations.slice(0, 3).map((rec: any, idx: number) => {
                const isSelected = choices.includes(rec.packageId);
                const priorityIdx = choices.indexOf(rec.packageId);
                const isExpanded = expandedRecId === rec.packageId;

                const badgeBg =
                  rec.fitLevel === 'SANGAT_COCOK'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : rec.fitLevel === 'COCOK'
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : 'bg-amber-100 text-amber-800 border-amber-300';

                const fitText =
                  rec.fitLevel === 'SANGAT_COCOK'
                    ? '🔥 Sangat Direkomendasikan'
                    : rec.fitLevel === 'COCOK'
                    ? '✨ Sangat Cocok'
                    : '👍 Cocok';

                return (
                  <div
                    key={rec.packageId}
                    className={`flex flex-col justify-between rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-400 bg-indigo-50/20'
                        : 'border-indigo-100 hover:border-indigo-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-900 text-[10px] font-bold text-white">
                              #{idx + 1}
                            </span>
                            <h3 className="font-black text-base text-gray-900">{rec.className}</h3>
                          </div>
                          <div className="text-xs text-gray-500 font-semibold">{rec.packageTitle}</div>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${badgeBg}`}>
                          {fitText}
                        </span>
                      </div>

                      {/* 4 Score Metrics Grid */}
                      <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-gray-50 p-2 text-center text-xs">
                        <div className="rounded-lg bg-white p-1.5 shadow-2xs">
                          <div className="text-[10px] text-gray-500 font-medium">Kecocokan Rapor</div>
                          <div className="font-black text-indigo-700">{rec.academicFit}</div>
                        </div>
                        <div className="rounded-lg bg-white p-1.5 shadow-2xs">
                          <div className="text-[10px] text-gray-500 font-medium">Nilai TKA</div>
                          <div className="font-black text-blue-700">{rec.tkaScore}</div>
                        </div>
                        <div className="rounded-lg bg-purple-50/70 p-1.5 shadow-2xs border border-purple-100">
                          <div className="text-[10px] text-purple-700 font-bold">Minat RIASEC</div>
                          <div className="font-black text-purple-900">{rec.riasecFit ?? 75}</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50/70 p-1.5 shadow-2xs border border-emerald-100">
                          <div className="text-[10px] text-emerald-700 font-bold">Skor Estimasi</div>
                          <div className="font-black text-emerald-900">{rec.estimatedScore}</div>
                        </div>
                      </div>

                      {/* Mapel Pendukung */}
                      {rec.selectionSubjects && rec.selectionSubjects.length > 0 && (
                        <div className="mt-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setExpandedRecId(isExpanded ? null : rec.packageId)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900"
                          >
                            <span>{isExpanded ? '▾ Tutup Detail Mapel' : '▸ Lihat Nilai Mapel Seleksi'}</span>
                          </button>

                          {isExpanded && (
                            <div className="mt-1.5 space-y-1 rounded-lg border border-indigo-100 bg-indigo-50/40 p-2 text-[11px]">
                              {rec.selectionSubjects.map((sub: any, sIdx: number) => (
                                <div key={sIdx} className="flex items-center justify-between text-gray-700">
                                  <span>{sub.subjectName} ({sub.weight}%):</span>
                                  <span className="font-bold text-indigo-950">
                                    {sub.hasScore ? sub.averageScore : 'Belum ada nilai'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t flex items-center justify-between">
                      <span className="text-[11px] text-gray-500">
                        {isSelected ? (
                          <span className="font-bold text-indigo-700">Terpilih (P{priorityIdx + 1})</span>
                        ) : (
                          <span>Sisa {rec.availableCapacity} kursi</span>
                        )}
                      </span>

                      {!locked && (
                        <Button
                          variant={isSelected ? 'secondary' : 'primary'}
                          className="h-7 text-xs px-2.5"
                          disabled={!isSelected && choices.length >= maxChoices}
                          onClick={() => (isSelected ? toggleChoice(rec.packageId) : addRecommendedChoice(rec.packageId))}
                        >
                          {isSelected ? 'Batalkan' : '+ Jadikan Pilihan'}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* SECTION 2: RINGKASAN URUTAN PILIHAN TERPILIH */}
        {choices.length > 0 && (
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h2 className="font-bold text-sm text-blue-950">Urutan Prioritas Pilihan Anda:</h2>
                <p className="text-xs text-gray-500">Pilihan P1 diproses terlebih dahulu dalam seleksi placement.</p>
              </div>
              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-900">
                {choices.length} dari maks {maxChoices} pilihan
              </span>
            </div>
            <div className="space-y-2">
              {choices.map((pkgId, idx) => {
                const pkg = packages.find((p) => p.id === pkgId);
                if (!pkg) return null;
                return (
                  <div
                    key={pkgId}
                    className="flex items-center justify-between rounded-xl border border-blue-200/80 bg-white p-3 shadow-sm transition hover:shadow"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#10285f] text-xs font-black text-white shadow-xs">
                        P{idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-sm text-gray-900">
                          {pkg.class.name} <span className="font-normal text-xs text-gray-500">({pkg.title})</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Kapasitas: {pkg.capacity} siswa
                        </div>
                      </div>
                    </div>
                    {!locked && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveUp(idx)}
                          className="rounded-lg border px-2 py-1 text-xs font-bold disabled:opacity-30 hover:bg-gray-100 transition"
                          title="Naikkan prioritas"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={idx === choices.length - 1}
                          onClick={() => moveDown(idx)}
                          className="rounded-lg border px-2 py-1 text-xs font-bold disabled:opacity-30 hover:bg-gray-100 transition"
                          title="Turunkan prioritas"
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleChoice(pkgId)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition"
                        >
                          Batal
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* SECTION 3: DAFTAR SELURUH PAKET KELAS XI */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10285f] text-xs font-bold text-white">
                  📚
                </span>
                <h2 className="text-xl font-black text-gray-900">Daftar Paket Kelas XI</h2>
              </div>
              <p className="mt-0.5 text-sm text-[#667085]">
                Pilih hingga {maxChoices} paket kelas XI sesuai minat dan bakat Anda.
              </p>
            </div>
            {!locked && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={saving || !choices.length}
                  onClick={savePreferences}
                >
                  💾 Simpan Sementara
                </Button>
                <Button
                  disabled={saving || !choices.length}
                  onClick={confirmPreferences}
                >
                  🔒 Konfirmasi & Kunci Pilihan
                </Button>
              </div>
            )}
          </div>

          {locked && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs font-medium text-amber-900 shadow-xs flex items-center justify-between">
              <div>
                <b>🔒 Pilihan kelas Anda telah dikonfirmasi dan dikunci.</b>
                <p className="mt-0.5 text-amber-800">
                  Jika perlu melakukan perubahan, silakan hubungi Guru BK atau Admin Sekolah agar kunci konfirmasi dapat dibuka kembali di panel admin.
                </p>
              </div>
            </div>
          )}

          {/* Toolbar Urutan & Pencarian Kelas */}
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border bg-white p-3 shadow-2xs">
            <div className="min-w-[200px] flex-1">
              <Label>Cari Kelas / Mata Pelajaran</Label>
              <Input
                placeholder="Cari kelas (misal XI-1), peminatan, mapel..."
                value={packageSearch}
                onChange={(e) => setPackageSearch(e.target.value)}
              />
            </div>

            <div className="min-w-[170px]">
              <Label>Urutkan Daftar Kelas</Label>
              <Select
                value={packageSort}
                onChange={(e) => setPackageSort(e.target.value as any)}
              >
                <option value="class">Urutan Kelas (XI-1, XI-2, ...)</option>
                <option value="score">Skor Rekomendasi Tertinggi</option>
                <option value="title">Nama Peminatan (A-Z)</option>
                <option value="capacity">Kapasitas Kursi Terbesar</option>
              </Select>
            </div>

            <div className="min-w-[150px]">
              <Label>Filter Pilihan</Label>
              <Select
                value={packageFilter}
                onChange={(e) => setPackageFilter(e.target.value as any)}
              >
                <option value="ALL">Semua Kelas ({packages.length})</option>
                <option value="SELECTED">Sudah Dipilih ({choices.length})</option>
                <option value="UNSELECTED">Belum Dipilih ({packages.length - choices.length})</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {sortedAndFilteredPackages.map((p) => {
              const idx = choices.indexOf(p.id);
              const isSelected = idx >= 0;
              const rec = recommendations.find((r: any) => r.packageId === p.id);

              return (
                <Card
                  key={p.id}
                  className={`transition ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50/10'
                      : 'hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#10285f] text-xs font-black text-white shadow-2xs">
                          {p.class.name.replace('XI-', '')}
                        </span>
                        <div>
                          <h3 className="text-lg font-black text-gray-900">{p.class.name}</h3>
                          <div className="text-xs font-semibold text-[#667085]">
                            {p.title} · Kapasitas: {p.capacity} siswa
                          </div>
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <span className="badge bg-blue-700 text-white font-bold">
                        Pilihan {idx + 1}
                      </span>
                    ) : rec ? (
                      <span className="badge bg-indigo-50 text-indigo-900 border border-indigo-200 text-[10px] font-bold">
                        Skor: {rec.estimatedScore}
                      </span>
                    ) : null}
                  </div>

                  {p.description && (
                    <p className="mt-3 text-sm leading-6 text-gray-600">{p.description}</p>
                  )}

                  <div className="mt-3 rounded-lg bg-gray-50 p-2.5 text-xs">
                    <span className="font-bold text-gray-700">Mata Pelajaran Pilihan:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.subjects?.map((x: any) => (
                        <span
                          key={x.id}
                          className="rounded bg-white px-2 py-0.5 font-medium border text-gray-700"
                        >
                          {x.subject?.name ?? '-'}
                        </span>
                      ))}
                      {(!p.subjects || p.subjects.length === 0) && (
                        <span className="text-gray-400">Belum ada mata pelajaran terkait.</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {isSelected ? `Terpilih sebagai Prioritas ${idx + 1}` : 'Belum dipilih'}
                    </span>
                    <Button
                      variant={isSelected ? 'secondary' : 'primary'}
                      disabled={locked || (!isSelected && choices.length >= maxChoices)}
                      onClick={() => toggleChoice(p.id)}
                    >
                      {isSelected ? 'Batalkan Pilihan' : 'Pilih Kelas'}
                    </Button>
                  </div>
                </Card>
              );
            })}

            {sortedAndFilteredPackages.length === 0 && (
              <div className="col-span-2 rounded-2xl border border-dashed p-10 text-center text-gray-500">
                {packageSearch || packageFilter !== 'ALL'
                  ? 'Tidak ada paket kelas yang sesuai dengan filter/pencarian Anda.'
                  : 'Belum ada paket kelas XI yang dibuka untuk pemilihan pada tahun ajaran ini.'}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modal Ganti Password */}
      <Modal
        open={passwordOpen}
        title="Ganti Password Siswa"
        onClose={() => setPasswordOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPasswordOpen(false)}>Batal</Button>
            <Button onClick={changePassword}>Simpan Password</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Password Saat Ini</Label>
            <Input
              type="password"
              placeholder="Masukkan password saat ini..."
              value={pw.currentPassword}
              onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <Label>Password Baru (Minimal 8 karakter)</Label>
            <Input
              type="password"
              placeholder="Masukkan password baru..."
              value={pw.newPassword}
              onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </main>
  );
}
