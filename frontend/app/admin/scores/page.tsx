'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, download } from '@/lib/api';
import { Button, Card, Input, PageHeader, Pagination, Select } from '@/components/ui';
import { FileImportDropzone } from '@/components/file-import-dropzone';

export default function ScoresPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');
  const [classFilter, setClassFilter] = useState('ALL');
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(25);
  const [recapPage, setRecapPage] = useState(1);
  const [recapPageSize, setRecapPageSize] = useState(25);
  const [viewTab, setViewTab] = useState<'students' | 'recap'>('students');
  const [frozen, setFrozen] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedRiasecStudent, setSelectedRiasecStudent] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [d, s, pkgs] = await Promise.all([
        api<any[]>(`/scores/summary?search=${encodeURIComponent(q)}`),
        api<any>('/scores/status'),
        api<any[]>('/packages').catch(() => []),
      ]);
      setRows(d);
      setFrozen(s.frozen);
      setPackages(pkgs);
    } catch (e: any) {
      setMsg(`Gagal memuat data: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Distinct origin classes for filter
  const distinctClasses = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.originClass && r.originClass !== '-') set.add(r.originClass);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [rows]);

  const filteredStudents = useMemo(() => {
    return rows.filter((r) => {
      if (classFilter !== 'ALL' && r.originClass !== classFilter) return false;
      return true;
    });
  }, [rows, classFilter]);

  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      let x = a[sort] ?? '';
      let y = b[sort] ?? '';
      if (sort === 'riasec') {
        x = a.riasec?.dominant ?? '';
        y = b.riasec?.dominant ?? '';
      }
      const v = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return order === 'asc' ? v : -v;
    });
  }, [filteredStudents, sort, order]);

  const paginatedStudents = useMemo(() => {
    if (studentPageSize >= 999999) return sortedStudents;
    const start = (studentPage - 1) * studentPageSize;
    return sortedStudents.slice(start, start + studentPageSize);
  }, [sortedStudents, studentPage, studentPageSize]);

  function handleSort(column: string) {
    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setOrder('asc');
    }
    setStudentPage(1);
  }

  function getSortIndicator(column: string) {
    if (sort !== column) return <span className="text-gray-300 ml-1">⇅</span>;
    return <span className="text-blue-700 font-black ml-1">{order === 'asc' ? '▲' : '▼'}</span>;
  }

  // Rekapitulasi Pilihan Paket (P1, P2, P3)
  const choiceRecap = useMemo(() => {
    const recapMap = new Map<string, { id: number; name: string; title: string; capacity: number; p1: number; p2: number; p3: number; total: number }>();

    packages.forEach((pkg) => {
      recapMap.set(pkg.class.name, {
        id: pkg.id,
        name: pkg.class.name,
        title: pkg.title,
        capacity: pkg.capacity,
        p1: 0,
        p2: 0,
        p3: 0,
        total: 0,
      });
    });

    rows.forEach((student) => {
      student.choices?.forEach((c: any) => {
        const entry = recapMap.get(c.className) ?? {
          id: c.packageId,
          name: c.className,
          title: '',
          capacity: 36,
          p1: 0,
          p2: 0,
          p3: 0,
          total: 0,
        };

        if (c.priority === 1) entry.p1 += 1;
        if (c.priority === 2) entry.p2 += 1;
        if (c.priority === 3) entry.p3 += 1;
        entry.total += 1;

        recapMap.set(c.className, entry);
      });
    });

    return [...recapMap.values()].sort((a, b) => b.p1 - a.p1 || b.total - a.total);
  }, [rows, packages]);

  // Statistik Ringkas
  const stats = useMemo(() => {
    const total = rows.length;
    const withReport = rows.filter((r) => r.reportAverage !== null).length;
    const withTka = rows.filter((r) => r.tka !== null).length;
    const withRiasec = rows.filter((r) => r.riasec !== null).length;
    const withChoices = rows.filter((r) => r.choices && r.choices.length > 0).length;
    return { total, withReport, withTka, withRiasec, withChoices };
  }, [rows]);

  async function freeze() {
    try {
      await api(frozen ? '/scores/unfreeze' : '/scores/freeze', { method: 'POST' });
      setMsg(frozen ? 'Freeze data nilai dibuka.' : 'Data nilai berhasil di-freeze (dikunci).');
      load();
    } catch (e: any) {
      setMsg(`Gagal: ${e.message}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Nilai Akademik, TKA & Tes RIASEC"
        description="Ringkasan nilai rapor Semester 1–2, nilai TKA, profil tes minat RIASEC, dan sebaran pilihan paket kelas XI."
        actions={
          <Button
            variant={frozen ? 'secondary' : 'primary'}
            onClick={freeze}
          >
            {frozen ? '🔓 Buka Freeze Data' : '🔒 Freeze Data Nilai'}
          </Button>
        }
      />

      {msg && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 p-3 text-sm text-blue-800 shadow-xs">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-xs text-blue-600 hover:text-blue-900">✕ Tutup</button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Total Siswa</div>
          <div className="mt-1 text-2xl font-black text-gray-900">{stats.total}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Nilai Rapor</div>
          <div className="mt-1 text-2xl font-black text-blue-600">{stats.withReport} <span className="text-xs text-gray-400 font-normal">/ {stats.total}</span></div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Nilai TKA</div>
          <div className="mt-1 text-2xl font-black text-indigo-600">{stats.withTka} <span className="text-xs text-gray-400 font-normal">/ {stats.total}</span></div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Tes RIASEC</div>
          <div className="mt-1 text-2xl font-black text-purple-600">{stats.withRiasec} <span className="text-xs text-gray-400 font-normal">/ {stats.total}</span></div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Pilih Paket</div>
          <div className="mt-1 text-2xl font-black text-emerald-600">{stats.withChoices} <span className="text-xs text-gray-400 font-normal">/ {stats.total}</span></div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Status Data</div>
          <div className="mt-1">
            <span className={`badge ${frozen ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
              {frozen ? 'Terkunci (Freeze)' : 'Bebas Diedit'}
            </span>
          </div>
        </div>
      </div>

      {/* TAB NAVIGATION */}
      <div className="mb-4 flex gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
            viewTab === 'students'
              ? 'bg-[#10285f] text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setViewTab('students')}
        >
          📋 Tabel Daftar Nilai, RIASEC & Pilihan Siswa
        </button>
        <button
          type="button"
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
            viewTab === 'recap'
              ? 'bg-[#10285f] text-white shadow-sm'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setViewTab('recap')}
        >
          📊 Tabel Rekapitulasi Peminat Paket (P1, P2, P3)
        </button>
      </div>

      {/* TAB 1: DAFTAR NILAI & PILIHAN SISWA */}
      {viewTab === 'students' && (
        <Card>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_160px_120px_auto]">
            <Input
              placeholder="Cari nama atau NIS siswa..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setStudentPage(1);
              }}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
            <Select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setStudentPage(1);
              }}
            >
              <option value="ALL">Semua Kelas Asal</option>
              {distinctClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setStudentPage(1);
              }}
            >
              <option value="name">Sort: Nama Siswa</option>
              <option value="nis">Sort: NIS</option>
              <option value="originClass">Sort: Kelas Asal</option>
              <option value="reportAverage">Sort: Rata-rata Rapor</option>
              <option value="tka">Sort: Nilai TKA</option>
              <option value="riasec">Sort: Kode Dominan RIASEC</option>
              <option value="semester1">Sort: Semester 1</option>
              <option value="semester2">Sort: Semester 2</option>
            </Select>
            <Select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                setStudentPage(1);
              }}
            >
              <option value="asc">Naik (A-Z / Rendah)</option>
              <option value="desc">Turun (Z-A / Tinggi)</option>
            </Select>
            <Button onClick={load}>Cari</Button>
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
                      <span>Kelas Asal</span>
                      {getSortIndicator('originClass')}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:bg-gray-100 transition select-none"
                    onClick={() => handleSort('semester1')}
                  >
                    <div className="flex items-center">
                      <span>S1</span>
                      {getSortIndicator('semester1')}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:bg-gray-100 transition select-none"
                    onClick={() => handleSort('semester2')}
                  >
                    <div className="flex items-center">
                      <span>S2</span>
                      {getSortIndicator('semester2')}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:bg-gray-100 transition select-none"
                    onClick={() => handleSort('reportAverage')}
                  >
                    <div className="flex items-center">
                      <span>Rata Rapor</span>
                      {getSortIndicator('reportAverage')}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:bg-gray-100 transition select-none"
                    onClick={() => handleSort('tka')}
                  >
                    <div className="flex items-center">
                      <span>TKA</span>
                      {getSortIndicator('tka')}
                    </div>
                  </th>
                  <th
                    className="cursor-pointer hover:bg-gray-100 transition select-none"
                    onClick={() => handleSort('riasec')}
                  >
                    <div className="flex items-center">
                      <span>RIASEC</span>
                      {getSortIndicator('riasec')}
                    </div>
                  </th>
                  <th className="min-w-[120px]">Pilihan 1</th>
                  <th className="min-w-[120px]">Pilihan 2</th>
                  <th className="min-w-[120px]">Pilihan 3</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((r, i) => {
                  const rowNo = studentPageSize >= 999999 ? i + 1 : (studentPage - 1) * studentPageSize + i + 1;
                  const p1 = r.choices?.find((c: any) => c.priority === 1);
                  const p2 = r.choices?.find((c: any) => c.priority === 2);
                  const p3 = r.choices?.find((c: any) => c.priority === 3);

                  return (
                    <tr key={r.id}>
                      <td className="text-center font-medium text-gray-500">{rowNo}</td>
                      <td><span className="font-mono text-xs font-semibold">{r.nis}</span></td>
                      <td className="font-bold">{r.name}</td>
                      <td><span className="badge">{r.originClass ?? '-'}</span></td>
                      <td>{r.semester1 !== null && r.semester1 !== undefined ? Number(r.semester1).toFixed(2) : '-'}</td>
                      <td>{r.semester2 !== null && r.semester2 !== undefined ? Number(r.semester2).toFixed(2) : '-'}</td>
                      <td>
                        {r.reportAverage !== null && r.reportAverage !== undefined ? (
                          <span className="font-bold text-blue-700">{Number(r.reportAverage).toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        {r.tka !== null && r.tka !== undefined ? (
                          <span className="font-bold text-indigo-700">{Number(r.tka).toFixed(2)}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      {/* RIASEC Dominant Code */}
                      <td>
                        {r.riasec ? (
                          <button
                            type="button"
                            onClick={() => setSelectedRiasecStudent(r)}
                            className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-xs font-black text-purple-800 border border-purple-200 hover:bg-purple-100 transition"
                            title="Klik untuk melihat detail skor R-I-A-S-E-C"
                          >
                            <span>🎯</span>
                            <span>{r.riasec.dominant || 'RIA'}</span>
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      {/* Pilihan 1 */}
                      <td>
                        {p1 ? (
                          <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 border border-blue-200">
                            {p1.className}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      {/* Pilihan 2 */}
                      <td>
                        {p2 ? (
                          <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-800 border border-indigo-200">
                            {p2.className}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      {/* Pilihan 3 */}
                      <td>
                        {p3 ? (
                          <span className="inline-flex items-center rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800 border border-slate-200">
                            {p3.className}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {paginatedStudents.length === 0 && (
                  <tr>
                    <td colSpan={12} className="py-8 text-center text-gray-500">
                      Tidak ada data siswa ditemukan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            totalItems={filteredStudents.length}
            currentPage={studentPage}
            pageSize={studentPageSize}
            onPageChange={setStudentPage}
            onPageSizeChange={setStudentPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            label="siswa"
          />
        </Card>
      )}

      {/* TAB 2: REKAPITULASI PEMINAT PAKET */}
      {viewTab === 'recap' && (
        <Card>
          <div className="mb-3">
            <h3 className="text-base font-bold text-gray-800">Tabel Rekapitulasi Peminat Paket Kelas XI</h3>
            <p className="text-xs text-gray-500">
              Jumlah pemilih masing-masing paket berdasarkan urutan prioritas (Pilihan 1, Pilihan 2, dan Pilihan 3).
            </p>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-12 text-center">No</th>
                  <th>Kelas XI</th>
                  <th>Nama Paket</th>
                  <th>Kapasitas</th>
                  <th className="bg-blue-50 text-blue-900 font-black">Pilihan 1 (P1)</th>
                  <th className="bg-indigo-50 text-indigo-900 font-bold">Pilihan 2 (P2)</th>
                  <th className="bg-slate-50 text-slate-900 font-bold">Pilihan 3 (P3)</th>
                  <th>Total Peminat</th>
                  <th>Status Kuota P1</th>
                </tr>
              </thead>
              <tbody>
                {choiceRecap
                  .slice(
                    recapPageSize >= 999999 ? 0 : (recapPage - 1) * recapPageSize,
                    recapPageSize >= 999999 ? choiceRecap.length : recapPage * recapPageSize,
                  )
                  .map((pkg, idx) => {
                    const rowNo = recapPageSize >= 999999 ? idx + 1 : (recapPage - 1) * recapPageSize + idx + 1;
                    const rasio = pkg.capacity > 0 ? (pkg.p1 / pkg.capacity) * 100 : 0;
                    return (
                      <tr key={pkg.name}>
                        <td className="text-center font-medium text-gray-500">{rowNo}</td>
                        <td className="font-black text-sm">{pkg.name}</td>
                        <td className="text-xs text-gray-600">{pkg.title || '-'}</td>
                        <td><b>{pkg.capacity}</b> siswa</td>
                        <td className="bg-blue-50 font-black text-blue-700 text-base">{pkg.p1}</td>
                        <td className="bg-indigo-50 font-bold text-indigo-700">{pkg.p2}</td>
                        <td className="bg-slate-50 font-bold text-slate-700">{pkg.p3}</td>
                        <td className="font-bold">{pkg.total} pemilih</td>
                        <td>
                          <span
                            className={`badge ${
                              pkg.p1 > pkg.capacity
                                ? 'bg-red-100 text-red-800'
                                : pkg.p1 === pkg.capacity
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {pkg.p1 > pkg.capacity
                              ? `Over demand (+${pkg.p1 - pkg.capacity})`
                              : `${pkg.p1}/${pkg.capacity} (${rasio.toFixed(0)}%)`}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {choiceRecap.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-gray-500">
                      Belum ada paket kelas atau data pilihan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            totalItems={choiceRecap.length}
            currentPage={recapPage}
            pageSize={recapPageSize}
            onPageChange={setRecapPage}
            onPageSizeChange={setRecapPageSize}
            pageSizeOptions={[10, 25, 50]}
            label="paket"
          />
        </Card>
      )}

      {/* IMPORT SECTION (3 MODALITIES: RAPOR, TKA, RIASEC) */}
      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <span>📥</span>
            <span>Import Data Nilai Akademik, TKA & Profil RIASEC</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Unggah file Excel/CSV untuk membaca dan menambahkan nilai rapor siswa, nilai tes kemampuan akademik, serta hasil tes minat bakat RIASEC ke dalam database.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* IMPORT RAPOR */}
          <FileImportDropzone
            title="Import Nilai Rapor"
            description="Nilai rapor Semester 1 & 2 per mata pelajaran siswa."
            templateUrl="/scores/report-template"
            templateFileName="template-import-rapor.xlsx"
            uploadEndpoint="/scores/import-report"
            themeColor="blue"
            icon="📚"
            disabled={frozen}
            disabledMessage="Data nilai sedang di-freeze (dikunci). Buka freeze di atas untuk import."
            buttonLabel="Import Nilai Rapor ke Database"
            onSuccess={() => {
              load();
            }}
          />

          {/* IMPORT TKA */}
          <FileImportDropzone
            title="Import Nilai TKA"
            description="Nilai Tes Kemampuan Akademik (TKA) siswa."
            templateUrl="/scores/tka-template"
            templateFileName="template-import-tka.xlsx"
            uploadEndpoint="/scores/import-tka"
            themeColor="indigo"
            icon="📝"
            disabled={frozen}
            disabledMessage="Data nilai sedang di-freeze (dikunci). Buka freeze di atas untuk import."
            buttonLabel="Import Nilai TKA ke Database"
            onSuccess={() => {
              load();
            }}
          />

          {/* IMPORT RIASEC */}
          <FileImportDropzone
            title="Import Hasil Tes RIASEC"
            description="6 Dimensi Holland (Realistic, Investigative, Artistic, Social, Enterprising, Conventional)."
            templateUrl="/scores/riasec-template"
            templateFileName="template-import-riasec.xlsx"
            uploadEndpoint="/scores/import-riasec"
            themeColor="purple"
            icon="🎯"
            disabled={frozen}
            disabledMessage="Data nilai sedang di-freeze (dikunci). Buka freeze di atas untuk import."
            buttonLabel="Import Hasil RIASEC ke Database"
            onSuccess={() => {
              load();
            }}
          />
        </div>
      </div>

      {/* POPUP DETAIL SKOR RIASEC SISWA */}
      {selectedRiasecStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fadeIn"
          onClick={() => setSelectedRiasecStudent(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-base text-gray-900">
                  Profil Hasil Tes RIASEC
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {selectedRiasecStudent.name} (NIS: {selectedRiasecStudent.nis})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRiasecStudent(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-purple-50 p-3 text-sm">
                <span className="font-semibold text-purple-900">Tipe Kepribadian Dominan:</span>
                <span className="rounded-lg bg-purple-700 px-3 py-1 font-black text-white">
                  {selectedRiasecStudent.riasec?.dominant || 'RIA'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border p-2.5 bg-gray-50/50">
                  <div className="text-gray-500 font-medium">R - Realistic</div>
                  <div className="text-base font-black text-blue-700">{selectedRiasecStudent.riasec?.r ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Praktikal / Fisik / Mesin</div>
                </div>
                <div className="rounded-lg border p-2.5 bg-gray-50/50">
                  <div className="text-gray-500 font-medium">I - Investigative</div>
                  <div className="text-base font-black text-indigo-700">{selectedRiasecStudent.riasec?.i ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Analitis / Ilmiah / Riset</div>
                </div>
                <div className="rounded-lg border p-2.5 bg-gray-50/50">
                  <div className="text-gray-500 font-medium">A - Artistic</div>
                  <div className="text-base font-black text-pink-700">{selectedRiasecStudent.riasec?.a ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Kreatif / Seni / Bahasa</div>
                </div>
                <div className="rounded-lg border p-2.5 bg-gray-50/50">
                  <div className="text-gray-500 font-medium">S - Social</div>
                  <div className="text-base font-black text-emerald-700">{selectedRiasecStudent.riasec?.s ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Sosial / Pelayanan / Edukasi</div>
                </div>
                <div className="rounded-lg border p-2.5 bg-gray-50/50">
                  <div className="text-gray-500 font-medium">E - Enterprising</div>
                  <div className="text-base font-black text-amber-700">{selectedRiasecStudent.riasec?.e ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Bisnis / Kepemimpinan</div>
                </div>
                <div className="rounded-lg border p-2.5 bg-gray-50/50">
                  <div className="text-gray-500 font-medium">C - Conventional</div>
                  <div className="text-base font-black text-cyan-700">{selectedRiasecStudent.riasec?.c ?? 0}</div>
                  <div className="text-[10px] text-gray-400">Data / Terstruktur / Akuntansi</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={() => setSelectedRiasecStudent(null)}>Tutup</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
