'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getUser } from '@/lib/api';
import { Button, Card, Input, Label, Modal, PageHeader, Pagination, Select } from '@/components/ui';

const defaultPolicy = {
  minAcademicFit: 70,
  minTka: 60,
  minFinalScore: 70,
  maxChoices: 3,
  usePassingGrade: true,
  requireCompleteSelectionSubjects: true,
};

export default function SettingsPage() {
  const router = useRouter();
  const [years, setYears] = useState<any[]>([]);
  const [yearId, setYearId] = useState('');
  const [year, setYear] = useState<any>();
  const [users, setUsers] = useState<any[]>([]);
  const [prefStats, setPrefStats] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [order, setOrder] = useState('asc');
  const [classFilter, setClassFilter] = useState('ALL');
  const [lockFilter, setLockFilter] = useState('ALL');
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(25);
  const [userOpen, setUserOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [yearOpen, setYearOpen] = useState(false);
  const [editYearOpen, setEditYearOpen] = useState(false);
  const [editYearName, setEditYearName] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>();
  const [password, setPassword] = useState('Password123!');
  const [newYear, setNewYear] = useState({ name: '', copyFromId: '' });
  const [adminForm, setAdminForm] = useState({ username: '', name: '', password: 'AdminOps123!' });
  const [policy, setPolicy] = useState<any>(defaultPolicy);
  const [message, setMessage] = useState('');
  const [savingPolicy, setSavingPolicy] = useState(false);

  // ── Toast notification state ──────────────────────────────────────
  const [toast, setToast] = useState<{ type: 'success' | 'info' | 'error'; title: string; body?: string } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(type: 'success' | 'info' | 'error', title: string, body?: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ type, title, body });
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }

  async function loadYears() {
    try {
      const y: any[] = await api('/academic-years');
      setYears(y);
      if (!yearId && y[0]) {
        setYearId(String(y.find((x) => x.isActive)?.id ?? y[0].id));
      }
    } catch (e: any) {
      setMessage(`Gagal memuat tahun ajaran: ${e.message}`);
    }
  }

  async function loadUsers() {
    try {
      const queryYear = yearId ? `&academicYearId=${yearId}` : '';
      const data: any[] = await api(`/users?search=${encodeURIComponent(search)}&sortBy=${sort}&sortOrder=${order}${queryYear}`);
      setUsers(data);
    } catch (e: any) {
      setMessage(`Gagal memuat data user: ${e.message}`);
    }
  }

  async function loadPrefStats() {
    if (!yearId) return;
    try {
      const stats = await api<any>(`/students/preferences/stats?academicYearId=${yearId}`);
      setPrefStats(stats);
    } catch (e) {
      // non-fatal
    }
  }

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'SUPER_ADMIN') {
      router.replace('/admin/dashboard');
      return;
    }
    loadYears();
  }, [router]);

  useEffect(() => {
    if (yearId) {
      api(`/settings/years/${yearId}`).then((d: any) => {
        setYear(d);
        setEditYearName(d?.name ?? '');
        if (d?.policy) setPolicy({ ...defaultPolicy, ...d.policy });
      });
      loadPrefStats();
      loadUsers();
    }
  }, [yearId]);

  useEffect(() => {
    loadUsers();
  }, [sort, order]);

  // Distinct origin classes for filter
  const distinctClasses = useMemo(() => {
    const set = new Set<string>();
    users.forEach((u) => {
      if (u.student?.originClass?.name) set.add(u.student.originClass.name);
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (classFilter !== 'ALL' && u.student?.originClass?.name !== classFilter) return false;
      if (lockFilter === 'LOCKED') {
        return u.role === 'STUDENT' && u.student?.preference?.isLocked;
      }
      if (lockFilter === 'UNLOCKED') {
        return (
          u.role === 'STUDENT' &&
          !u.student?.preference?.isLocked &&
          (u.student?.preference?.choices?.length ?? 0) > 0
        );
      }
      if (lockFilter === 'UNSELECTED') {
        return (
          u.role === 'STUDENT' &&
          (!u.student?.preference?.choices || u.student?.preference?.choices?.length === 0)
        );
      }
      return true;
    });
  }, [users, classFilter, lockFilter]);

  const paginatedUsers = useMemo(() => {
    if (userPageSize >= 999999) return filteredUsers;
    const start = (userPage - 1) * userPageSize;
    return filteredUsers.slice(start, start + userPageSize);
  }, [filteredUsers, userPage, userPageSize]);

  function handleSort(column: string) {
    if (sort === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(column);
      setOrder('asc');
    }
    setUserPage(1);
  }

  function getSortIndicator(column: string) {
    if (sort !== column) return <span className="text-gray-300 ml-1">⇅</span>;
    return <span className="text-blue-700 font-black ml-1">{order === 'asc' ? '▲' : '▼'}</span>;
  }

  async function savePolicy() {
    try {
      setSavingPolicy(true);
      await api(`/settings/years/${yearId}/policy`, {
        method: 'PATCH',
        body: JSON.stringify(policy),
      });
      setMessage('Kebijakan tahun ajaran berhasil disimpan.');
    } catch (e: any) {
      setMessage(`Gagal menyimpan kebijakan: ${e.message}`);
    } finally {
      setSavingPolicy(false);
    }
  }

  async function activate() {
    try {
      await api(`/academic-years/${yearId}/activate`, { method: 'POST' });
      showToast('success', 'Tahun Ajaran Diaktifkan', `"${year?.name}" kini menjadi tahun ajaran aktif.`);
      setMessage(`${year?.name} menjadi tahun ajaran aktif.`);
      loadYears();
    } catch (e: any) {
      showToast('error', 'Gagal Mengaktifkan', e.message);
    }
  }

  async function createYear() {
    if (!newYear.name.trim()) {
      alert('Nama tahun ajaran wajib diisi');
      return;
    }
    try {
      await api('/academic-years', {
        method: 'POST',
        body: JSON.stringify({
          name: newYear.name.trim(),
          copyFromId: newYear.copyFromId ? Number(newYear.copyFromId) : undefined,
        }),
      });
      setYearOpen(false);
      setNewYear({ name: '', copyFromId: '' });
      setMessage('Tahun ajaran berhasil ditambahkan.');
      showToast('success', 'Tahun Ajaran Ditambahkan! 🎉', `"${newYear.name.trim()}" berhasil dibuat${newYear.copyFromId ? ' dengan data yang disalin' : ''}.`);
      loadYears();
    } catch (e: any) {
      showToast('error', 'Gagal Menambah Tahun', e.message);
      alert(`Gagal menambah tahun: ${e.message}`);
    }
  }

  async function saveEditYear() {
    if (!editYearName.trim()) {
      alert('Nama tahun ajaran wajib diisi');
      return;
    }
    try {
      await api(`/academic-years/${yearId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editYearName.trim() }),
      });
      setEditYearOpen(false);
      setMessage(`Nama tahun ajaran berhasil diperbarui menjadi "${editYearName.trim()}".`);
      showToast('success', 'Nama Tahun Diperbarui ✏️', `Nama berhasil diubah menjadi "${editYearName.trim()}".`);
      loadYears();
    } catch (e: any) {
      showToast('error', 'Gagal Mengubah Nama', e.message);
      alert(`Gagal mengedit nama tahun: ${e.message}`);
    }
  }

  async function deleteYear() {
    if (!year) return;
    if (year.isActive) {
      alert('Tahun ajaran sedang aktif dan tidak dapat dihapus. Silakan aktifkan tahun ajaran lain terlebih dahulu.');
      return;
    }
    if (
      !confirm(
        `PERINGATAN: Apakah Anda yakin ingin MENGHAPUS tahun ajaran "${year.name}" beserta seluruh data kelas, siswa, nilai rapor, skor RIASEC, dan konfigurasinya? Tindakan ini tidak dapat dibatalkan.`,
      )
    ) {
      return;
    }

    try {
      const res: any = await api(`/academic-years/${yearId}`, { method: 'DELETE' });
      setMessage(res.message || 'Tahun ajaran berhasil dihapus.');
      setYearId('');
      await loadYears();
    } catch (e: any) {
      alert(`Gagal menghapus tahun: ${e.message}`);
    }
  }

  async function unlockAllPreferences() {
    if (
      !confirm(
        'Apakah Anda yakin ingin MEMBUKA KUNCI konfirmasi pilihan bagi SELURUH siswa pada tahun ajaran ini? Siswa akan dapat mengubah dan mengonfirmasi kembali pilihannya di portal siswa.',
      )
    ) {
      return;
    }
    try {
      const res: any = await api(`/students/preferences/unlock-all?academicYearId=${yearId}`, { method: 'POST' });
      setMessage(res.message);
      loadPrefStats();
      loadUsers();
    } catch (e: any) {
      alert(`Gagal membuka kunci pilihan: ${e.message}`);
    }
  }

  async function lockAllPreferences() {
    if (!confirm('Kunci pilihan seluruh siswa yang sudah menginput paket kelas?')) return;
    try {
      const res: any = await api(`/students/preferences/lock-all?academicYearId=${yearId}`, { method: 'POST' });
      setMessage(res.message);
      loadPrefStats();
      loadUsers();
    } catch (e: any) {
      alert(`Gagal mengunci pilihan: ${e.message}`);
    }
  }

  async function unlockStudentPreference(studentId: number, studentName: string) {
    if (!confirm(`Buka kunci konfirmasi pilihan untuk siswa "${studentName}"? Siswa dapat mengubah pilihannya kembali di portal siswa.`)) {
      return;
    }
    try {
      const res: any = await api(`/students/${studentId}/unlock-preference`, { method: 'PATCH' });
      setMessage(res.message);
      loadPrefStats();
      loadUsers();
    } catch (e: any) {
      alert(`Gagal: ${e.message}`);
    }
  }

  async function lockStudentPreference(studentId: number, studentName: string) {
    if (!confirm(`Kunci pilihan untuk siswa "${studentName}"? Pilihan siswa akan terkunci dan tidak dapat diubah di portal sampai dibuka kembali.`)) {
      return;
    }
    try {
      const res: any = await api(`/students/${studentId}/lock-preference`, { method: 'PATCH' });
      setMessage(res.message);
      loadPrefStats();
      loadUsers();
    } catch (e: any) {
      alert(`Gagal: ${e.message}`);
    }
  }

  async function createAdmin() {
    try {
      await api('/users/admin', {
        method: 'POST',
        body: JSON.stringify(adminForm),
      });
      setAdminOpen(false);
      setAdminForm({ username: '', name: '', password: 'AdminOps123!' });
      setMessage('Admin operasional berhasil dibuat.');
      loadUsers();
    } catch (e: any) {
      alert(`Gagal membuat admin: ${e.message}`);
    }
  }

  async function resetPassword() {
    try {
      await api(`/users/${selectedUser.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password, mustChangePassword: true }),
      });
      setUserOpen(false);
      setMessage(`Password ${selectedUser.username} berhasil direset dan dienkripsi.`);
      loadUsers();
    } catch (e: any) {
      alert(`Gagal reset password: ${e.message}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Kebijakan & Sistem"
        description="Khusus SUPER_ADMIN. Pengaturan tahun ajaran, kebijakan seleksi, pembukaan kunci pilihan siswa, dan akun sistem."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setAdminOpen(true)}>
              + Tambah Admin Operasional
            </Button>
            <Button variant="secondary" onClick={() => setYearOpen(true)}>
              + Tambah / Clone Tahun
            </Button>
            <Button onClick={savePolicy} disabled={savingPolicy}>
              {savingPolicy ? 'Menyimpan...' : 'Simpan Kebijakan'}
            </Button>
          </div>
        }
      />

      {message && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 p-3 text-sm text-blue-800 shadow-xs">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-xs text-blue-600 hover:text-blue-900">✕ Tutup</button>
        </div>
      )}

      {/* SECTION 1: TAHUN AJARAN & KEBIJAKAN */}
      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-black text-base text-gray-900">Tahun Ajaran yang Dilihat</h2>
                <p className="mt-0.5 text-xs text-[#667085]">
                  Pilih tahun ajaran untuk melihat konfigurasi atau aktifkan tahun ajaran berjalan.
                </p>
              </div>
              {year && (
                <span className={`badge ${year.isActive ? 'bg-green-100 text-green-800 font-bold' : 'bg-gray-100 text-gray-700'}`}>
                  {year.isActive ? '✓ AKTIF' : 'Arsip'}
                </span>
              )}
            </div>

            <Select className="mt-3" value={yearId} onChange={(e) => setYearId(e.target.value)}>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} {y.isActive ? '· [SEDANG AKTIF]' : ''}
                </option>
              ))}
            </Select>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {[
                ['Siswa', year?._count?.students],
                ['Kelas', year?._count?.classes],
                ['Paket', year?._count?.packages],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-[#f8faff] p-2.5 border border-blue-50">
                  <div className="text-xs text-[#667085]">{l}</div>
                  <div className="text-lg font-black text-gray-900">{v ?? 0}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t space-y-2">
            <Button className="w-full" disabled={year?.isActive} onClick={activate}>
              {year?.isActive ? '✓ Tahun Ajaran Ini Sedang Aktif' : 'Jadikan Tahun Ajaran Aktif'}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1 text-xs h-8"
                onClick={() => {
                  setEditYearName(year?.name ?? '');
                  setEditYearOpen(true);
                }}
              >
                ✏️ Edit Nama Tahun
              </Button>
              <Button
                variant="danger"
                className="text-xs h-8 px-3"
                disabled={year?.isActive}
                title={year?.isActive ? 'Tahun ajaran aktif tidak dapat dihapus' : 'Hapus tahun ajaran'}
                onClick={deleteYear}
              >
                🗑️ Hapus Tahun
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-black text-base text-gray-900">Passing Grade & Aturan Pemilihan Paket</h2>
          <p className="mt-1 text-xs text-[#667085]">
            Nilai ini dipakai backend ketika Jalankan Scoring dan Placement untuk menentukan ELIGIBLE serta batas pemilihan paket oleh siswa.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <Label>Minimum Academic Fit</Label>
              <Input
                type="number"
                value={policy.minAcademicFit ?? 70}
                onChange={(e) => setPolicy({ ...policy, minAcademicFit: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-gray-500">Batas minimum nilai kecocokan akademik.</p>
            </div>
            <div>
              <Label>Minimum TKA tunggal</Label>
              <Input
                type="number"
                value={policy.minTka ?? 60}
                onChange={(e) => setPolicy({ ...policy, minTka: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-gray-500">Batas minimum skor TKA siswa.</p>
            </div>
            <div>
              <Label>Minimum Final Score</Label>
              <Input
                type="number"
                value={policy.minFinalScore ?? 70}
                onChange={(e) => setPolicy({ ...policy, minFinalScore: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-gray-500">Batas minimum skor komposit seleksi.</p>
            </div>
            <div>
              <Label>Maksimum pilihan paket kelas</Label>
              <Input
                type="number"
                min="1"
                max="5"
                value={policy.maxChoices ?? 3}
                onChange={(e) => setPolicy({ ...policy, maxChoices: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-gray-500">Berapa banyak paket kelas yang boleh dipilih siswa.</p>
            </div>
            <div className="md:col-span-2 pt-2 border-t space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.usePassingGrade !== false}
                  onChange={(e) => setPolicy({ ...policy, usePassingGrade: e.target.checked })}
                />
                <span className="font-semibold text-gray-800">Gunakan Passing Grade dalam Seleksi</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={policy.requireCompleteSelectionSubjects !== false}
                  onChange={(e) => setPolicy({ ...policy, requireCompleteSelectionSubjects: e.target.checked })}
                />
                <span className="font-semibold text-gray-800">Mapel seleksi paket wajib lengkap (tidak boleh ada mapel kosong)</span>
              </label>
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION 2: MANAJEMEN KUNCI KONFIRMASI PILIHAN SISWA */}
      <Card className="mt-6 border-indigo-100 bg-gradient-to-r from-blue-50/40 via-indigo-50/30 to-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#10285f] text-xs font-bold text-white">
                🔐
              </span>
              <h3 className="font-black text-base text-gray-900">
                Manajemen Kunci & Pembukaan Pilihan Siswa
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-gray-600">
              Kunci atau buka akses pengeditan pilihan paket kelas bagi siswa di portal siswa. Berlaku untuk tahun ajaran aktif/terpilih (<b>{year?.name ?? '-'}</b>).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              className="text-xs h-8 bg-white border-amber-200 text-amber-900 hover:bg-amber-50"
              onClick={lockAllPreferences}
            >
              🔒 Kunci Semua Siswa
            </Button>
            <Button
              className="text-xs h-8 bg-indigo-700 hover:bg-indigo-800 text-white"
              onClick={unlockAllPreferences}
            >
              🔓 Buka Kunci Semua Siswa
            </Button>
          </div>
        </div>

        {/* Ringkasan Status Kunci Pilihan Siswa */}
        <div className="mt-3 grid gap-3 sm:grid-cols-4 text-center">
          <div className="rounded-xl border bg-white p-3 shadow-2xs">
            <div className="text-xs text-gray-500 font-semibold">Total Siswa Terdaftar</div>
            <div className="mt-1 text-xl font-black text-gray-900">{prefStats?.totalStudents ?? 0}</div>
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-2xs border-green-100">
            <div className="text-xs text-green-700 font-semibold">🔒 Terkunci & Dikonfirmasi</div>
            <div className="mt-1 text-xl font-black text-green-700">{prefStats?.lockedCount ?? 0}</div>
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-2xs border-blue-100">
            <div className="text-xs text-blue-700 font-semibold">✏️ Terbuka / Draf Pilihan</div>
            <div className="mt-1 text-xl font-black text-blue-700">{prefStats?.unlockedCount ?? 0}</div>
          </div>
          <div className="rounded-xl border bg-white p-3 shadow-2xs border-amber-100">
            <div className="text-xs text-amber-700 font-semibold">⚠️ Belum Memilih Paket</div>
            <div className="mt-1 text-xl font-black text-amber-700">{prefStats?.unselectedCount ?? 0}</div>
          </div>
        </div>
      </Card>

      {/* SECTION 3: MANAJEMEN AKUN & USER SYSTEM */}
      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-end gap-3 border-b pb-4">
          <div className="min-w-[200px] flex-1">
            <Label>Cari User & Password</Label>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setUserPage(1);
              }}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              placeholder="Cari nama atau username..."
            />
          </div>
          <div className="min-w-[150px]">
            <Label>Filter Kelas Siswa</Label>
            <Select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setUserPage(1);
              }}
            >
              <option value="ALL">Semua Kelas / User</option>
              {distinctClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Kelas {cls}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[170px]">
            <Label>Status Kunci Pilihan</Label>
            <Select
              value={lockFilter}
              onChange={(e) => {
                setLockFilter(e.target.value);
                setUserPage(1);
              }}
            >
              <option value="ALL">Semua Status Kunci</option>
              <option value="LOCKED">🔒 Terkunci Saja</option>
              <option value="UNLOCKED">✏️ Terbuka / Draf Saja</option>
              <option value="UNSELECTED">⚠️ Belum Memilih Saja</option>
            </Select>
          </div>
          <div className="min-w-[130px]">
            <Label>Sortir</Label>
            <Select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setUserPage(1);
              }}
            >
              <option value="name">Nama</option>
              <option value="username">Username</option>
              <option value="originClass">Kelas Asal (Siswa)</option>
              <option value="role">Role</option>
              <option value="isActive">Status</option>
              <option value="createdAt">Tanggal Dibuat</option>
            </Select>
          </div>
          <div className="min-w-[90px]">
            <Label>Urutan</Label>
            <Select
              value={order}
              onChange={(e) => {
                setOrder(e.target.value);
                setUserPage(1);
              }}
            >
              <option value="asc">Naik (A-Z)</option>
              <option value="desc">Turun (Z-A)</option>
            </Select>
          </div>
          <div className="flex">
            <Button onClick={loadUsers} className="px-4">Cari</Button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="w-12 text-center">No</th>
                <th
                  className="cursor-pointer hover:bg-gray-100 transition select-none"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center">
                    <span>Nama</span>
                    {getSortIndicator('name')}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100 transition select-none"
                  onClick={() => handleSort('username')}
                >
                  <div className="flex items-center">
                    <span>Username</span>
                    {getSortIndicator('username')}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100 transition select-none"
                  onClick={() => handleSort('role')}
                >
                  <div className="flex items-center">
                    <span>Role</span>
                    {getSortIndicator('role')}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100 transition select-none"
                  onClick={() => handleSort('originClass')}
                >
                  <div className="flex items-center">
                    <span>Kelas</span>
                    {getSortIndicator('originClass')}
                  </div>
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100 transition select-none"
                  onClick={() => handleSort('isActive')}
                >
                  <div className="flex items-center">
                    <span>Status</span>
                    {getSortIndicator('isActive')}
                  </div>
                </th>
                <th className="text-center">Kunci Pilihan</th>
                <th className="text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.map((u, i) => {
                const rowNo = userPageSize >= 999999 ? i + 1 : (userPage - 1) * userPageSize + i + 1;
                const studentId = u.studentId || u.student?.id;
                const isStudent = u.role === 'STUDENT';
                const pref = u.student?.preference;
                const isLocked = pref?.isLocked;
                const choiceCount = pref?.choices?.length ?? 0;

                return (
                  <tr key={u.id}>
                    <td className="text-center font-medium text-gray-500">{rowNo}</td>
                    <td className="font-bold">{u.name}</td>
                    <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded font-semibold">{u.username}</span></td>
                    <td><span className="badge">{u.role}</span></td>
                    <td>
                      {u.student?.originClass?.name ? (
                        <span className="badge bg-blue-100 text-blue-900 font-semibold">
                          Kelas {u.student.originClass.name}
                        </span>
                      ) : isStudent ? (
                        <span className="text-gray-400 text-xs">Siswa (Belum diset)</span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {u.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-center">
                      {isStudent ? (
                        isLocked ? (
                          <span className="badge bg-green-100 text-green-800 font-bold">🔒 Terkunci</span>
                        ) : choiceCount > 0 ? (
                          <span className="badge bg-blue-100 text-blue-800 font-medium">✏️ Terbuka ({choiceCount} Pilihan)</span>
                        ) : (
                          <span className="badge bg-amber-100 text-amber-800 font-medium">⚠️ Belum Memilih</span>
                        )
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {isStudent && studentId && (
                          isLocked ? (
                            <Button
                              variant="secondary"
                              className="text-xs h-7 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200"
                              title="Buka kunci agar siswa dapat mengubah pilihannya di portal"
                              onClick={() => unlockStudentPreference(studentId, u.name)}
                            >
                              🔓 Buka Kunci
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              className="text-xs h-7 px-2.5 bg-green-50 hover:bg-green-100 text-green-900 border border-green-200"
                              title="Kunci pilihan siswa ini secara manual"
                              onClick={() => lockStudentPreference(studentId, u.name)}
                            >
                              🔒 Kunci Pilihan
                            </Button>
                          )
                        )}
                        <Button
                          variant="ghost"
                          className="text-xs h-7 px-2"
                          onClick={() => {
                            setSelectedUser(u);
                            setPassword('Password123!');
                            setUserOpen(true);
                          }}
                        >
                          Reset PW
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-gray-500">
                    Tidak ada data user yang sesuai dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={filteredUsers.length}
          currentPage={userPage}
          pageSize={userPageSize}
          onPageChange={setUserPage}
          onPageSizeChange={setUserPageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          label="user"
        />
      </Card>

      {/* Modal Edit Nama Tahun Ajaran */}
      <Modal
        open={editYearOpen}
        title={`Edit Nama Tahun Ajaran · ${year?.name ?? ''}`}
        onClose={() => setEditYearOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditYearOpen(false)}>Batal</Button>
            <Button onClick={saveEditYear}>Simpan Perubahan</Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Label>Nama Tahun Ajaran</Label>
          <Input
            placeholder="Contoh: 2026/2027 Ganjil"
            value={editYearName}
            onChange={(e) => setEditYearName(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            Perubahan nama tahun ajaran akan langsung terupdate di seluruh modul sistem.
          </p>
        </div>
      </Modal>

      {/* Modal Tambah Admin */}
      <Modal
        open={adminOpen}
        title="Tambah Admin Operasional"
        onClose={() => setAdminOpen(false)}
        footer={<Button onClick={createAdmin}>Buat User Admin</Button>}
      >
        <div className="space-y-3">
          <div>
            <Label>Nama</Label>
            <Input
              placeholder="Contoh: Guru BK / Admin 1"
              value={adminForm.name}
              onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Username unik</Label>
            <Input
              placeholder="Contoh: guru.bk"
              value={adminForm.username}
              onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
            />
          </div>
          <div>
            <Label>Password Awal</Label>
            <Input
              type="password"
              value={adminForm.password}
              onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
            />
          </div>
          <div className="rounded-xl bg-[#fff8e8] p-3 text-xs text-amber-900">
            Role ADMIN dapat mengelola operasional dan otomatis memakai tahun ajaran aktif, tetapi tidak memiliki akses ke halaman Kebijakan & Sistem ini.
          </div>
        </div>
      </Modal>

      {/* Modal Tambah Tahun Ajaran */}
      <Modal
        open={yearOpen}
        title="Tambah / Clone Tahun Ajaran"
        onClose={() => setYearOpen(false)}
        footer={<Button onClick={createYear}>Simpan Tahun</Button>}
      >
        <div className="space-y-3">
          <div>
            <Label>Nama Tahun Baru</Label>
            <Input
              placeholder="Contoh: 2027/2028"
              value={newYear.name}
              onChange={(e) => setNewYear({ ...newYear, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Salin konfigurasi dari (opsional)</Label>
            <Select
              value={newYear.copyFromId}
              onChange={(e) => setNewYear({ ...newYear, copyFromId: e.target.value })}
            >
              <option value="">Mulai kosong (tanpa salin)</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      {/* Modal Reset Password */}
      <Modal
        open={userOpen}
        title={`Reset Password · ${selectedUser?.username ?? ''}`}
        onClose={() => setUserOpen(false)}
        footer={<Button onClick={resetPassword}>Simpan Password</Button>}
      >
        <div className="space-y-3">
          <Label>Password Baru</Label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-[#667085]">
            Password akan di-hash bcrypt oleh backend. User diwajibkan mengganti password saat login berikutnya.
          </p>
        </div>
      </Modal>
      {/* ── Toast Popup Notification ── */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-[9999] flex min-w-[280px] max-w-xs items-start gap-3 rounded-2xl border shadow-xl px-4 py-3.5 animate-slideInRight"
          style={{
            background: toast.type === 'success' ? '#f0fdf4' : toast.type === 'error' ? '#fef2f2' : '#eff6ff',
            borderColor: toast.type === 'success' ? '#bbf7d0' : toast.type === 'error' ? '#fecaca' : '#bfdbfe',
          }}
        >
          <span className="mt-0.5 text-xl shrink-0">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: toast.type === 'success' ? '#15803d' : toast.type === 'error' ? '#b91c1c' : '#1d4ed8' }}>
              {toast.title}
            </p>
            {toast.body && (
              <p className="text-xs mt-0.5" style={{ color: toast.type === 'success' ? '#166534' : toast.type === 'error' ? '#991b1b' : '#1e40af' }}>
                {toast.body}
              </p>
            )}
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-gray-400 hover:text-gray-700 text-xs shrink-0 mt-0.5"
          >
            ✕
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(80px) scale(0.95); }
          to   { opacity: 1; transform: translateX(0)    scale(1); }
        }
        .animate-slideInRight { animation: slideInRight 0.28s cubic-bezier(.22,1,.36,1) both; }
      `}</style>
    </>
  );
}

