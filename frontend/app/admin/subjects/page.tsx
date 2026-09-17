'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Input, Label, Modal, PageHeader, Select } from '@/components/ui';

export default function SubjectsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>();
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<{ code: string; name: string; groupName: string }>({
    code: '',
    name: '',
    groupName: 'UMUM',
  });

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

  async function loadSubjects(yearId: string) {
    setLoading(true);
    try {
      const query = yearId && yearId !== 'ALL' ? `?academicYearId=${yearId}` : '';
      const data = await api<any[]>(`/subjects${query}`);
      setRows(data || []);
    } catch (e) {
      console.error('Gagal memuat mata pelajaran:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadYears();
  }, []);

  useEffect(() => {
    if (selectedYearId) {
      loadSubjects(selectedYearId);
    }
  }, [selectedYearId]);

  const activeYearObj = useMemo(
    () => academicYears.find((y) => String(y.id) === selectedYearId),
    [academicYears, selectedYearId]
  );

  const filtered = useMemo(
    () => rows.filter((r) => `${r.code} ${r.name} ${r.groupName}`.toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );

  function start(r?: any) {
    setEdit(r);
    setForm({
      code: r?.code ?? '',
      name: r?.name ?? '',
      groupName: r?.groupName ?? 'UMUM',
    });
    setOpen(true);
  }

  async function save() {
    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      groupName: form.groupName,
    };
    await api(edit ? `/subjects/${edit.id}` : '/subjects', {
      method: edit ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    setOpen(false);
    loadSubjects(selectedYearId);
  }

  async function del(id: number) {
    if (!confirm('Hapus mata pelajaran ini?')) return;
    await api(`/subjects/${id}`, { method: 'DELETE' });
    loadSubjects(selectedYearId);
  }

  return (
    <>
      <PageHeader
        title="Mata Pelajaran"
        description="Terhubung dengan nilai rapor, kelas rombel, dan paket peminatan."
        actions={<Button onClick={() => start()}>+ Tambah Mapel</Button>}
      />

      <Card>
        {/* FILTER BAR: SEARCH & TAHUN AJARAN */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 pb-4 border-b border-gray-100">
          <div className="flex-1 max-w-md">
            <Label className="text-xs text-gray-500 mb-1">Pencarian Mapel</Label>
            <Input
              placeholder="Cari mapel, kode, atau kelompok..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="w-full sm:w-72">
            <Label className="text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
              <span>📅 Filter Nilai Rapor Per Tahun:</span>
              {activeYearObj?.isActive && (
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                  Aktif
                </span>
              )}
            </Label>
            <Select
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className="font-medium"
            >
              <option value="ALL">Semua Tahun Ajaran (Akumulasi)</option>
              {academicYears.map((y) => (
                <option key={y.id} value={String(y.id)}>
                  Tahun Ajaran {y.name} {y.isActive ? '(Aktif)' : ''}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* YEAR CONTEXT INFO */}
        <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
          <div>
            Menampilkan data mata pelajaran untuk:{' '}
            <span className="font-bold text-gray-800">
              {selectedYearId === 'ALL'
                ? 'Semua Tahun Ajaran'
                : `Tahun Ajaran ${activeYearObj?.name || selectedYearId}`}
            </span>
            {loading && <span className="ml-2 text-blue-600 animate-pulse">(Memuat...)</span>}
          </div>
          <div className="text-right">
            Total: <b>{filtered.length}</b> mapel
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Kode</th>
                <th>Mapel</th>
                <th>Kelompok</th>
                <th>Rata-rata Nilai Rapor</th>
                <th>Rombel Terkait</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td><span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs font-semibold">{r.code}</span></td>
                  <td className="font-bold text-gray-900">{r.name}</td>
                  <td><span className="badge">{r.groupName}</span></td>
                  <td>
                    {r.avgScore !== null && r.avgScore !== undefined ? (
                      <span className="font-bold text-blue-700 text-sm">
                        {Number(r.avgScore).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic text-xs">Belum ada nilai</span>
                    )}
                  </td>
                  <td>{r._count?.classSubjects ?? 0} kelas</td>
                  <td>
                    <div className="flex gap-1.5">
                      <Button variant="ghost" onClick={() => start(r)}>Edit</Button>
                      <Button variant="danger" onClick={() => del(r.id)}>Hapus</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Tidak ada data mata pelajaran yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        open={open}
        title={edit ? 'Edit Mapel' : 'Tambah Mapel'}
        onClose={() => setOpen(false)}
        footer={<Button onClick={save}>Simpan</Button>}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Kode</Label>
            <Input
              placeholder="Contoh: BIO, MAT"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </div>
          <div>
            <Label>Nama Mapel</Label>
            <Input
              placeholder="Contoh: Biologi"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Kelompok</Label>
            <Select
              value={form.groupName}
              onChange={(e) => setForm({ ...form, groupName: e.target.value })}
            >
              <option value="UMUM">UMUM</option>
              <option value="IPA">IPA</option>
              <option value="IPS">IPS</option>
              <option value="TEKNOLOGI">TEKNOLOGI</option>
              <option value="SENI">SENI</option>
            </Select>
          </div>
        </div>
      </Modal>
    </>
  );
}
