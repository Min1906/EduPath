'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, download, getUser } from '@/lib/api';
import { Button, Card, Input, Label, Modal, PageHeader, Pagination, Select } from '@/components/ui';
import { FileImportDropzone } from '@/components/file-import-dropzone';

export default function StudentsPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');
  const [classFilter, setClassFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [detail, setDetail] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'choices' | 'scores'>('profile');
  const [classes, setClasses] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [createForm, setCreateForm] = useState<{
    name: string;
    nis: string;
    nisn: string;
    gender: string;
    originClassId: string;
    username: string;
    password: string;
  }>({
    name: '',
    nis: '',
    nisn: '',
    gender: 'L',
    originClassId: '',
    username: '',
    password: '',
  });

  const [editForm, setEditForm] = useState<{
    name: string;
    nis: string;
    nisn: string;
    gender: string;
    originClassId: string;
    placedClassId: string;
    tkaScore: string;
    choice1: string;
    choice2: string;
    choice3: string;
    isLocked: boolean;
    reportScores: { subjectId: number; subjectName: string; semester1: string; semester2: string }[];
  }>({
    name: '',
    nis: '',
    nisn: '',
    gender: 'L',
    originClassId: '',
    placedClassId: '',
    tkaScore: '',
    choice1: '',
    choice2: '',
    choice3: '',
    isLocked: false,
    reportScores: [],
  });

  const role = getUser()?.role;

  async function load() {
    setRows(await api(`/students?search=${encodeURIComponent(q)}&sortBy=${sort}&sortOrder=${order}`));
  }

  async function loadAuxData() {
    const [cls, pkgs, subs] = await Promise.all([
      api<any[]>('/classes'),
      api<any[]>('/packages'),
      api<any[]>('/subjects'),
    ]);
    setClasses(cls);
    setPackages(pkgs);
    setSubjects(subs);
    return { cls, pkgs, subs };
  }

  useEffect(() => {
    load();
    loadAuxData();
  }, [sort, order]);

  async function saveCreate() {
    if (!createForm.name.trim()) {
      alert('Nama lengkap siswa wajib diisi');
      return;
    }
    if (!createForm.nis.trim()) {
      alert('NIS siswa wajib diisi');
      return;
    }
    try {
      setCreateSaving(true);
      const payload = {
        name: createForm.name.trim(),
        nis: createForm.nis.trim(),
        nisn: createForm.nisn.trim() || undefined,
        gender: createForm.gender,
        originClassId: createForm.originClassId ? Number(createForm.originClassId) : undefined,
        username: createForm.username.trim() || undefined,
        password: createForm.password.trim() || undefined,
      };
      await api('/students', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setMsg(`Siswa "${createForm.name}" berhasil ditambahkan.`);
      setCreateOpen(false);
      setCreateForm({
        name: '',
        nis: '',
        nisn: '',
        gender: 'L',
        originClassId: '',
        username: '',
        password: '',
      });
      load();
    } catch (e: any) {
      alert(`Gagal menambahkan siswa: ${e.message}`);
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) return;
    if (!confirm(`Hapus ${selectedIds.length} data siswa terpilih? Seluruh data akun, nilai rapor, TKA, dan preferensi pilihan akan ikut terhapus permanen.`)) {
      return;
    }
    try {
      const res: any = await api('/students/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });
      setMsg(res.message || `${res.count} siswa berhasil dihapus.`);
      setSelectedIds([]);
      load();
    } catch (e: any) {
      alert(`Gagal menghapus siswa terpilih: ${e.message}`);
    }
  }

  // Filtered & Sorted student list
  const filteredAndSortedRows = useMemo(() => {
    let result = [...rows];

    if (classFilter !== 'ALL') {
      result = result.filter(
        (r) => String(r.originClassId) === classFilter || String(r.placedClassId) === classFilter,
      );
    }

    result.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (sort === 'name') {
        valA = a.name ?? '';
        valB = b.name ?? '';
      } else if (sort === 'nis') {
        valA = a.nis ?? '';
        valB = b.nis ?? '';
      } else if (sort === 'originClass') {
        valA = a.originClass?.name ?? '';
        valB = b.originClass?.name ?? '';
      } else if (sort === 'placedClass') {
        valA = a.placedClass?.name ?? '';
        valB = b.placedClass?.name ?? '';
      } else if (sort === 'createdAt') {
        valA = new Date(a.createdAt).getTime();
        valB = new Date(b.createdAt).getTime();
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return order === 'asc' ? valA - valB : valB - valA;
      }
      return order === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return result;
  }, [rows, classFilter, sort, order]);

  // Paginated Rows
  const paginatedRows = useMemo(() => {
    if (pageSize >= 999999) return filteredAndSortedRows;
    const start = (page - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, page, pageSize]);

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

  async function showDetail(id: number) {
    const d = await api(`/students/detail/${id}`);
    setDetail(d);
  }

  async function startEdit(studentRow: any) {
    const d = await api(`/students/detail/${studentRow.id}`);
    let currentSubs = subjects;
    if (!currentSubs.length) {
      const aux = await loadAuxData();
      currentSubs = aux.subs;
    }

    setEditStudent(d);
    setActiveTab('profile');

    const choices = d.preference?.choices ?? [];
    const p1 = choices.find((c: any) => c.priority === 1)?.packageId ?? '';
    const p2 = choices.find((c: any) => c.priority === 2)?.packageId ?? '';
    const p3 = choices.find((c: any) => c.priority === 3)?.packageId ?? '';

    const scoreTableMap = new Map<number, { semester1: any; semester2: any }>();
    if (d.reportTable) {
      d.reportTable.forEach((item: any) => {
        scoreTableMap.set(item.subjectId, {
          semester1: item.semester1 !== null && item.semester1 !== undefined ? String(item.semester1) : '',
          semester2: item.semester2 !== null && item.semester2 !== undefined ? String(item.semester2) : '',
        });
      });
    }

    const initialReportScores = currentSubs.map((s: any) => {
      const existing = scoreTableMap.get(s.id);
      return {
        subjectId: s.id,
        subjectName: s.name,
        semester1: existing?.semester1 ?? '',
        semester2: existing?.semester2 ?? '',
      };
    });

    setEditForm({
      name: d.name ?? '',
      nis: d.nis ?? '',
      nisn: d.nisn ?? '',
      gender: d.gender ?? 'L',
      originClassId: d.originClassId ? String(d.originClassId) : '',
      placedClassId: d.placedClassId ? String(d.placedClassId) : '',
      tkaScore: d.tkaScore ? String(d.tkaScore.score) : '',
      choice1: p1 ? String(p1) : '',
      choice2: p2 ? String(p2) : '',
      choice3: p3 ? String(p3) : '',
      isLocked: Boolean(d.preference?.isLocked),
      reportScores: initialReportScores,
    });

    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editStudent) return;
    try {
      setSaving(true);

      const flatScores: { subjectId: number; semester: number; score: number | null }[] = [];
      editForm.reportScores.forEach((r) => {
        flatScores.push({
          subjectId: r.subjectId,
          semester: 1,
          score: r.semester1.trim() !== '' ? Number(r.semester1) : null,
        });
        flatScores.push({
          subjectId: r.subjectId,
          semester: 2,
          score: r.semester2.trim() !== '' ? Number(r.semester2) : null,
        });
      });

      const packageIds = [editForm.choice1, editForm.choice2, editForm.choice3]
        .filter(Boolean)
        .map(Number);

      const payload = {
        name: editForm.name.trim(),
        nis: editForm.nis.trim(),
        nisn: editForm.nisn.trim() || null,
        gender: editForm.gender || null,
        originClassId: editForm.originClassId ? Number(editForm.originClassId) : null,
        placedClassId: editForm.placedClassId ? Number(editForm.placedClassId) : null,
        tkaScore: editForm.tkaScore.trim() !== '' ? Number(editForm.tkaScore) : null,
        packageIds,
        isLocked: editForm.isLocked,
        reportScores: flatScores,
      };

      await api(`/students/${editStudent.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setMsg(`Data siswa ${editForm.name} berhasil diperbarui.`);
      setEditOpen(false);
      load();
    } catch (e: any) {
      alert(`Gagal menyimpan: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function delStudent(id: number, name: string) {
    if (!confirm(`Hapus siswa ${name}? Data nilai dan preferensi akan ikut terhapus.`)) return;
    try {
      await api(`/students/${id}`, { method: 'DELETE' });
      setMsg(`Siswa ${name} berhasil dihapus.`);
      load();
    } catch (e: any) {
      alert(`Gagal menghapus: ${e.message}`);
    }
  }

  async function reset() {
    const p = prompt('Password awal sama untuk siswa', 'Siswa123!');
    if (p) {
      const r: any = await api('/students/reset-passwords', {
        method: 'POST',
        body: JSON.stringify({ password: p }),
      });
      setMsg(`${r.updated} akun siswa direset`);
    }
  }

  return (
    <>
      <PageHeader
        title="Data Siswa & Akun"
        description="Kelola data identitas, nilai rapor Semester 1–2, nilai TKA, dan pilihan paket kelas XI."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setCreateOpen(true)}>
              + Tambah Siswa Manual
            </Button>
            <Button
              variant="secondary"
              onClick={() => download('/students/template/download', 'template-import-siswa.xlsx')}
            >
              Template Siswa
            </Button>
            {role === 'SUPER_ADMIN' && (
              <Button
                variant="secondary"
                onClick={() => download('/teachers/template', 'template-import-guru.xlsx')}
              >
                Template Guru
              </Button>
            )}
            <Button variant="secondary" onClick={reset}>Reset Akun Siswa</Button>
          </div>
        }
      />

      {msg && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-green-50 p-3 text-sm text-green-800 shadow-xs animate-fadeIn">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-xs text-green-600 hover:text-green-900">✕ Tutup</button>
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-900 shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
              {selectedIds.length}
            </span>
            <span className="font-bold">
              {selectedIds.length} data siswa terpilih
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" className="h-8 text-xs px-3" onClick={() => setSelectedIds([])}>
              Batal Pilihan
            </Button>
            <Button variant="danger" className="h-8 text-xs px-3 font-bold" onClick={handleBulkDelete}>
              🗑️ Hapus {selectedIds.length} Siswa Terpilih
            </Button>
          </div>
        </div>
      )}

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_160px_120px_auto]">
          <Input
            placeholder="Cari nama / NIS / NISN siswa..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <Select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Semua Kelas</option>
            {classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.gradeLevel} - {c.name}
              </option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="name">Sort: Nama Siswa</option>
            <option value="nis">Sort: NIS</option>
            <option value="originClass">Sort: Kelas Asal (X)</option>
            <option value="placedClass">Sort: Placement (XI)</option>
            <option value="createdAt">Sort: Tanggal Input</option>
          </Select>
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
          <Button onClick={load}>Cari</Button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="w-10 text-center">
                  <input
                    type="checkbox"
                    className="cursor-pointer rounded"
                    checked={paginatedRows.length > 0 && paginatedRows.every((r) => selectedIds.includes(r.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const pageIds = paginatedRows.map((r) => r.id);
                        setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
                      } else {
                        const pageIds = new Set(paginatedRows.map((r) => r.id));
                        setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
                      }
                    }}
                    title="Pilih semua siswa di halaman ini"
                  />
                </th>
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
                  onClick={() => handleSort('placedClass')}
                >
                  <div className="flex items-center">
                    <span>Placement XI</span>
                    {getSortIndicator('placedClass')}
                  </div>
                </th>
                <th>TKA</th>
                <th>Pilihan Kelas XI</th>
                <th>Akun</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((r, i) => {
                const rowNo = pageSize >= 999999 ? i + 1 : (page - 1) * pageSize + i + 1;
                const isSelected = selectedIds.includes(r.id);
                return (
                  <tr key={r.id} className={isSelected ? 'bg-blue-50/40' : undefined}>
                    <td className="text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="cursor-pointer rounded"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds((prev) => [...prev, r.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== r.id));
                          }
                        }}
                      />
                    </td>
                    <td className="text-center font-medium text-gray-500">{rowNo}</td>
                    <td><span className="font-mono text-xs font-semibold">{r.nis}</span></td>
                    <td className="font-bold">{r.name}</td>
                    <td><span className="badge">{r.originClass?.name ?? '-'}</span></td>
                    <td>
                      {r.placedClass?.name ? (
                        <span className="badge bg-green-100 text-green-800 font-bold">{r.placedClass.name}</span>
                      ) : (
                        <span className="text-gray-400 text-xs font-medium">Belum diplot</span>
                      )}
                    </td>
                    <td>
                      {r.tkaScore ? (
                        <span className="font-semibold text-blue-700">{Number(r.tkaScore.score).toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {r.preference?.choices?.map((c: any) => (
                          <span key={c.id} className="rounded bg-gray-100 px-1.5 py-0.5 font-medium">
                            P{c.priority}: {c.package.class.name}
                          </span>
                        ))}
                        {(!r.preference?.choices || r.preference.choices.length === 0) && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-gray-600">{r.user?.username ?? '-'}</span>
                    </td>
                    <td>
                      <div className="flex items-center justify-center gap-1.5">
                        <Button variant="ghost" className="h-7 text-xs px-2" onClick={() => showDetail(r.id)}>Detail</Button>
                        <Button variant="secondary" className="h-7 text-xs px-2" onClick={() => startEdit(r)}>Edit</Button>
                        <Button variant="danger" className="h-7 text-xs px-2" onClick={() => delStudent(r.id, r.name)}>Hapus</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-500">
                    Tidak ada data siswa ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Component */}
        <Pagination
          totalItems={filteredAndSortedRows.length}
          currentPage={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          label="siswa"
        />
      </Card>

      <div className="mt-8">
        <div className="mb-4">
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <span>📥</span>
            <span>Import Data Siswa & Akun Pengguna</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Unggah file spreadsheet (.xlsx, .xls, atau .csv) untuk memasukkan data siswa baru dan akun pengguna secara massal ke dalam database.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <FileImportDropzone
            title="Import Data Siswa (Excel/CSV)"
            description="Membaca NIS, nama lengkap, NISN, jenis kelamin, kelas asal, dan membuat akun siswa otomatis."
            templateUrl="/students/template/download"
            templateFileName="template-import-siswa.xlsx"
            uploadEndpoint="/students/import"
            themeColor="blue"
            icon="🎓"
            buttonLabel="Mulai Import Data Siswa ke Database"
            onSuccess={() => {
              load();
              loadAuxData();
            }}
          />

          {role === 'SUPER_ADMIN' && (
            <FileImportDropzone
              title="Import Data Guru / Staff (Excel/CSV)"
              description="Membaca data identitas guru BK / staff dan membuat akun admin secara otomatis jika dipilih."
              templateUrl="/teachers/template"
              templateFileName="template-import-guru.xlsx"
              uploadEndpoint="/teachers/import"
              themeColor="indigo"
              icon="👨‍🏫"
              buttonLabel="Mulai Import Data Guru ke Database"
              onSuccess={() => {
                load();
              }}
            />
          )}
        </div>
      </div>

      {/* Modal Detail */}
      <Modal open={!!detail} title={`Detail Siswa · ${detail?.name ?? ''}`} onClose={() => setDetail(null)}>
        <div className="mb-4 grid grid-cols-4 gap-3">
          <div className="rounded-xl bg-[#f8fafc] p-3 text-xs">
            <span className="text-[#667085]">Kelas X</span>
            <div className="mt-1 font-bold text-sm">{detail?.originClass?.name ?? '-'}</div>
          </div>
          <div className="rounded-xl bg-[#f8fafc] p-3 text-xs">
            <span className="text-[#667085]">Placement XI</span>
            <div className="mt-1 font-bold text-sm">{detail?.placedClass?.name ?? 'Belum diploting'}</div>
          </div>
          <div className="rounded-xl bg-[#edf3ff] p-3 text-xs">
            <span className="text-blue-600">Nilai TKA</span>
            <div className="mt-1 font-bold text-sm text-blue-900">{detail?.tkaScore ? Number(detail.tkaScore.score).toFixed(2) : '-'}</div>
          </div>
          <div className="rounded-xl bg-[#f8fafc] p-3 text-xs">
            <span className="text-[#667085]">Status Pilihan</span>
            <div className="mt-1 font-bold text-sm">{detail?.preference?.isLocked ? 'Terkunci' : 'Terbuka'}</div>
          </div>
        </div>

        <div className="mb-3">
          <h4 className="text-xs font-bold text-gray-700 mb-1">Pilihan Paket Kelas XI:</h4>
          <div className="flex flex-wrap gap-2 text-xs">
            {detail?.preference?.choices?.map((c: any) => (
              <span key={c.id} className="rounded-lg border bg-gray-50 px-2.5 py-1 font-semibold">
                Pilihan {c.priority}: {c.package.class.name} ({c.package.title})
              </span>
            ))}
            {(!detail?.preference?.choices || detail.preference.choices.length === 0) && (
              <span className="text-gray-400 text-xs">Belum ada pilihan paket</span>
            )}
          </div>
        </div>

        <div className="table-wrap max-h-72 overflow-y-auto">
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Mata Pelajaran</th>
                <th>Semester 1</th>
                <th>Semester 2</th>
              </tr>
            </thead>
            <tbody>
              {detail?.reportTable?.map((r: any, i: number) => (
                <tr key={r.subjectId}>
                  <td>{i + 1}</td>
                  <td className="font-semibold">{r.subject}</td>
                  <td>{r.semester1 !== null ? Number(r.semester1).toFixed(2) : '-'}</td>
                  <td>{r.semester2 !== null ? Number(r.semester2).toFixed(2) : '-'}</td>
                </tr>
              ))}
              {(!detail?.reportTable || detail.reportTable.length === 0) && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-500">Belum ada data nilai rapor.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Modal Edit Siswa Lengkap */}
      <Modal
        open={editOpen}
        title={`Edit Data Siswa · ${editForm.name}`}
        onClose={() => setEditOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              type="button"
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('profile')}
            >
              1. Identitas & Kelas
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
                activeTab === 'choices'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('choices')}
            >
              2. Pilihan Paket Kelas XI
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition ${
                activeTab === 'scores'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('scores')}
            >
              3. Nilai Rapor & TKA
            </button>
          </div>

          {/* TAB 1: PROFILE & CLASS */}
          {activeTab === 'profile' && (
            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              <div>
                <Label>Nama Lengkap Siswa</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label>NIS (Nomor Induk Siswa)</Label>
                <Input
                  value={editForm.nis}
                  onChange={(e) => setEditForm({ ...editForm, nis: e.target.value })}
                />
              </div>
              <div>
                <Label>NISN</Label>
                <Input
                  value={editForm.nisn}
                  onChange={(e) => setEditForm({ ...editForm, nisn: e.target.value })}
                />
              </div>
              <div>
                <Label>Jenis Kelamin</Label>
                <Select
                  value={editForm.gender}
                  onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                >
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </Select>
              </div>
              <div>
                <Label>Kelas Asal (Kelas X)</Label>
                <Select
                  value={editForm.originClassId}
                  onChange={(e) => setEditForm({ ...editForm, originClassId: e.target.value })}
                >
                  <option value="">-- Pilih Kelas Asal --</option>
                  {classes
                    .filter((c) => c.gradeLevel === 'X' || !c.isPackageClass)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </div>
              <div>
                <Label>Kelas Penempatan (Kelas XI)</Label>
                <Select
                  value={editForm.placedClassId}
                  onChange={(e) => setEditForm({ ...editForm, placedClassId: e.target.value })}
                >
                  <option value="">-- Belum Diploting / Kosong --</option>
                  {classes
                    .filter((c) => c.gradeLevel === 'XI' || c.isPackageClass)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
          )}

          {/* TAB 2: CHOICES */}
          {activeTab === 'choices' && (
            <div className="space-y-4 pt-2">
              <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-900">
                Pilih paket kelas XI secara berurutan sesuai preferensi siswa (Pilihan 1 adalah prioritas tertinggi).
              </div>
              <div className="grid gap-3">
                <div>
                  <Label>Pilihan 1 (Prioritas Utama)</Label>
                  <Select
                    value={editForm.choice1}
                    onChange={(e) => setEditForm({ ...editForm, choice1: e.target.value })}
                  >
                    <option value="">-- Tidak memilih --</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.class.name} — {p.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Pilihan 2 (Prioritas Kedua)</Label>
                  <Select
                    value={editForm.choice2}
                    onChange={(e) => setEditForm({ ...editForm, choice2: e.target.value })}
                  >
                    <option value="">-- Tidak memilih --</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.class.name} — {p.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Pilihan 3 (Prioritas Ketiga)</Label>
                  <Select
                    value={editForm.choice3}
                    onChange={(e) => setEditForm({ ...editForm, choice3: e.target.value })}
                  >
                    <option value="">-- Tidak memilih --</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.class.name} — {p.title}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="pt-2">
                  <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.isLocked}
                      onChange={(e) => setEditForm({ ...editForm, isLocked: e.target.checked })}
                    />
                    <span>Kunci Pilihan Siswa (Siswa tidak dapat mengubah pilihannya sendiri)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SCORES */}
          {activeTab === 'scores' && (
            <div className="space-y-4 pt-2">
              <div className="max-w-xs">
                <Label>Nilai TKA (Tes Kemampuan Akademik)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0 - 100"
                  value={editForm.tkaScore}
                  onChange={(e) => setEditForm({ ...editForm, tkaScore: e.target.value })}
                />
              </div>

              <div>
                <Label>Nilai Rapor per Mata Pelajaran (Semester 1 & 2)</Label>
                <div className="table-wrap max-h-64 overflow-y-auto border rounded-xl">
                  <table>
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr>
                        <th>Mata Pelajaran</th>
                        <th className="w-32">Semester 1</th>
                        <th className="w-32">Semester 2</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editForm.reportScores.map((row, idx) => (
                        <tr key={row.subjectId}>
                          <td className="font-semibold text-xs">{row.subjectName}</td>
                          <td>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0-100"
                              value={row.semester1}
                              onChange={(e) => {
                                const newScores = [...editForm.reportScores];
                                newScores[idx].semester1 = e.target.value;
                                setEditForm({ ...editForm, reportScores: newScores });
                              }}
                            />
                          </td>
                          <td>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="0-100"
                              value={row.semester2}
                              onChange={(e) => {
                                const newScores = [...editForm.reportScores];
                                newScores[idx].semester2 = e.target.value;
                                setEditForm({ ...editForm, reportScores: newScores });
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Tambah Siswa Manual */}
      <Modal
        open={createOpen}
        title="Tambah Siswa Manual"
        onClose={() => setCreateOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Batal</Button>
            <Button onClick={saveCreate} disabled={createSaving}>
              {createSaving ? 'Menyimpan...' : 'Simpan Siswa'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nama Lengkap Siswa *</Label>
              <Input
                placeholder="Contoh: Budi Pratama"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>NIS (Nomor Induk Siswa) *</Label>
              <Input
                placeholder="Contoh: 10123"
                value={createForm.nis}
                onChange={(e) => setCreateForm({ ...createForm, nis: e.target.value })}
              />
            </div>
            <div>
              <Label>NISN (Opsional)</Label>
              <Input
                placeholder="Contoh: 0081234567"
                value={createForm.nisn}
                onChange={(e) => setCreateForm({ ...createForm, nisn: e.target.value })}
              />
            </div>
            <div>
              <Label>Jenis Kelamin</Label>
              <Select
                value={createForm.gender}
                onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Kelas Asal (Kelas X)</Label>
              <Select
                value={createForm.originClassId}
                onChange={(e) => setCreateForm({ ...createForm, originClassId: e.target.value })}
              >
                <option value="">-- Pilih Kelas Asal (Opsional) --</option>
                {classes
                  .filter((c) => c.gradeLevel === 'X' || !c.isPackageClass)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 space-y-3 text-xs">
            <b className="text-blue-950">Informasi Akun Login Siswa</b>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Username Login (Opsional)</Label>
                <Input
                  placeholder="Default: sama dengan NIS"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                />
              </div>
              <div>
                <Label>Password Akun (Opsional)</Label>
                <Input
                  type="password"
                  placeholder="Default: Siswa123!"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                />
              </div>
            </div>
            <p className="text-blue-800/80">
              Akun siswa akan otomatis dibuat dan diaktifkan. Siswa dapat login menggunakan NIS / Username dan password yang ditentukan (atau password default <code>Siswa123!</code>).
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
