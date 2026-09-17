'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Input, Label, Modal, PageHeader, Select } from '@/components/ui';

export default function ClassesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [grade, setGrade] = useState('ALL');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    gradeLevel: 'X',
    category: 'Reguler',
    capacity: '36',
    subjectIds: [] as number[],
  });

  async function load() {
    try {
      const [cls, subs] = await Promise.all([
        api<any[]>('/classes'),
        api<any[]>('/subjects').catch(() => []),
      ]);
      setRows(cls);
      setSubjects(subs);
    } catch (e: any) {
      setMsg(`Gagal memuat data kelas: ${e.message}`);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        const matchGrade = grade === 'ALL' || r.gradeLevel === grade;
        const matchQ =
          r.name.toLowerCase().includes(q.toLowerCase()) ||
          (r.category && r.category.toLowerCase().includes(q.toLowerCase()));
        return matchGrade && matchQ;
      })
      .sort((a, b) => {
        if (a.gradeLevel !== b.gradeLevel) {
          return a.gradeLevel === 'X' ? -1 : 1;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });
  }, [rows, grade, q]);

  // Statistik Ringkas
  const stats = useMemo(() => {
    const totalClasses = rows.length;
    const countX = rows.filter((r) => r.gradeLevel === 'X').length;
    const countXI = rows.filter((r) => r.gradeLevel === 'XI').length;
    const studentsX = rows.filter((r) => r.gradeLevel === 'X').reduce((acc, r) => acc + (r._count?.originStudents ?? 0), 0);
    const studentsXI = rows.filter((r) => r.gradeLevel === 'XI').reduce((acc, r) => acc + (r._count?.placedStudents ?? 0), 0);
    return { totalClasses, countX, countXI, studentsX, studentsXI };
  }, [rows]);

  function openCreate() {
    setEditingClass(null);
    setFormData({
      name: '',
      gradeLevel: 'X',
      category: 'Reguler',
      capacity: '36',
      subjectIds: [],
    });
    setFormOpen(true);
  }

  function openEdit(cls: any) {
    setEditingClass(cls);
    setFormData({
      name: cls.name,
      gradeLevel: cls.gradeLevel,
      category: cls.category || 'Reguler',
      capacity: String(cls.capacity || 36),
      subjectIds: cls.subjects?.map((s: any) => s.subjectId) || [],
    });
    setFormOpen(true);
  }

  async function saveClass() {
    if (!formData.name.trim()) {
      alert('Nama kelas wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        gradeLevel: formData.gradeLevel,
        category: formData.category.trim() || null,
        capacity: Number(formData.capacity) || 36,
        subjectIds: formData.subjectIds,
      };

      if (editingClass) {
        await api(`/classes/${editingClass.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setMsg(`Kelas "${formData.name}" berhasil diperbarui.`);
      } else {
        await api('/classes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMsg(`Kelas "${formData.name}" berhasil dibuat.`);
      }
      setFormOpen(false);
      load();
    } catch (e: any) {
      alert(`Gagal menyimpan: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteClass(cls: any) {
    const studentCount = cls.gradeLevel === 'X' ? cls._count?.originStudents : cls._count?.placedStudents;
    if (studentCount > 0) {
      alert(`Kelas "${cls.name}" memiliki ${studentCount} siswa dan tidak dapat dihapus. Silakan pindahkan data siswa terlebih dahulu.`);
      return;
    }
    if (!confirm(`Hapus kelas "${cls.name}"?`)) return;

    try {
      const r: any = await api(`/classes/${cls.id}`, { method: 'DELETE' });
      setMsg(r.message || `Kelas "${cls.name}" berhasil dihapus.`);
      load();
    } catch (e: any) {
      alert(`Gagal menghapus: ${e.message}`);
    }
  }

  function toggleSubject(subId: number) {
    setFormData((prev) => {
      const exists = prev.subjectIds.includes(subId);
      return {
        ...prev,
        subjectIds: exists
          ? prev.subjectIds.filter((id) => id !== subId)
          : [...prev.subjectIds, subId],
      };
    });
  }

  return (
    <>
      <PageHeader
        title="Daftar Kelas"
        description="Kelola data kelas tingkat X dan kelas penempatan tingkat XI, kapasitas rombel, dan daftar siswa."
        actions={
          <Button onClick={openCreate}>+ Tambah Kelas</Button>
        }
      />

      {msg && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 p-3 text-sm text-blue-800">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-xs text-blue-600 hover:text-blue-900">✕ Tutup</button>
        </div>
      )}

      {/* Metric Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Total Kelas</div>
          <div className="mt-1 text-2xl font-black text-gray-900">{stats.totalClasses}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Kelas X (Asal)</div>
          <div className="mt-1 text-2xl font-black text-blue-600">
            {stats.countX} <span className="text-xs text-gray-400 font-normal">({stats.studentsX} siswa)</span>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Kelas XI (Placement)</div>
          <div className="mt-1 text-2xl font-black text-indigo-600">
            {stats.countXI} <span className="text-xs text-gray-400 font-normal">({stats.studentsXI} siswa terplot)</span>
          </div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold text-gray-500">Filter Aktif</div>
          <div className="mt-1">
            <span className="badge bg-gray-100 text-gray-800">
              {grade === 'ALL' ? 'Semua Tingkat' : `Tingkat ${grade}`}
            </span>
          </div>
        </div>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap gap-3">
          <Select className="max-w-48" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="ALL">Semua Tingkat</option>
            <option value="X">Tingkat X (Kelas Asal)</option>
            <option value="XI">Tingkat XI (Kelas Paket)</option>
          </Select>
          <Input
            className="max-w-sm"
            placeholder="Cari nama kelas atau kategori..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const studentCount = r.gradeLevel === 'X' ? r._count?.originStudents ?? 0 : r._count?.placedStudents ?? 0;
            const isFull = studentCount >= r.capacity;

            return (
              <div key={r.id} className="rounded-xl border bg-white p-5 shadow-sm hover:border-gray-300 transition">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-black text-lg text-gray-900">{r.name}</h3>
                    <div className="text-xs text-[#667085]">
                      {r.category ?? 'Reguler'} · <span className="font-bold text-blue-700">Tingkat {r.gradeLevel}</span>
                    </div>
                  </div>
                  <span className={`badge ${isFull ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                    {isFull ? 'Penuh' : `Sisa ${r.capacity - studentCount}`}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5">
                  <span>Terisi: <b>{studentCount}</b> / {r.capacity} siswa</span>
                  <span className="font-mono font-semibold">{((studentCount / r.capacity) * 100).toFixed(0)}%</span>
                </div>

                {r.package && (
                  <div className="mt-2 text-xs text-indigo-700 font-semibold">
                    📦 Terhubung ke Paket: {r.package.title}
                  </div>
                )}

                {r.subjects && r.subjects.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500 line-clamp-1">
                    <b>Mapel:</b> {r.subjects.map((x: any) => x.subject?.name).join(', ')}
                  </div>
                )}

                <div className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-1.5">
                  <Button variant="secondary" className="text-xs h-8 px-3" onClick={() => setSel(r)}>
                    Lihat Siswa ({studentCount})
                  </Button>
                  <div className="flex gap-1">
                    <Button variant="ghost" className="text-xs h-8 px-3" onClick={() => openEdit(r)}>
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      className="text-xs h-8 px-3"
                      disabled={studentCount > 0}
                      title={studentCount > 0 ? 'Tidak dapat dihapus karena ada siswa' : 'Hapus kelas'}
                      onClick={() => deleteClass(r)}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500">
              Tidak ada data kelas yang sesuai dengan filter pencarian.
            </div>
          )}
        </div>
      </Card>

      {/* Modal Tambah / Edit Kelas */}
      <Modal
        open={formOpen}
        title={editingClass ? `Edit Kelas · ${editingClass.name}` : 'Tambah Kelas Baru'}
        onClose={() => setFormOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>Batal</Button>
            <Button onClick={saveClass} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Kelas'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nama Kelas</Label>
              <Input
                placeholder="Contoh: X-1, XI-1, XI-F1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Tingkat Kelas</Label>
              <Select
                value={formData.gradeLevel}
                onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
              >
                <option value="X">Kelas X (Kelas Asal)</option>
                <option value="XI">Kelas XI (Kelas Placement)</option>
              </Select>
            </div>
            <div>
              <Label>Kategori / Kelompok</Label>
              <Input
                placeholder="Contoh: Reguler, Peminatan, IPA, IPS"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              />
            </div>
            <div>
              <Label>Kapasitas Siswa</Label>
              <Input
                type="number"
                placeholder="Contoh: 36"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </div>
          </div>

          {subjects.length > 0 && (
            <div>
              <Label>Mata Pelajaran Terkait (Opsional)</Label>
              <div className="max-h-40 overflow-y-auto rounded-xl border p-3 grid grid-cols-2 gap-2 bg-gray-50">
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.subjectIds.includes(s.id)}
                      onChange={() => toggleSubject(s.id)}
                    />
                    <span>{s.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Daftar Siswa Dalam Kelas */}
      <Modal
        open={!!sel}
        title={`Daftar Siswa · ${sel?.name ?? ''} (Tingkat ${sel?.gradeLevel ?? ''})`}
        onClose={() => setSel(null)}
      >
        <div className="mb-3 flex items-center justify-between text-xs text-gray-600">
          <span>Kapasitas: <b>{sel?.capacity}</b> siswa</span>
          <span>
            Total Siswa Terdaftar: <b>{sel?.gradeLevel === 'X' ? sel?.originStudents?.length ?? 0 : sel?.placedStudents?.length ?? 0}</b> siswa
          </span>
        </div>

        <div className="table-wrap max-h-96 overflow-y-auto">
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>NIS</th>
                <th>Nama Siswa</th>
                <th>Jenis Kelamin</th>
                <th>{sel?.gradeLevel === 'X' ? 'Placement XI' : 'Kelas Asal X'}</th>
              </tr>
            </thead>
            <tbody>
              {(sel?.gradeLevel === 'X' ? sel?.originStudents : sel?.placedStudents)?.map(
                (s: any, i: number) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td><span className="font-mono text-xs font-semibold">{s.nis}</span></td>
                    <td className="font-bold">{s.name}</td>
                    <td><span className="badge">{s.gender === 'L' ? 'Laki-laki' : s.gender === 'P' ? 'Perempuan' : s.gender ?? '-'}</span></td>
                    <td>
                      {sel?.gradeLevel === 'X' ? (
                        s.placedClass?.name ? (
                          <span className="badge bg-green-100 text-green-800">{s.placedClass.name}</span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )
                      ) : (
                        <span className="badge">{s.originClass?.name ?? '-'}</span>
                      )}
                    </td>
                  </tr>
                ),
              )}
              {(!(sel?.gradeLevel === 'X' ? sel?.originStudents : sel?.placedStudents)?.length) && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-500">
                    Belum ada siswa yang terdaftar di kelas ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}

