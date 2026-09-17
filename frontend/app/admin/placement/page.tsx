'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Input, Label, Modal, PageHeader, Pagination, Select, Textarea } from '@/components/ui';

type MoveTarget = { student: any; recommendations?: any[] };

export default function PlacementPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [unplaced, setUnplaced] = useState<any[]>([]);
  const [fairness, setFairness] = useState<any>(null);
  const [move, setMove] = useState<MoveTarget | null>(null);
  const [classId, setClassId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Simulation Modal State
  const [simModalOpen, setSimModalOpen] = useState(false);
  const [simConfigs, setSimConfigs] = useState<any[]>([]);
  const [simConfigId, setSimConfigId] = useState<string>('');
  const [simAutoAdjust, setSimAutoAdjust] = useState<boolean>(true);
  const [simPreserveFinal, setSimPreserveFinal] = useState<boolean>(false);
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Recap State
  const [recapData, setRecapData] = useState<any>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [recapTab, setRecapTab] = useState<'summary' | 'students'>('students');
  const [selectedRecapClassId, setSelectedRecapClassId] = useState<string>('ALL');
  const [recapSearch, setRecapSearch] = useState<string>('');
  const [recapChoiceFilter, setRecapChoiceFilter] = useState<string>('ALL');

  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sort, setSort] = useState('placedClassName');
  const [order, setOrder] = useState('asc');
  const [masterPage, setMasterPage] = useState(1);
  const [masterPageSize, setMasterPageSize] = useState(25);
  const [unplacedPage, setUnplacedPage] = useState(1);
  const [unplacedPageSize, setUnplacedPageSize] = useState(25);
  const [viewMode, setViewMode] = useState<'cards' | 'master' | 'unplaced'>('cards');

  async function load() {
    setLoading(true);
    try {
      const [c, u, f] = await Promise.all([
        api<any[]>('/placement/occupancy'),
        api<any[]>('/placement/unplaced'),
        api('/placement/fairness-info'),
      ]);

      // Ensure natural alphanumeric sort for classes
      const sortedClasses = [...c].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
      );

      setClasses(sortedClasses);
      setUnplaced(u);
      setFairness(f);
    } catch (e: any) {
      setMessage(`Gagal memuat data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecap() {
    try {
      const data = await api<any>('/placement/recap');
      setRecapData(data);
      setRecapOpen(true);
    } catch (e: any) {
      alert(`Gagal memuat rekapitulasi: ${e.message}`);
    }
  }

  function printRecapDocument(mode: 'all' | 'selected' | 'summary' = 'all') {
    if (!recapData || !recapData.classes?.length) {
      alert('Data rekapitulasi belum tersedia untuk dicetak.');
      return;
    }

    const printWin = window.open('', '_blank', 'width=1050,height=850');
    if (!printWin) {
      alert('Pop-up terblokir oleh browser. Silakan izinkan pop-up untuk mencetak hasil rekapitulasi.');
      return;
    }

    const dateStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const targetClasses =
      mode === 'selected' && selectedRecapClassId !== 'ALL'
        ? recapData.classes.filter((c: any) => String(c.id) === selectedRecapClassId)
        : recapData.classes;

    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Rekapitulasi Hasil Resmi Penempatan Kelas XI - ${recapData.academicYearName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm 15mm 10mm;
    }
    * {
      box-sizing: border-box;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
    }
    body {
      margin: 0;
      padding: 0;
      font-size: 9.5pt;
      line-height: 1.3;
      background: white;
    }
    .header {
      text-align: center;
      border-bottom: 2.5px double #000;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .header h1 {
      margin: 0;
      font-size: 13pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header h2 {
      margin: 2px 0 0 0;
      font-size: 10.5pt;
      font-weight: bold;
    }
    .header p {
      margin: 2px 0 0 0;
      font-size: 8.5pt;
      color: #4b5563;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 10px;
    }
    .summary-card {
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 6px 8px;
      text-align: center;
      background: #f9fafb;
    }
    .summary-card .label {
      font-size: 7.5pt;
      text-transform: uppercase;
      color: #4b5563;
      font-weight: bold;
    }
    .summary-card .value {
      font-size: 12pt;
      font-weight: 900;
      color: #1e3a8a;
      margin-top: 2px;
    }
    .choice-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-bottom: 12px;
    }
    .choice-card {
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 5px 8px;
      background: #ffffff;
      font-size: 8pt;
    }
    .choice-card b {
      display: block;
      font-size: 9.5pt;
      margin-top: 2px;
      color: #1f2937;
    }
    .section-title {
      font-size: 10pt;
      font-weight: bold;
      margin: 10px 0 6px 0;
      text-transform: uppercase;
      border-bottom: 1px solid #9ca3af;
      padding-bottom: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 8.5pt;
    }
    th, td {
      border: 1px solid #9ca3af;
      padding: 4px 6px;
    }
    th {
      background-color: #f3f4f6;
      font-weight: bold;
      text-align: center;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .class-header {
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      padding: 6px 10px;
      border-radius: 4px;
      margin-top: 10px;
      margin-bottom: 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
    }
    .class-title {
      font-size: 11pt;
      font-weight: bold;
      color: #1e3a8a;
    }
    .class-meta {
      font-size: 8.5pt;
      color: #374151;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    .signature-container {
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    .signature-box {
      text-align: center;
      width: 220px;
    }
    .signature-space {
      height: 55px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>REKAPITULASI HASIL RESMI PENEMPATAN & PLOTTING KELAS XI</h1>
    <h2>TAHUN AJARAN ${recapData.academicYearName}</h2>
    <p>Dicetak pada: ${dateStr} | Sistem Informasi EduPath XI</p>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Total Siswa</div>
      <div class="value">${recapData.totals?.totalStudents ?? 0}</div>
    </div>
    <div class="summary-card">
      <div class="label">Ditempatkan</div>
      <div class="value">${recapData.totals?.totalPlaced ?? 0}</div>
    </div>
    <div class="summary-card">
      <div class="label">Belum Ditempatkan</div>
      <div class="value">${recapData.totals?.totalUnplaced ?? 0}</div>
    </div>
    <div class="summary-card">
      <div class="label">Kapasitas Kursi XI</div>
      <div class="value">${recapData.totals?.totalCapacity ?? 0}</div>
    </div>
  </div>

  <div class="choice-grid">
    <div class="choice-card">
      <div>Pilihan 1 (Utama)</div>
      <b>${recapData.choiceDistribution?.p1 ?? 0} Siswa (${recapData.choiceDistribution?.percentP1 ?? 0}%)</b>
    </div>
    <div class="choice-card">
      <div>Pilihan 2</div>
      <b>${recapData.choiceDistribution?.p2 ?? 0} Siswa (${recapData.choiceDistribution?.percentP2 ?? 0}%)</b>
    </div>
    <div class="choice-card">
      <div>Pilihan 3</div>
      <b>${recapData.choiceDistribution?.p3 ?? 0} Siswa (${recapData.choiceDistribution?.percentP3 ?? 0}%)</b>
    </div>
    <div class="choice-card">
      <div>Penyesuaian Kuota</div>
      <b>${recapData.choiceDistribution?.adjustment ?? 0} Siswa (${recapData.choiceDistribution?.percentAdjustment ?? 0}%)</b>
    </div>
  </div>

  <div class="section-title">Rekapitulasi Keterisian Rombel Kelas XI</div>
  <table>
    <thead>
      <tr>
        <th style="width: 30px;">No</th>
        <th>Nama Kelas XI</th>
        <th>Paket Peminatan</th>
        <th style="width: 70px;">Kapasitas</th>
        <th style="width: 70px;">Terisi</th>
        <th style="width: 80px;">L / P</th>
        <th style="width: 80px;">Keterisian</th>
        <th style="width: 80px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${(recapData.classes || [])
        .map(
          (c: any, i: number) => `
        <tr>
          <td class="text-center">${i + 1}</td>
          <td><b>${c.name}</b></td>
          <td>${c.packageTitle}</td>
          <td class="text-center">${c.capacity}</td>
          <td class="text-center"><b>${c.totalPlaced}</b></td>
          <td class="text-center">${c.countL} L / ${c.countP} P</td>
          <td class="text-center">${c.occupancyPercent}%</td>
          <td class="text-center">${c.isFull ? 'Penuh' : 'Sisa ' + c.available}</td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>

  ${
    mode !== 'summary'
      ? `
    ${targetClasses
      .map(
        (cls: any, cIdx: number) => `
      <div class="${cIdx > 0 || mode === 'all' ? 'page-break' : ''}">
        <div class="class-header">
          <div>
            <span class="class-title">${cls.name}</span> · <span style="font-weight: 600;">${cls.packageTitle}</span>
          </div>
          <div class="class-meta">
            Kapasitas: <b>${cls.capacity}</b> | Terisi: <b>${cls.totalPlaced}</b> (${cls.countL} L / ${cls.countP} P) | Okupansi: <b>${cls.occupancyPercent}%</b>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 32px;">No</th>
              <th style="width: 90px;">NIS</th>
              <th>Nama Lengkap Siswa</th>
              <th style="width: 50px;">L/P</th>
              <th style="width: 85px;">Kelas Asal</th>
              <th style="width: 120px;">Pemenuhan Pilihan</th>
              <th style="width: 80px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${(cls.students || [])
              .map(
                (s: any, sIdx: number) => `
              <tr>
                <td class="text-center">${sIdx + 1}</td>
                <td class="text-center font-mono">${s.nis}</td>
                <td><b>${s.name}</b></td>
                <td class="text-center">${s.gender ?? '-'}</td>
                <td class="text-center">${s.originClass}</td>
                <td>${s.choiceLabel}</td>
                <td class="text-center">${s.status}</td>
              </tr>
            `,
              )
              .join('')}
            ${
              !(cls.students || []).length
                ? `
              <tr>
                <td colspan="7" class="text-center" style="padding: 12px; color: #6b7280;">
                  Belum ada siswa yang ditempatkan di kelas ini.
                </td>
              </tr>
            `
                : ''
            }
          </tbody>
        </table>
      </div>
    `,
      )
      .join('')}
  `
      : ''
  }

  <div class="signature-container">
    <div class="signature-box">
      <div>Mengetahui,</div>
      <div>Kepala Sekolah</div>
      <div class="signature-space"></div>
      <div><b>_________________________</b></div>
      <div>NIP. ........................................</div>
    </div>
    <div class="signature-box">
      <div>Ditetapkan di: ....................</div>
      <div>Ketua Panitia / Koordinator BK</div>
      <div class="signature-space"></div>
      <div><b>_________________________</b></div>
      <div>NIP. ........................................</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
  }

  useEffect(() => {
    load();
  }, []);

  const availableClasses = useMemo(
    () =>
      classes.map((c) => ({
        ...c,
        used: c.placedStudents.length,
        available: c.capacity - c.placedStudents.length,
      })),
    [classes],
  );

  // Flat list of all placed students
  const allPlacedStudents = useMemo(() => {
    const list: any[] = [];
    classes.forEach((c) => {
      c.placedStudents.forEach((s: any) => {
        list.push({
          ...s,
          placedClassName: c.name,
          placedClassId: c.id,
        });
      });
    });
    return list;
  }, [classes]);

  // Statistik Ringkas
  const stats = useMemo(() => {
    const totalPlaced = allPlacedStudents.length;
    const totalUnplaced = unplaced.length;
    const totalStudents = totalPlaced + totalUnplaced;
    const totalCapacity = classes.reduce((sum, c) => sum + (c.capacity || 0), 0);
    const availableQuota = Math.max(0, totalCapacity - totalPlaced);
    return { totalStudents, totalPlaced, totalUnplaced, totalCapacity, availableQuota };
  }, [allPlacedStudents, unplaced, classes]);

  // Filtered Master Student List
  const filteredMasterStudents = useMemo(() => {
    return allPlacedStudents.filter((s) => {
      const matchQ =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.nis.includes(searchQuery);

      const matchClass = classFilter === 'ALL' || String(s.placedClassId) === classFilter;
      const matchStatus = statusFilter === 'ALL' || (s.placement?.status ?? 'TEMPORARY') === statusFilter;

      return matchQ && matchClass && matchStatus;
    });
  }, [allPlacedStudents, searchQuery, classFilter, statusFilter]);

  // Sorted Master Student List with natural sorting
  const sortedMasterStudents = useMemo(() => {
    return [...filteredMasterStudents].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sort === 'originClass') {
        valA = a.originClass?.name ?? '';
        valB = b.originClass?.name ?? '';
      } else if (sort === 'placedClassName') {
        valA = a.placedClassName ?? '';
        valB = b.placedClassName ?? '';
      } else if (sort === 'name') {
        valA = a.name ?? '';
        valB = b.name ?? '';
      } else if (sort === 'nis') {
        valA = a.nis ?? '';
        valB = b.nis ?? '';
      } else if (sort === 'status') {
        valA = a.placement?.status ?? '';
        valB = b.placement?.status ?? '';
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return order === 'asc' ? valA - valB : valB - valA;
      }
      return order === 'asc'
        ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
        : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [filteredMasterStudents, sort, order]);

  const paginatedMasterStudents = useMemo(() => {
    if (masterPageSize >= 999999) return sortedMasterStudents;
    const start = (masterPage - 1) * masterPageSize;
    return sortedMasterStudents.slice(start, start + masterPageSize);
  }, [sortedMasterStudents, masterPage, masterPageSize]);

  // Filtered Unplaced Students
  const filteredUnplaced = useMemo(() => {
    return unplaced.filter((u) => {
      if (!searchQuery) return true;
      return (
        u.student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.student.nis.includes(searchQuery)
      );
    });
  }, [unplaced, searchQuery]);

  const paginatedUnplaced = useMemo(() => {
    if (unplacedPageSize >= 999999) return filteredUnplaced;
    const start = (unplacedPage - 1) * unplacedPageSize;
    return filteredUnplaced.slice(start, start + unplacedPageSize);
  }, [filteredUnplaced, unplacedPage, unplacedPageSize]);

  function handleSort(column: string) {
    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setOrder('asc');
    }
    setMasterPage(1);
  }

  function getSortIndicator(column: string) {
    if (sort !== column) return <span className="text-gray-300 ml-1">⇅</span>;
    return <span className="text-blue-700 font-black ml-1">{order === 'asc' ? '▲' : '▼'}</span>;
  }

  async function openSimulateModal() {
    try {
      setLoading(true);
      const configs = await api<any[]>('/selection/configs');
      setSimConfigs(configs);
      const active = configs.find((c) => c.isActive) || configs[0];
      if (active) setSimConfigId(String(active.id));
      setSimResult(null);
      setSimModalOpen(true);
    } catch (e: any) {
      setSimModalOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function runSimulation() {
    try {
      setSimulating(true);
      const r: any = await api('/placement/simulate', {
        method: 'POST',
        body: JSON.stringify({
          configId: simConfigId ? Number(simConfigId) : undefined,
          autoAdjust: simAutoAdjust,
          preserveFinal: simPreserveFinal,
        }),
      });
      setSimResult(r);
      setMessage(r.message);
      await load();
    } catch (e: any) {
      alert(`Gagal menjalankan plotting: ${e.message}`);
    } finally {
      setSimulating(false);
    }
  }

  async function finalize() {
    if (!confirm('Apakah Anda yakin ingin memfinalisasi placement menjadi hasil resmi? Status siswa akan diubah menjadi FINAL dan rekapitulasi hasil resmi akan otomatis dibuat.')) {
      return;
    }
    try {
      setLoading(true);
      const r: any = await api('/placement/finalize', { method: 'POST' });
      setMessage(r.message);
      await load();
      await loadRecap();
    } catch (e: any) {
      alert(`Gagal finalisasi: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function openMove(student: any, recommendations?: any[]) {
    setMove({ student, recommendations });
    const rec = recommendations?.[0];
    setClassId(String(rec?.classId ?? availableClasses.find((c) => c.available > 0)?.id ?? ''));
    setReason(
      student.placement?.status === 'FINAL'
        ? 'Penyesuaian placement setelah hasil resmi'
        : 'Penempatan / rekomendasi kelas tersedia berdasarkan skor',
    );
  }

  async function saveMove() {
    if (!move || !classId || !reason.trim()) {
      alert('Pilih kelas tujuan dan isi alasan pemindahan.');
      return;
    }
    try {
      await api('/placement/move', {
        method: 'POST',
        body: JSON.stringify({ studentId: move.student.id, classId: Number(classId), reason }),
      });
      setMessage(`Siswa ${move.student.name} berhasil dipindahkan.`);
      setMove(null);
      await load();
    } catch (e: any) {
      alert(`Gagal memindahkan: ${e.message}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Placement & Plotting Kelas XI"
        description="Hasil penempatan siswa ke kelas paket XI, pemindahan dinamis antar rombel, dan review penempatan siswa unplaced."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={loadRecap}>
              📊 Lihat Rekap Hasil
            </Button>
            <Button variant="secondary" onClick={openSimulateModal} disabled={loading || simulating}>
              ⚡ Simulasi Plotting Kelas XI
            </Button>
            <Button onClick={finalize} disabled={loading || simulating}>
              Finalisasi Hasil Resmi
            </Button>
          </div>
        }
      />

      {message && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 shadow-xs">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-xs text-blue-600 hover:text-blue-900">✕ Tutup</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Total Siswa Terdaftar</div>
          <div className="mt-1 text-2xl font-black text-gray-900">{stats.totalStudents}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Sudah Ditempatkan</div>
          <div className="mt-1 text-2xl font-black text-emerald-600">
            {stats.totalPlaced} <span className="text-xs text-gray-400 font-normal">siswa</span>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Belum Dapat Kelas</div>
          <div className="mt-1 text-2xl font-black text-amber-600">
            {stats.totalUnplaced} <span className="text-xs text-gray-400 font-normal">siswa</span>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Kapasitas Kelas XI</div>
          <div className="mt-1 text-2xl font-black text-indigo-600">{stats.totalCapacity} kursi</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Sisa Kuota XI</div>
          <div className="mt-1 text-2xl font-black text-blue-600">{stats.availableQuota} kursi</div>
        </div>
      </div>

      {/* FILTER & VIEW CONTROLS */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                viewMode === 'cards'
                  ? 'bg-[#10285f] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setViewMode('cards')}
            >
              📦 Plotting Per Kelas XI ({classes.length})
            </button>
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                viewMode === 'master'
                  ? 'bg-[#10285f] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setViewMode('master')}
            >
              📋 Master Tabel Seluruh Siswa ({allPlacedStudents.length})
            </button>
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-xs font-bold transition ${
                viewMode === 'unplaced'
                  ? 'bg-[#10285f] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              onClick={() => setViewMode('unplaced')}
            >
              ⚠️ Siswa Belum Dapat Kelas ({unplaced.length})
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <Label>Pencarian Siswa</Label>
            <Input
              placeholder="Cari nama atau NIS siswa..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setMasterPage(1);
                setUnplacedPage(1);
              }}
            />
          </div>
          <div>
            <Label>Filter Kelas XI</Label>
            <Select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setMasterPage(1);
              }}
            >
              <option value="ALL">Semua Kelas XI</option>
              {classes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} ({c.placedStudents.length}/{c.capacity})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Filter Status Placement</Label>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setMasterPage(1);
              }}
            >
              <option value="ALL">Semua Status</option>
              <option value="TEMPORARY">TEMPORARY (Sementara)</option>
              <option value="FINAL">FINAL (Resmi)</option>
            </Select>
          </div>
          <div>
            <Label>Urutkan Master Tabel</Label>
            <Select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setMasterPage(1);
              }}
            >
              <option value="placedClassName">Sort: Placement Kelas XI</option>
              <option value="originClass">Sort: Kelas Asal (X)</option>
              <option value="name">Sort: Nama Siswa</option>
              <option value="nis">Sort: NIS</option>
              <option value="status">Sort: Status Placement</option>
            </Select>
          </div>
          <div>
            <Label>Arah Urutan</Label>
            <Select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                setMasterPage(1);
              }}
            >
              <option value="asc">Naik (A-Z)</option>
              <option value="desc">Turun (Z-A)</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* VIEW 1: PLOTTING PER KELAS (CARDS) */}
      {viewMode === 'cards' && (
        <div className="grid gap-6 xl:grid-cols-2">
          {availableClasses
            .filter((c) => classFilter === 'ALL' || String(c.id) === classFilter)
            .map((c) => {
              const studentsInClass = c.placedStudents.filter((s: any) => {
                const matchQ =
                  !searchQuery ||
                  s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  s.nis.includes(searchQuery);
                const matchStatus =
                  statusFilter === 'ALL' || (s.placement?.status ?? 'TEMPORARY') === statusFilter;
                return matchQ && matchStatus;
              });

              return (
                <Card key={c.id} className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-4 border-b pb-3">
                      <div>
                        <h3 className="font-black text-xl text-gray-900">{c.name}</h3>
                        <p className="text-xs text-[#667085]">
                          {c.category ?? 'Paket Kelas'} · {c.used}/{c.capacity} siswa terplot
                        </p>
                      </div>
                      <span
                        className={`badge ${
                          c.available <= 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {c.available <= 0 ? 'Kelas Penuh' : `Sisa ${c.available} Kuota`}
                      </span>
                    </div>

                    <div className="mt-3 table-wrap max-h-80 overflow-y-auto">
                      <table>
                        <thead>
                          <tr>
                            <th>No</th>
                            <th>NIS</th>
                            <th>Nama Siswa</th>
                            <th>Pilihan Paket</th>
                            <th>Status</th>
                            <th>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentsInClass.map((s: any, i: number) => (
                            <tr key={s.id}>
                              <td>{i + 1}</td>
                              <td><span className="font-mono text-xs font-semibold">{s.nis}</span></td>
                              <td>
                                <span className="font-bold text-gray-900">{s.name}</span>
                              </td>
                              <td>
                                <div className="flex flex-wrap gap-1 text-[11px]">
                                  {s.preference?.choices?.map((x: any) => (
                                    <span
                                      key={x.id}
                                      className={`rounded px-1.5 py-0.5 font-medium ${
                                        x.package?.class?.name === c.name
                                          ? 'bg-blue-100 text-blue-900 font-bold'
                                          : 'bg-gray-100 text-gray-700'
                                      }`}
                                    >
                                      P{x.priority}: {x.package.class.name}
                                    </span>
                                  ))}
                                  {(!s.preference?.choices || s.preference.choices.length === 0) && (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    s.placement?.status === 'FINAL'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {s.placement?.status ?? 'TEMPORARY'}
                                </span>
                              </td>
                              <td>
                                <Button variant="ghost" className="text-xs h-7 px-2" onClick={() => openMove(s)}>
                                  Pindahkan
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {studentsInClass.length === 0 && (
                            <tr>
                              <td colSpan={6} className="py-6 text-center text-gray-500">
                                {searchQuery || statusFilter !== 'ALL'
                                  ? 'Tidak ada siswa yang sesuai filter di kelas ini.'
                                  : 'Belum ada siswa yang ditempatkan di kelas ini.'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t flex justify-between items-center text-xs text-gray-500">
                    <span>
                      Menampilkan <b>{studentsInClass.length}</b> dari {c.placedStudents.length} siswa
                    </span>
                  </div>
                </Card>
              );
            })}
        </div>
      )}

      {/* VIEW 2: MASTER TABEL SELURUH SISWA */}
      {viewMode === 'master' && (
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-gray-900">Master Tabel Seluruh Siswa Placement</h3>
              <p className="text-xs text-gray-500">
                Daftar lengkap seluruh siswa yang telah ditempatkan di kelas XI beserta prioritas pilihan paketnya.
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-600">
              Ditemukan: <b>{filteredMasterStudents.length}</b> siswa
            </span>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-12 text-center">No</th>
                  <th
                    className="cursor-pointer hover:bg-gray-100 transition select-none"
                    onClick={() => handleSort('nis')}
                  >
                    <div className="flex items-center">
                      <span>NIS</span>
                      {getSortIndicator('nis')}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:bg-gray-100 transition select-none"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center">
                      <span>Nama Siswa</span>
                      {getSortIndicator('name')}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:bg-gray-100 transition select-none"
                    onClick={() => handleSort('originClass')}
                  >
                    <div className="flex items-center">
                      <span>Kelas Asal (X)</span>
                      {getSortIndicator('originClass')}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:bg-gray-100 transition select-none"
                    onClick={() => handleSort('placedClassName')}
                  >
                    <div className="flex items-center">
                      <span>Placement Kelas XI</span>
                      {getSortIndicator('placedClassName')}
                    </div>
                  </th>
                  <th>Pilihan 1</th>
                  <th>Pilihan 2</th>
                  <th>Pilihan 3</th>
                  <th
                    className="cursor-pointer hover:bg-gray-100 transition select-none text-center"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center justify-center">
                      <span>Status</span>
                      {getSortIndicator('status')}
                    </div>
                  </th>
                  <th className="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMasterStudents.map((s, idx) => {
                  const rowNo = masterPageSize >= 999999 ? idx + 1 : (masterPage - 1) * masterPageSize + idx + 1;
                  const p1 = s.preference?.choices?.find((c: any) => c.priority === 1);
                  const p2 = s.preference?.choices?.find((c: any) => c.priority === 2);
                  const p3 = s.preference?.choices?.find((c: any) => c.priority === 3);

                  return (
                    <tr key={s.id}>
                      <td className="text-center font-medium text-gray-500">{rowNo}</td>
                      <td><span className="font-mono text-xs font-semibold">{s.nis}</span></td>
                      <td className="font-bold text-gray-900">{s.name}</td>
                      <td><span className="badge">{s.originClass?.name ?? '-'}</span></td>
                      <td>
                        <span className="badge bg-blue-100 text-blue-900 font-bold text-xs">
                          {s.placedClassName}
                        </span>
                      </td>
                      <td>
                        {p1 ? (
                          <span className={`text-xs ${p1.package.class.name === s.placedClassName ? 'font-bold text-blue-700' : 'text-gray-600'}`}>
                            {p1.package.class.name}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {p2 ? (
                          <span className={`text-xs ${p2.package.class.name === s.placedClassName ? 'font-bold text-blue-700' : 'text-gray-600'}`}>
                            {p2.package.class.name}
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {p3 ? (
                          <span className={`text-xs ${p3.package.class.name === s.placedClassName ? 'font-bold text-blue-700' : 'text-gray-600'}`}>
                            {p3.package.class.name}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge ${
                            s.placement?.status === 'FINAL'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {s.placement?.status ?? 'TEMPORARY'}
                        </span>
                      </td>
                      <td className="text-center">
                        <Button variant="secondary" className="text-xs h-7 px-2.5" onClick={() => openMove(s)}>
                          Pindahkan
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {paginatedMasterStudents.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-500">
                      Tidak ada data siswa yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            totalItems={filteredMasterStudents.length}
            currentPage={masterPage}
            pageSize={masterPageSize}
            onPageChange={setMasterPage}
            onPageSizeChange={setMasterPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            label="siswa"
          />
        </Card>
      )}

      {/* VIEW 3: UNPLACED STUDENTS */}
      {viewMode === 'unplaced' && (
        <Card>
          <div className="mb-3">
            <h3 className="font-black text-lg text-gray-900">Siswa Belum Mendapatkan Kelas</h3>
            <p className="text-xs text-gray-500">
              Sistem merekomendasikan paket yang masih tersedia berdasarkan skor eligible tertinggi. Admin tetap menentukan keputusan akhir.
            </p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-12 text-center">No</th>
                  <th>NIS</th>
                  <th>Nama Siswa</th>
                  <th>Pilihan Awal Siswa</th>
                  <th>Rekomendasi Paket Tersedia</th>
                  <th className="text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUnplaced.map((r: any, i: number) => {
                  const rowNo = unplacedPageSize >= 999999 ? i + 1 : (unplacedPage - 1) * unplacedPageSize + i + 1;
                  return (
                    <tr key={r.student.id}>
                      <td className="text-center font-medium text-gray-500">{rowNo}</td>
                      <td><span className="font-mono text-xs font-semibold">{r.student.nis}</span></td>
                      <td className="font-bold text-gray-900">{r.student.name}</td>
                      <td>
                        <div className="flex flex-wrap gap-1 text-xs">
                          {r.student.preference?.choices?.map((x: any) => (
                            <span key={x.id} className="rounded bg-gray-100 px-1.5 py-0.5 font-medium">
                              P{x.priority}: {x.package.class.name}
                            </span>
                          ))}
                          {(!r.student.preference?.choices || r.student.preference.choices.length === 0) && (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {r.recommendations?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {r.recommendations.map((x: any) => (
                              <span
                                key={x.classId}
                                className="rounded-lg border bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-900"
                              >
                                {x.className} (Skor: {x.score.toFixed(1)}, Sisa: {x.available})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-700 font-semibold">
                            Tidak ada kelas eligible dengan sisa kuota
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <Button
                          disabled={!r.recommendations?.length}
                          className="h-8 text-xs"
                          onClick={() => openMove(r.student, r.recommendations)}
                        >
                          Review & Tempatkan
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!paginatedUnplaced.length && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-green-700 font-semibold">
                      Semua siswa sudah mendapatkan kelas penempatan!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            totalItems={filteredUnplaced.length}
            currentPage={unplacedPage}
            pageSize={unplacedPageSize}
            onPageChange={setUnplacedPage}
            onPageSizeChange={setUnplacedPageSize}
            pageSizeOptions={[10, 25, 50]}
            label="siswa unplaced"
          />
        </Card>
      )}

      {/* Fairness Audit Card */}
      <Card className="mt-6">
        <h3 className="font-black text-base text-gray-900">{fairness?.title ?? 'Fairness Audit'}</h3>
        <p className="mt-1 text-xs leading-6 text-[#667085]">
          {fairness?.description ?? 'Memeriksa anomali penempatan agar keputusan dapat dijelaskan secara transparan.'}
        </p>
        <div className="mt-3 rounded-xl bg-[#fff8e8] border border-amber-200 p-3 text-xs text-amber-900">
          Audit ini tidak mengunci atau memindahkan siswa secara otomatis. Fungsinya menandai kasus khusus, penyesuaian manual, atau pengecualian kebijakan agar panitia dapat mencantumkan alasan yang dapat dipertanggungjawabkan.
        </div>
      </Card>

      {/* Modal Pindahkan Siswa */}
      <Modal
        open={!!move}
        title={`Pindahkan Penempatan · ${move?.student?.name ?? ''}`}
        onClose={() => setMove(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMove(null)}>Batal</Button>
            <Button onClick={saveMove}>Simpan Pemindahan</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Kelas Tujuan Penempatan</Label>
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">-- Pilih Kelas Tujuan --</option>
              {availableClasses.map((c) => (
                <option
                  key={c.id}
                  value={c.id}
                  disabled={c.available <= 0 && move?.student?.placedClassId !== c.id}
                >
                  {c.name} · Sisa {c.available} kursi {c.available <= 0 ? '(Penuh)' : ''}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Alasan Pemindahan (Wajib)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: Rekomendasi sistem berdasarkan skor eligible, keputusan rapat dewan guru / BK, penyesuaian kuota rombel, dll."
            />
          </div>
          {move?.recommendations?.length ? (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
              <b>Rekomendasi sistem berdasarkan skor:</b>{' '}
              {move.recommendations.map((x: any) => `${x.className} (Skor: ${x.score.toFixed(1)})`).join(', ')}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Modal Rekapitulasi Hasil Resmi Placement (Auto Open on Finalize or Button Click) */}
      <Modal
        open={recapOpen}
        title="📊 Rekapitulasi Hasil Resmi Placement Kelas XI"
        maxWidth="max-w-6xl"
        onClose={() => setRecapOpen(false)}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <span className="text-xs text-gray-500">
              Tahun Ajaran: <b>{recapData?.academicYearName ?? '-'}</b>
            </span>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => printRecapDocument('summary')}>
                📊 Cetak Ringkasan Saja
              </Button>
              {selectedRecapClassId !== 'ALL' && (
                <Button variant="secondary" onClick={() => printRecapDocument('selected')}>
                  🖨️ Cetak Kelas Terpilih
                </Button>
              )}
              <Button onClick={() => printRecapDocument('all')} className="bg-[#10285f] hover:bg-[#0c1e48] text-white">
                🖨️ Cetak Semua Rombel (Lengkap)
              </Button>
              <Button variant="ghost" onClick={() => setRecapOpen(false)}>
                Tutup Rekap
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* TAB NAVIGASI REKAP */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  recapTab === 'students'
                    ? 'bg-[#10285f] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setRecapTab('students')}
              >
                👥 Daftar Siswa Per Kelas XI ({recapData?.totals?.totalPlaced ?? 0} Siswa)
              </button>
              <button
                type="button"
                className={`rounded-lg px-4 py-2 text-xs font-bold transition cursor-pointer ${
                  recapTab === 'summary'
                    ? 'bg-[#10285f] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setRecapTab('summary')}
              >
                📊 Ringkasan Eksekutif & Statistik Rombel
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                className="text-xs h-8 px-3"
                onClick={() => printRecapDocument('all')}
              >
                🖨️ Cetak Semua Kelas
              </Button>
            </div>
          </div>

          {/* TAB 1: DAFTAR SISWA PER KELAS */}
          {recapTab === 'students' && (
            <div className="space-y-4">
              {/* Toolbar Filter Siswa Rekap */}
              <div className="flex flex-wrap items-end gap-3 rounded-xl bg-gray-50/80 p-3 border">
                <div className="min-w-[180px] flex-1">
                  <Label>Pilih Kelas XI</Label>
                  <Select
                    value={selectedRecapClassId}
                    onChange={(e) => setSelectedRecapClassId(e.target.value)}
                  >
                    <option value="ALL">Semua Kelas XI (Tampilkan Semua Rombel)</option>
                    {recapData?.classes?.map((c: any) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name} ({c.totalPlaced}/{c.capacity} Siswa - {c.packageTitle})
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="min-w-[200px] flex-1">
                  <Label>Pencarian Siswa</Label>
                  <Input
                    placeholder="Cari nama, NIS, atau kelas asal..."
                    value={recapSearch}
                    onChange={(e) => setRecapSearch(e.target.value)}
                  />
                </div>

                <div className="min-w-[150px]">
                  <Label>Filter Pilihan</Label>
                  <Select
                    value={recapChoiceFilter}
                    onChange={(e) => setRecapChoiceFilter(e.target.value)}
                  >
                    <option value="ALL">Semua Pilihan</option>
                    <option value="Pilihan 1">Pilihan 1</option>
                    <option value="Pilihan 2">Pilihan 2</option>
                    <option value="Pilihan 3">Pilihan 3</option>
                    <option value="Penyesuaian">Penyesuaian Kuota</option>
                  </Select>
                </div>

                <div className="flex gap-1.5">
                  <Button
                    variant="secondary"
                    className="text-xs h-9 px-3 whitespace-nowrap"
                    onClick={() => printRecapDocument(selectedRecapClassId === 'ALL' ? 'all' : 'selected')}
                  >
                    🖨️ {selectedRecapClassId === 'ALL' ? 'Cetak Semua Rombel' : 'Cetak Rombel Ini'}
                  </Button>
                </div>
              </div>

              {/* Roster per Kelas */}
              <div className="space-y-5">
                {recapData?.classes
                  ?.filter((c: any) => selectedRecapClassId === 'ALL' || String(c.id) === selectedRecapClassId)
                  ?.map((cls: any) => {
                    const filteredStudents = (cls.students || []).filter((s: any) => {
                      const matchSearch =
                        !recapSearch ||
                        s.name.toLowerCase().includes(recapSearch.toLowerCase()) ||
                        s.nis.includes(recapSearch) ||
                        s.originClass.toLowerCase().includes(recapSearch.toLowerCase());
                      const matchChoice =
                        recapChoiceFilter === 'ALL' || s.choiceLabel === recapChoiceFilter;
                      return matchSearch && matchChoice;
                    });

                    return (
                      <div key={cls.id} className="rounded-xl border bg-white shadow-2xs overflow-hidden">
                        {/* Header Kelas */}
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-white px-4 py-3 border-b">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-lg text-gray-900">{cls.name}</span>
                              <span className="badge bg-indigo-100 text-indigo-900 font-bold text-xs">
                                {cls.packageTitle}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-gray-500">
                              Kapasitas: <b>{cls.capacity}</b> siswa · Terisi: <b className="text-blue-800">{cls.totalPlaced}</b> siswa ({cls.countL} Laki-laki, {cls.countP} Perempuan) · Sisa: <b>{cls.available}</b> kursi
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`badge font-bold text-xs ${
                                cls.isFull ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {cls.isFull ? 'Kelas Penuh' : `Tersedia ${cls.available} Kuota`}
                            </span>
                            <span className="font-mono text-xs font-bold text-gray-600 bg-white border px-2 py-0.5 rounded">
                              {cls.occupancyPercent}%
                            </span>
                          </div>
                        </div>

                        {/* Tabel Siswa di Kelas Tersebut */}
                        <div className="table-wrap max-h-80 overflow-y-auto">
                          <table>
                            <thead>
                              <tr>
                                <th className="w-12 text-center">No</th>
                                <th>NIS</th>
                                <th>Nama Siswa</th>
                                <th className="text-center">Gender</th>
                                <th className="text-center">Kelas Asal (X)</th>
                                <th>Pemenuhan Pilihan</th>
                                <th className="text-center">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredStudents.map((s: any, idx: number) => {
                                let badgeColor = 'bg-gray-100 text-gray-700';
                                if (s.choiceLabel === 'Pilihan 1') badgeColor = 'bg-green-100 text-green-800 font-bold';
                                else if (s.choiceLabel === 'Pilihan 2') badgeColor = 'bg-blue-100 text-blue-800 font-bold';
                                else if (s.choiceLabel === 'Pilihan 3') badgeColor = 'bg-teal-100 text-teal-800 font-bold';
                                else if (s.choiceLabel === 'Penyesuaian') badgeColor = 'bg-amber-100 text-amber-800 font-bold';

                                return (
                                  <tr key={s.id} className="hover:bg-gray-50/60 transition">
                                    <td className="text-center font-medium text-gray-500">{idx + 1}</td>
                                    <td><span className="font-mono text-xs font-semibold text-gray-700">{s.nis}</span></td>
                                    <td className="font-bold text-gray-900">{s.name}</td>
                                    <td className="text-center">
                                      <span className={`badge ${s.gender === 'L' ? 'bg-blue-50 text-blue-800' : s.gender === 'P' ? 'bg-pink-50 text-pink-800' : 'bg-gray-50 text-gray-700'}`}>
                                        {s.gender === 'L' ? 'L (Laki-laki)' : s.gender === 'P' ? 'P (Perempuan)' : s.gender ?? '-'}
                                      </span>
                                    </td>
                                    <td className="text-center">
                                      <span className="badge bg-gray-100 text-gray-800 font-semibold">{s.originClass}</span>
                                    </td>
                                    <td>
                                      <span className={`badge text-xs ${badgeColor}`}>
                                        {s.choiceLabel}
                                      </span>
                                    </td>
                                    <td className="text-center">
                                      <span
                                        className={`badge font-bold text-xs ${
                                          s.status === 'FINAL'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-blue-100 text-blue-800'
                                        }`}
                                      >
                                        {s.status}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                              {filteredStudents.length === 0 && (
                                <tr>
                                  <td colSpan={7} className="py-6 text-center text-gray-500 text-xs">
                                    {recapSearch || recapChoiceFilter !== 'ALL'
                                      ? 'Tidak ada siswa yang sesuai filter di kelas ini.'
                                      : 'Belum ada siswa yang ditempatkan di kelas ini.'}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Footer Sub-tabel */}
                        <div className="px-4 py-2 border-t bg-gray-50/50 flex justify-between items-center text-xs text-gray-500">
                          <span>Menampilkan <b>{filteredStudents.length}</b> dari {cls.students?.length ?? 0} siswa</span>
                          <span>{cls.name} · {cls.packageTitle}</span>
                        </div>
                      </div>
                    );
                  })}

                {(!recapData?.classes || recapData.classes.length === 0) && (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    Belum ada data kelas penempatan.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: RINGKASAN EKSEKUTIF & STATISTIK ROMBEL */}
          {recapTab === 'summary' && (
            <div className="space-y-5">
              {/* Executive Summary Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-center">
                <div className="rounded-xl border bg-[#f8faff] p-3.5 border-blue-100">
                  <div className="text-xs text-gray-500 font-semibold">Total Siswa Terdaftar</div>
                  <div className="mt-1 text-2xl font-black text-gray-900">{recapData?.totals?.totalStudents ?? 0}</div>
                  <div className="text-[11px] text-gray-400">seluruh siswa kelas X</div>
                </div>
                <div className="rounded-xl border bg-[#f0fdf4] p-3.5 border-green-100">
                  <div className="text-xs text-green-700 font-semibold">Berhasil Ditempatkan</div>
                  <div className="mt-1 text-2xl font-black text-green-700">
                    {recapData?.totals?.totalPlaced ?? 0}{' '}
                    <span className="text-xs font-normal">
                      ({recapData?.totals?.totalStudents ? ((recapData.totals.totalPlaced / recapData.totals.totalStudents) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="text-[11px] text-green-600">terplot ke kelas XI</div>
                </div>
                <div className="rounded-xl border bg-[#fffbeb] p-3.5 border-amber-100">
                  <div className="text-xs text-amber-700 font-semibold">Belum Ditempatkan</div>
                  <div className="mt-1 text-2xl font-black text-amber-700">
                    {recapData?.totals?.totalUnplaced ?? 0}
                  </div>
                  <div className="text-[11px] text-amber-600">memerlukan review unplaced</div>
                </div>
                <div className="rounded-xl border bg-[#f5f3ff] p-3.5 border-indigo-100">
                  <div className="text-xs text-indigo-700 font-semibold">Kapasitas Kursi XI</div>
                  <div className="mt-1 text-2xl font-black text-indigo-700">
                    {recapData?.totals?.totalCapacity ?? 0}{' '}
                    <span className="text-xs font-normal">
                      ({recapData?.totals?.totalCapacity ? ((recapData.totals.totalPlaced / recapData.totals.totalCapacity) * 100).toFixed(1) : 0}%)
                    </span>
                  </div>
                  <div className="text-[11px] text-indigo-600">Sisa {recapData?.totals?.totalAvailable ?? 0} kursi</div>
                </div>
              </div>

              {/* Distribusi Pilihan Siswa */}
              <div className="rounded-xl border p-4 bg-gray-50/70">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                  Distribusi Pemenuhan Pilihan Siswa
                </h4>
                <div className="grid gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-white p-3 border shadow-2xs">
                    <div className="text-xs text-green-800 font-semibold">🎯 Pilihan 1 (Utama)</div>
                    <div className="mt-1 text-lg font-black text-green-900">
                      {recapData?.choiceDistribution?.p1 ?? 0} siswa{' '}
                      <span className="text-xs font-normal text-gray-500">({recapData?.choiceDistribution?.percentP1 ?? 0}%)</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border shadow-2xs">
                    <div className="text-xs text-blue-800 font-semibold">🥈 Pilihan 2</div>
                    <div className="mt-1 text-lg font-black text-blue-900">
                      {recapData?.choiceDistribution?.p2 ?? 0} siswa{' '}
                      <span className="text-xs font-normal text-gray-500">({recapData?.choiceDistribution?.percentP2 ?? 0}%)</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border shadow-2xs">
                    <div className="text-xs text-teal-800 font-semibold">🥉 Pilihan 3</div>
                    <div className="mt-1 text-lg font-black text-teal-900">
                      {recapData?.choiceDistribution?.p3 ?? 0} siswa{' '}
                      <span className="text-xs font-normal text-gray-500">({recapData?.choiceDistribution?.percentP3 ?? 0}%)</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-3 border shadow-2xs">
                    <div className="text-xs text-amber-800 font-semibold">🔄 Penyesuaian Kuota</div>
                    <div className="mt-1 text-lg font-black text-amber-900">
                      {recapData?.choiceDistribution?.adjustment ?? 0} siswa{' '}
                      <span className="text-xs font-normal text-gray-500">({recapData?.choiceDistribution?.percentAdjustment ?? 0}%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabel Rekapitulasi Rombel Kelas XI */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Daftar Rombel & Keterisian Kelas XI ({recapData?.classes?.length ?? 0} Kelas)
                </h4>
                <div className="table-wrap max-h-72 overflow-y-auto">
                  <table>
                    <thead>
                      <tr>
                        <th className="w-10 text-center">No</th>
                        <th>Nama Kelas XI</th>
                        <th>Paket Peminatan</th>
                        <th className="text-center">Kapasitas</th>
                        <th className="text-center">Terisi</th>
                        <th className="text-center">L / P</th>
                        <th className="text-center">Keterisian</th>
                        <th className="text-center">Status</th>
                        <th className="text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recapData?.classes?.map((c: any, i: number) => {
                        return (
                          <tr key={c.id}>
                            <td className="text-center font-medium text-gray-500">{i + 1}</td>
                            <td className="font-bold text-gray-900">{c.name}</td>
                            <td><span className="badge text-xs">{c.packageTitle}</span></td>
                            <td className="text-center font-semibold">{c.capacity}</td>
                            <td className="text-center font-bold text-blue-900">{c.totalPlaced}</td>
                            <td className="text-center text-xs text-gray-600">
                              {c.countL} L / {c.countP} P
                            </td>
                            <td className="text-center">
                              <span className="font-mono font-semibold text-xs">{c.occupancyPercent}%</span>
                            </td>
                            <td className="text-center">
                              <span
                                className={`badge ${
                                  c.isFull ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {c.isFull ? 'Penuh' : `Sisa ${c.available}`}
                              </span>
                            </td>
                            <td className="text-center">
                              <Button
                                variant="secondary"
                                className="text-xs h-7 px-2"
                                onClick={() => {
                                  setSelectedRecapClassId(String(c.id));
                                  setRecapTab('students');
                                }}
                              >
                                Lihat Siswa ({c.totalPlaced})
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                      {(!recapData?.classes || recapData.classes.length === 0) && (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-gray-500">
                            Belum ada kelas XI terdaftar pada tahun ajaran ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL SIMULASI PLOTTING PLACEMENT */}
      <Modal
        open={simModalOpen}
        onClose={() => setSimModalOpen(false)}
        title="⚡ Simulasi Plotting Penempatan Kelas XI"
      >
        <div className="space-y-5">
          {!simResult ? (
            <>
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs text-blue-950">
                <div className="flex items-center gap-2 font-bold text-blue-900 mb-1">
                  <span>ℹ️</span>
                  <span>Tentang Simulasi Plotting Penempatan EduPath XI</span>
                </div>
                <p className="leading-relaxed text-blue-800">
                  Sistem akan memplot ulang siswa yang <strong>sudah mengisi peminatan</strong> secara bertingkat berdasarkan prioritas pilihan (Pilihan 1, 2, 3),
                  diurutkan dari ranking nilai tertinggi (kombinasi Rapor, TKA, dan Minat Bakat RIASEC).
                  Hasilnya bersifat <strong>sementara (TEMPORARY)</strong> dan dapat diulang kapan saja.
                </p>
              </div>

              {/* Status Ringkasan Kuota */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 bg-gray-50 border rounded-xl">
                  <div className="text-gray-500 font-medium">Sudah Ditempatkan</div>
                  <div className="text-lg font-black text-emerald-700 mt-0.5">{stats.totalPlaced}</div>
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="text-indigo-700 font-medium">Kapasitas Kursi</div>
                  <div className="text-lg font-black text-indigo-900 mt-0.5">{stats.totalCapacity}</div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="text-emerald-700 font-medium">Total Rombel</div>
                  <div className="text-lg font-black text-emerald-900 mt-0.5">{classes.length} Kelas</div>
                </div>
              </div>

              {/* Konfigurasi Bobot Seleksi */}
              <div className="space-y-2">
                <Label>Pilih Versi Bobot Seleksi (Scoring Config)</Label>
                <Select
                  value={simConfigId}
                  onChange={(e) => setSimConfigId(e.target.value)}
                  className="w-full text-xs font-bold"
                >
                  {simConfigs.map((cfg) => (
                    <option key={cfg.id} value={String(cfg.id)}>
                      {cfg.name} {cfg.isActive ? '(Aktif)' : ''} — [Rapor: {cfg.academicWeight}%, TKA: {cfg.tkaWeight}%, RIASEC: {cfg.riasecWeight || cfg.preferenceWeight || 0}%]
                    </option>
                  ))}
                  {simConfigs.length === 0 && (
                    <option value="">Versi Aktif Default (50% Rapor, 30% TKA, 20% RIASEC)</option>
                  )}
                </Select>
                <p className="text-[11px] text-gray-500">
                  Formula bobot seleksi menentukan ranking persaingan siswa saat memperebutkan kuota paket kelas yang sama.
                </p>
              </div>

              {/* Opsi Auto-Adjustment & Final Status */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/40 cursor-pointer hover:bg-indigo-50/70 transition">
                  <input
                    type="checkbox"
                    checked={simAutoAdjust}
                    onChange={(e) => setSimAutoAdjust(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-gray-900">
                      ⚡ Auto-Adjustment Sisa Kuota (Direkomendasikan)
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                      Siswa yang tidak tertampung pada pilihan 1–3 akan dialokasikan secara cerdas ke kelas yang masih memiliki sisa kuota berdasarkan keselarasan minat bakat RIASEC & nilai terbaik.
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/60 cursor-pointer hover:bg-gray-100/70 transition">
                  <input
                    type="checkbox"
                    checked={simPreserveFinal}
                    onChange={(e) => setSimPreserveFinal(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-bold text-gray-900">
                      🔒 Pertahankan Siswa Berstatus Resmi (FINAL)
                    </div>
                    <div className="text-[11px] text-gray-600 mt-0.5 leading-relaxed">
                      Jika dicentang, siswa yang sudah berstatus resmi (FINAL) tidak akan dipindahkan dan kursinya tetap dikunci.
                    </div>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button variant="secondary" onClick={() => setSimModalOpen(false)}>
                  Batal
                </Button>
                <Button onClick={runSimulation} disabled={simulating}>
                  {simulating ? 'Sedang Memplot...' : '🚀 Jalankan Plotting Sekarang'}
                </Button>
              </div>
            </>
          ) : (
            /* HASIL PLOTTING */
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                <div className="flex items-center gap-2 font-black text-emerald-900 text-sm">
                  <span>✅</span>
                  <span>Plotting Berhasil Dijalankan!</span>
                </div>
                <p className="text-xs text-emerald-800 mt-1">
                  {simResult.message}
                </p>
              </div>

              {/* STATISTIK HASIL */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-3 bg-white border rounded-xl shadow-2xs">
                  <div className="text-gray-500 font-medium text-[11px]">🥇 Pilihan 1</div>
                  <div className="text-lg font-black text-emerald-700 mt-0.5">
                    {simResult.priorityDistribution?.p1 ?? 0}{' '}
                    <span className="text-[10px] text-gray-400 font-normal">siswa</span>
                  </div>
                </div>
                <div className="p-3 bg-white border rounded-xl shadow-2xs">
                  <div className="text-gray-500 font-medium text-[11px]">🥈 Pilihan 2</div>
                  <div className="text-lg font-black text-blue-700 mt-0.5">
                    {simResult.priorityDistribution?.p2 ?? 0}{' '}
                    <span className="text-[10px] text-gray-400 font-normal">siswa</span>
                  </div>
                </div>
                <div className="p-3 bg-white border rounded-xl shadow-2xs">
                  <div className="text-gray-500 font-medium text-[11px]">🥉 Pilihan 3</div>
                  <div className="text-lg font-black text-teal-700 mt-0.5">
                    {simResult.priorityDistribution?.p3 ?? 0}{' '}
                    <span className="text-[10px] text-gray-400 font-normal">siswa</span>
                  </div>
                </div>
                <div className="p-3 bg-white border rounded-xl shadow-2xs">
                  <div className="text-gray-500 font-medium text-[11px]">🔄 Penyesuaian</div>
                  <div className="text-lg font-black text-amber-700 mt-0.5">
                    {simResult.priorityDistribution?.autoAdjusted ?? 0}{' '}
                    <span className="text-[10px] text-gray-400 font-normal">siswa</span>
                  </div>
                </div>
              </div>

              {/* Rincian Keterisian Kelas */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Keterisian Rombel Pasca Plotting
                </h4>
                <div className="table-wrap max-h-56 overflow-y-auto">
                  <table>
                    <thead>
                      <tr>
                        <th>Kelas XI</th>
                        <th>Paket Peminatan</th>
                        <th className="text-center">Kapasitas</th>
                        <th className="text-center">Terisi</th>
                        <th className="text-center">Sisa</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simResult.classes?.map((c: any) => (
                        <tr key={c.id}>
                          <td className="font-bold text-gray-900">{c.name}</td>
                          <td><span className="badge text-xs">{c.packageTitle}</span></td>
                          <td className="text-center">{c.capacity}</td>
                          <td className="text-center font-bold text-blue-900">{c.placed}</td>
                          <td className="text-center">{c.available}</td>
                          <td className="text-center">
                            <span className={`badge ${c.available === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {c.available === 0 ? 'Penuh' : `Sisa ${c.available}`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t">
                <Button variant="ghost" onClick={() => setSimResult(null)}>
                  ← Ubah Opsi Plotting
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setSimModalOpen(false); loadRecap(); }}>
                    📊 Buka Rekap Lengkap
                  </Button>
                  <Button onClick={() => setSimModalOpen(false)}>
                    Selesai & Lihat Plotting
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}


