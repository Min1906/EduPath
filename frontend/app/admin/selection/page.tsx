'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Input, Label, Modal, PageHeader, Pagination, Select } from '@/components/ui';

export default function SelectionPage() {
  const [packs, setPacks] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [pid, setPid] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('rank');
  const [order, setOrder] = useState('asc');
  const [classFilter, setClassFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({
    name: 'Versi RIASEC 50-30-20',
    academicWeight: 50,
    tkaWeight: 30,
    riasecWeight: 20,
    passingGrade: 70,
  });

  async function base() {
    try {
      const [p, c] = await Promise.all([
        api<any[]>('/packages'),
        api<any[]>('/selection/configs'),
      ]);
      setPacks(p);
      setConfigs(c);
      if (!pid && p[0]) setPid(String(p[0].id));
      if (!selectedConfigId && c[0]) {
        const active = c.find((x) => x.isActive) ?? c[0];
        setSelectedConfigId(String(active.id));
      }
    } catch (e: any) {
      setMsg(`Gagal memuat konfigurasi: ${e.message}`);
    }
  }

  async function ranking() {
    if (!pid) return;
    setLoading(true);
    try {
      const url = `/selection/ranking?packageId=${pid}&configId=${selectedConfigId}&search=${encodeURIComponent(q)}&sortBy=${sort}&sortOrder=${order}`;
      const data = await api(url);
      setRows(data);
    } catch (e: any) {
      setMsg(`Gagal memuat data ranking: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    base();
  }, []);

  useEffect(() => {
    if (pid && selectedConfigId) {
      ranking();
    }
  }, [pid, selectedConfigId, sort, order]);

  async function run() {
    setLoading(true);
    try {
      const res: any = await api('/selection/run', { method: 'POST' });
      setMsg(`Scoring berhasil dijalankan untuk ${res.students} siswa dan ${res.packages} paket kelas.`);
      await base();
      await ranking();
    } catch (e: any) {
      setMsg(`Gagal menjalankan scoring: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function activateConfig(id: number) {
    try {
      await api('/selection/configs/activate', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      setSelectedConfigId(String(id));
      setMsg('Versi scoring berhasil diaktifkan.');
      await base();
    } catch (e: any) {
      alert(`Gagal mengaktifkan: ${e.message}`);
    }
  }

  async function deleteConfig(id: number, name: string) {
    if (!confirm(`Apakah Anda yakin ingin menghapus versi scoring "${name}" beserta seluruh riwayat skor rankingnya?`)) {
      return;
    }
    try {
      const res: any = await api(`/selection/configs/${id}`, { method: 'DELETE' });
      setMsg(res.message);
      if (selectedConfigId === String(id)) {
        setSelectedConfigId('');
      }
      await base();
    } catch (e: any) {
      alert(`Gagal menghapus: ${e.message}`);
    }
  }

  async function create() {
    try {
      const c: any = await api('/selection/configs', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      await api('/selection/configs/activate', {
        method: 'POST',
        body: JSON.stringify({ id: c.id }),
      });
      setSelectedConfigId(String(c.id));
      setOpen(false);
      setMsg('Versi scoring baru berhasil dibuat dan diaktifkan.');
      await base();
    } catch (e: any) {
      alert(e.message);
    }
  }

  // Distinct origin classes for filter (natural sort)
  const distinctClasses = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.student?.originClass?.name) set.add(r.student.originClass.name);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (classFilter !== 'ALL' && r.student?.originClass?.name !== classFilter) return false;
      return true;
    });
  }, [rows, classFilter]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sort === 'rank') {
        valA = a.rank ?? 999999;
        valB = b.rank ?? 999999;
      } else if (sort === 'originClass') {
        valA = a.student?.originClass?.name ?? '';
        valB = b.student?.originClass?.name ?? '';
      } else if (sort === 'name') {
        valA = a.student?.name ?? '';
        valB = b.student?.name ?? '';
      } else if (sort === 'nis') {
        valA = a.student?.nis ?? '';
        valB = b.student?.nis ?? '';
      } else if (sort === 'finalScore') {
        valA = Number(a.finalScore ?? 0);
        valB = Number(b.finalScore ?? 0);
      } else if (sort === 'academicFit') {
        valA = Number(a.academicFit ?? 0);
        valB = Number(b.academicFit ?? 0);
      } else if (sort === 'tkaScore') {
        valA = Number(a.tkaScore ?? 0);
        valB = Number(b.tkaScore ?? 0);
      } else if (sort === 'riasecScore') {
        valA = Number(a.riasecScore ?? 0);
        valB = Number(b.riasecScore ?? 0);
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return order === 'asc' ? valA - valB : valB - valA;
      }
      return order === 'asc'
        ? String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' })
        : String(valB).localeCompare(String(valA), undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [filteredRows, sort, order]);

  const paginatedRows = useMemo(() => {
    if (pageSize >= 999999) return sortedRows;
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  function handleSort(column: string) {
    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setOrder('asc');
    }
    setPage(1);
  }

  function getSortIndicator(column: string) {
    if (sort !== column) return <span className="text-gray-300 ml-1">⇅</span>;
    return <span className="text-blue-700 font-black ml-1">{order === 'asc' ? '▲' : '▼'}</span>;
  }

  const activeConfig = configs.find((c) => c.isActive);
  const currentViewedConfig = configs.find((c) => String(c.id) === selectedConfigId);

  return (
    <>
      <PageHeader
        title="Seleksi & Ranking"
        description="Kelola versi scoring pembobotan rapor, nilai TKA, dan tes minat bakat RIASEC, serta terapkan simulasi ranking siswa."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setOpen(true)}>
              + Buat Scoring Version
            </Button>
            <Button onClick={run} disabled={loading}>
              {loading ? 'Menghitung...' : 'Jalankan Scoring'}
            </Button>
          </div>
        }
      />

      {msg && (
        <div className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-800 flex justify-between items-center shadow-xs">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-blue-600 hover:text-blue-900 text-xs">✕ Tutup</button>
        </div>
      )}

      {/* RIWAYAT VERSI SCORING */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-gray-800">Riwayat Versi Scoring ({configs.length})</h3>
          <span className="text-xs text-gray-500">Klik kartu untuk melihat data ranking versi tersebut</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {configs.map((c) => {
            const isSelected = String(c.id) === selectedConfigId;
            const riasecW = Number(c.riasecWeight) > 0 ? Number(c.riasecWeight) : Number(c.preferenceWeight || 0);

            return (
              <Card
                key={c.id}
                className={`transition cursor-pointer border-2 relative ${
                  isSelected ? 'border-[#2457d6] bg-blue-50/40 shadow-sm' : 'border-transparent hover:border-gray-200'
                }`}
                onClick={() => setSelectedConfigId(String(c.id))}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <b className="text-base text-gray-900">{c.name}</b>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.isActive && <span className="badge bg-green-100 text-green-800 font-bold">Aktif</span>}
                      {isSelected && <span className="badge bg-blue-100 text-blue-800 font-bold">Sedang Dilihat</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-600 space-y-1 bg-gray-50/80 p-2.5 rounded-lg">
                  <div>
                    Bobot: <b>{Number(c.academicWeight)}%</b> Rapor · <b>{Number(c.tkaWeight)}%</b> TKA · <b>{riasecW}%</b> RIASEC
                  </div>
                  <div>Passing Grade: <b>{Number(c.passingGrade)}</b></div>
                </div>
                <div className="mt-3 pt-2.5 border-t flex items-center justify-between text-xs">
                  <span className="text-gray-400">
                    {new Date(c.createdAt).toLocaleDateString('id-ID')}
                  </span>
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {!c.isActive && (
                      <Button
                        variant="secondary"
                        className="px-2.5 py-1 text-xs h-7"
                        onClick={() => activateConfig(c.id)}
                      >
                        Aktifkan
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteConfig(c.id, c.name)}
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition"
                      title="Hapus riwayat versi scoring ini"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}

          {configs.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
              Belum ada konfigurasi scoring. Klik "+ Buat Scoring Version" untuk memulai.
            </div>
          )}
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3 border-b pb-4">
          <div className="min-w-[150px] flex-1">
            <Label>Versi Scoring</Label>
            <Select value={selectedConfigId} onChange={(e) => setSelectedConfigId(e.target.value)}>
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.isActive ? '(Aktif)' : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[180px] flex-1">
            <Label>Paket Kelas</Label>
            <Select value={pid} onChange={(e) => setPid(e.target.value)}>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.class.name} ({p.title})
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[130px]">
            <Label>Filter Kelas Asal</Label>
            <Select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Semua Kelas</option>
              {distinctClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[200px] flex-1">
            <Label>Pencarian</Label>
            <Input
              placeholder="Cari nama atau NIS siswa..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              onKeyDown={(e) => e.key === 'Enter' && ranking()}
            />
          </div>
          <div className="min-w-[140px]">
            <Label>Urutkan</Label>
            <Select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="rank">Peringkat (Rank)</option>
              <option value="originClass">Kelas Asal (X)</option>
              <option value="name">Nama Siswa</option>
              <option value="nis">NIS</option>
              <option value="finalScore">Skor Final</option>
              <option value="academicFit">Academic Fit</option>
              <option value="tkaScore">Skor TKA</option>
              <option value="riasecScore">Skor RIASEC</option>
            </Select>
          </div>
          <div className="min-w-[100px]">
            <Label>Arah</Label>
            <Select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                setPage(1);
              }}
            >
              <option value="asc">Naik (A-Z)</option>
              <option value="desc">Turun (Z-A)</option>
            </Select>
          </div>
          <div className="flex">
            <Button onClick={ranking} className="whitespace-nowrap px-4">
              {loading ? 'Memuat...' : 'Terapkan Filter'}
            </Button>
          </div>
        </div>

        {currentViewedConfig && (
          <div className="mb-3 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-lg flex flex-wrap items-center justify-between gap-2">
            <span>
              Menampilkan data ranking versi: <b>{currentViewedConfig.name}</b> (Rapor: {Number(currentViewedConfig.academicWeight)}%, TKA: {Number(currentViewedConfig.tkaWeight)}%, RIASEC: {Number(currentViewedConfig.riasecWeight) > 0 ? Number(currentViewedConfig.riasecWeight) : Number(currentViewedConfig.preferenceWeight || 0)}%)
            </span>
            <span>Ditemukan: <b>{filteredRows.length}</b> siswa</span>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="w-12 text-center">No</th>
                <th
                  className="cursor-pointer hover:bg-gray-100 transition select-none"
                  onClick={() => handleSort('rank')}
                >
                  <div className="flex items-center">
                    <span>Rank</span>
                    {getSortIndicator('rank')}
                  </div>
                </th>
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
                  onClick={() => handleSort('academicFit')}
                >
                  <div className="flex items-center">
                    <span>Academic Fit</span>
                    {getSortIndicator('academicFit')}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100 transition select-none"
                  onClick={() => handleSort('tkaScore')}
                >
                  <div className="flex items-center">
                    <span>Nilai TKA</span>
                    {getSortIndicator('tkaScore')}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100 transition select-none"
                  onClick={() => handleSort('riasecScore')}
                >
                  <div className="flex items-center">
                    <span>Skor RIASEC</span>
                    {getSortIndicator('riasecScore')}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100 transition select-none"
                  onClick={() => handleSort('finalScore')}
                >
                  <div className="flex items-center">
                    <span>Skor Final</span>
                    {getSortIndicator('finalScore')}
                  </div>
                </th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((r, i) => {
                const rowNo = pageSize >= 999999 ? i + 1 : (page - 1) * pageSize + i + 1;
                return (
                  <tr key={r.id}>
                    <td className="text-center font-medium text-gray-500">{rowNo}</td>
                    <td>
                      <span className="inline-flex items-center justify-center font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-xs">
                        #{r.rank ?? '-'}
                      </span>
                    </td>
                    <td><span className="font-mono text-xs font-semibold">{r.student.nis}</span></td>
                    <td className="font-bold">{r.student.name}</td>
                    <td>
                      <span className="badge">{r.student.originClass?.name ?? '-'}</span>
                    </td>
                    <td>{Number(r.academicFit).toFixed(2)}</td>
                    <td>{Number(r.tkaScore).toFixed(2)}</td>
                    <td>
                      <span className="font-semibold text-purple-700">
                        {Number(r.riasecScore ?? 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="font-bold text-blue-800">{Number(r.finalScore).toFixed(2)}</td>
                    <td className="text-center">
                      <span
                        className={`badge ${
                          r.eligible ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.eligible ? 'ELIGIBLE' : 'REVIEW'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-500">
                    Tidak ada data ranking. Pastikan Anda telah mengklik tombol <b>Jalankan Scoring</b> terlebih dahulu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={filteredRows.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          label="siswa"
        />
      </Card>

      <Modal
        open={open}
        title="Buat Scoring Version Baru"
        onClose={() => setOpen(false)}
        footer={<Button onClick={create}>Simpan & Aktifkan</Button>}
      >
        <div className="space-y-4">
          <div>
            <Label>Nama Versi Scoring</Label>
            <Input
              placeholder="Contoh: Versi Rapor-RIASEC 50-30-20"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Bobot Rapor (%)</Label>
              <Input
                type="number"
                value={form.academicWeight}
                onChange={(e) => setForm({ ...form, academicWeight: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Bobot TKA (%)</Label>
              <Input
                type="number"
                value={form.tkaWeight}
                onChange={(e) => setForm({ ...form, tkaWeight: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Bobot RIASEC (%)</Label>
              <Input
                type="number"
                value={form.riasecWeight}
                onChange={(e) => setForm({ ...form, riasecWeight: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600">
            Total Bobot: <b>{Number(form.academicWeight) + Number(form.tkaWeight) + Number(form.riasecWeight)}%</b> (harus 100%)
          </div>
          <div>
            <Label>Passing Grade Minimal</Label>
            <Input
              type="number"
              value={form.passingGrade}
              onChange={(e) => setForm({ ...form, passingGrade: Number(e.target.value) })}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
