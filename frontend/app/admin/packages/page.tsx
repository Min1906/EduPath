'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Card, Input, Label, Modal, PageHeader, Select, Textarea } from '@/components/ui';

export default function PackagesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>();
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // Package Form
  const [form, setForm] = useState<any>({
    className: '',
    title: '',
    description: '',
    capacity: 36,
    category: 'Mayoritas IPA',
    subjects: [],
  });

  // Template Edit & Create State
  const [templateEditOpen, setTemplateEditOpen] = useState(false);
  const [editingTemplateKey, setEditingTemplateKey] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState<{
    title: string;
    category: string;
    subjects: string[];
  }>({
    title: '',
    category: 'Mayoritas IPA',
    subjects: [],
  });
  const [templateSaving, setTemplateSaving] = useState(false);

  // Template Use Modal State (to specify class name cleanly instead of raw prompt)
  const [useTemplateOpen, setUseTemplateOpen] = useState(false);
  const [selectedTemplateForUse, setSelectedTemplateForUse] = useState<any>(null);
  const [newClassName, setNewClassName] = useState('');

  // Feature: Hide/Show Subjects & Weights List on Active Packages (Default Hidden)
  const [hideSubjects, setHideSubjects] = useState(true);

  async function load() {
    try {
      const [p, s, t] = await Promise.all([
        api<any[]>('/packages'),
        api<any[]>('/subjects'),
        api<any[]>('/packages/templates'),
      ]);
      const sortedPackages = (p || []).slice().sort((a: any, b: any) => {
        const nameA = a.class?.name || '';
        const nameB = b.class?.name || '';
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });
      setRows(sortedPackages);
      setSubjects(s);
      setTemplates(t);
    } catch (e: any) {
      setMsg(`Gagal memuat data: ${e.message}`);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function start(r?: any) {
    setEdit(r);
    setForm(
      r
        ? {
            className: r.class.name,
            title: r.title,
            description: r.description ?? '',
            capacity: r.capacity,
            category: r.class.category,
            subjects: r.subjects.map((x: any) => ({
              subjectId: x.subjectId,
              isSelection: x.isSelection,
              selectionWeight: Number(x.selectionWeight),
            })),
          }
        : {
            className: '',
            title: '',
            description: '',
            capacity: 36,
            category: 'Mayoritas IPA',
            subjects: [],
          },
    );
    setOpen(true);
  }

  const total = useMemo(
    () =>
      form.subjects
        .filter((x: any) => x.isSelection)
        .reduce((a: number, b: any) => a + Number(b.selectionWeight || 0), 0),
    [form],
  );

  function toggleSubject(id: number, on: boolean) {
    setForm((f: any) => ({
      ...f,
      subjects: on
        ? [...f.subjects, { subjectId: id, isSelection: true, selectionWeight: 0 }]
        : f.subjects.filter((x: any) => x.subjectId !== id),
    }));
  }

  function changeSubject(id: number, key: string, val: any) {
    setForm((f: any) => ({
      ...f,
      subjects: f.subjects.map((x: any) => (x.subjectId === id ? { ...x, [key]: val } : x)),
    }));
  }

  async function save() {
    const selected = form.subjects.filter((x: any) => x.isSelection);
    if (!selected.length) {
      alert('Pilih minimal 1 mata pelajaran sebagai mata pelajaran seleksi');
      return;
    }
    if (Math.abs(total - 100) > 0.01) {
      alert(`Total bobot mapel seleksi harus 100% (saat ini ${total}%)`);
      return;
    }
    try {
      setSaving(true);
      await api(edit ? `/packages/${edit.id}` : '/packages', {
        method: edit ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      setOpen(false);
      setMsg(edit ? 'Paket kelas berhasil diperbarui.' : 'Paket kelas baru berhasil dibuat.');
      load();
    } catch (e: any) {
      alert(`Gagal menyimpan: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function del(id: number) {
    if (!confirm('Apakah Anda yakin ingin menghapus paket kelas ini?')) return;
    try {
      const r: any = await api(`/packages/${id}`, { method: 'DELETE' });
      setMsg(r.message ?? 'Paket berhasil dihapus');
      load();
    } catch (e: any) {
      alert(`Gagal menghapus: ${e.message}`);
    }
  }

  // TEMPLATE MANAGEMENT FUNCTIONS
  function startCreateTemplate() {
    setEditingTemplateKey(null);
    setTemplateForm({
      title: '',
      category: 'Mayoritas IPA',
      subjects: [],
    });
    setTemplateEditOpen(true);
  }

  function startEditTemplate(tpl: any) {
    setEditingTemplateKey(tpl.key);
    setTemplateForm({
      title: tpl.title,
      category: tpl.category || 'Mayoritas IPA',
      subjects: Array.isArray(tpl.subjects) ? [...tpl.subjects] : [],
    });
    setTemplateEditOpen(true);
  }

  function toggleTemplateSubject(subjectName: string, on: boolean) {
    setTemplateForm((prev) => ({
      ...prev,
      subjects: on
        ? [...prev.subjects, subjectName]
        : prev.subjects.filter((s) => s !== subjectName),
    }));
  }

  async function saveTemplate() {
    if (!templateForm.title.trim()) {
      alert('Nama/Judul template wajib diisi');
      return;
    }
    if (!templateForm.subjects.length) {
      alert('Pilih minimal 1 mata pelajaran untuk template');
      return;
    }
    try {
      setTemplateSaving(true);
      if (editingTemplateKey) {
        await api(`/packages/templates/${editingTemplateKey}`, {
          method: 'PUT',
          body: JSON.stringify(templateForm),
        });
        setMsg(`Template "${templateForm.title}" berhasil diperbarui.`);
      } else {
        await api('/packages/templates', {
          method: 'POST',
          body: JSON.stringify(templateForm),
        });
        setMsg(`Template baru "${templateForm.title}" berhasil dibuat.`);
      }
      setTemplateEditOpen(false);
      load();
    } catch (e: any) {
      alert(`Gagal menyimpan template: ${e.message}`);
    } finally {
      setTemplateSaving(false);
    }
  }

  async function deleteTemplate(key: string, title: string) {
    if (!confirm(`Hapus template "${title}"?`)) return;
    try {
      await api(`/packages/templates/${key}`, { method: 'DELETE' });
      setMsg(`Template "${title}" berhasil dihapus.`);
      load();
    } catch (e: any) {
      alert(`Gagal menghapus template: ${e.message}`);
    }
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a: any, b: any) => {
      const nameA = a.class?.name || '';
      const nameB = b.class?.name || '';
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [rows]);

  function startUseTemplate(tpl: any) {
    setSelectedTemplateForUse(tpl);
    // Find highest class number if format is XI-N
    let maxNum = 0;
    rows.forEach((r) => {
      const match = (r.class?.name || '').match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      }
    });
    setNewClassName(`XI-${maxNum ? maxNum + 1 : rows.length + 1}`);
    setUseTemplateOpen(true);
  }

  async function confirmUseTemplate() {
    if (!selectedTemplateForUse || !newClassName.trim()) {
      alert('Nama kelas baru wajib diisi');
      return;
    }
    try {
      await api(`/packages/from-template/${selectedTemplateForUse.key}`, {
        method: 'POST',
        body: JSON.stringify({ className: newClassName.trim() }),
      });
      setUseTemplateOpen(false);
      setMsg(`Paket kelas "${newClassName}" berhasil dibuat dari template "${selectedTemplateForUse.title}".`);
      load();
    } catch (e: any) {
      alert(`Gagal membuat paket dari template: ${e.message}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Paket Kelas XI"
        description="Kelola paket kelas peminatan XI, template paket, dan bobot mapel seleksi untuk penilaian Academic Fit."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => start()}>+ Tambah Paket Manual</Button>
          </div>
        }
      />

      {msg && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-blue-50 p-3.5 text-sm text-blue-800 shadow-xs animate-fadeIn">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-xs text-blue-600 hover:text-blue-900">✕ Tutup</button>
        </div>
      )}

      {/* SECTION: TEMPLATE PAKET KELAS */}
      <div className="mb-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-gray-900">Template Paket Kelas ({templates.length})</h3>
            <p className="text-xs text-gray-500">
              Gunakan atau edit template cepat untuk mendefinisikan kombinasi mata pelajaran pilihan secara seragam.
            </p>
          </div>
          <Button variant="secondary" className="text-xs" onClick={startCreateTemplate}>
            + Tambah Template Baru
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.key} className="flex flex-col justify-between border hover:border-gray-300 transition">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <b className="text-base text-gray-900">{t.title}</b>
                    <div className="mt-0.5">
                      <span className="badge bg-blue-100 text-blue-800 text-[11px] font-semibold">
                        {t.category || 'Mayoritas IPA'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="text-xs text-gray-500 font-semibold">Mata Pelajaran ({t.subjects.length}):</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.subjects.map((sName: string, sIdx: number) => (
                      <span key={sIdx} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 font-medium">
                        {sName}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2">
                <Button
                  className="text-xs px-3 h-8"
                  onClick={() => startUseTemplate(t)}
                >
                  Gunakan Template
                </Button>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    className="text-xs px-2.5 h-8"
                    onClick={() => startEditTemplate(t)}
                  >
                    Edit Template
                  </Button>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(t.key, t.title)}
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 transition"
                    title="Hapus template ini"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </Card>
          ))}

          {templates.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-sm text-gray-500">
              Belum ada template paket kelas. Klik &quot;+ Tambah Template Baru&quot; untuk membuat.
            </div>
          )}
        </div>
      </div>

      {/* SECTION: DAFTAR PAKET KELAS AKTIF */}
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-gray-900">Daftar Paket Kelas XI Aktif ({rows.length})</h3>
            <p className="text-xs text-gray-500">
              Daftar paket rombel kelas XI yang dibuka untuk pemilihan dan penempatan siswa pada tahun ajaran ini.
            </p>
          </div>
          <Button
            variant="secondary"
            className="text-xs h-8 px-3 flex items-center gap-1.5 border border-gray-300"
            onClick={() => setHideSubjects(!hideSubjects)}
          >
            {hideSubjects ? (
              <>
                <span>👁️</span>
                <span>Tampilkan Daftar Mapel</span>
              </>
            ) : (
              <>
                <span>🙈</span>
                <span>Tutup / Sembunyikan Daftar Mapel</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {sortedRows.map((r) => (
            <Card key={r.id} className="hover:border-gray-300 transition">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#10285f] text-xs font-black text-white shadow-2xs">
                      {r.class.name.replace('XI-', '')}
                    </span>
                    <h2 className="text-lg font-black text-gray-900">{r.class.name}</h2>
                  </div>
                  <div className="text-sm font-semibold text-[#2457d6] mt-0.5">{r.title}</div>
                </div>
                <span className="badge bg-gray-100 text-gray-800 font-bold">
                  Kapasitas: {r.capacity} Siswa
                </span>
              </div>

              {r.description && (
                <p className="mt-2 text-xs text-gray-600 line-clamp-2">{r.description}</p>
              )}

              {hideSubjects ? (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f8fafc] p-3 border border-dashed border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔒</span>
                    <div>
                      <span className="text-xs font-bold text-gray-800 block">
                        Daftar Mapel & Bobot Ditutup
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {r.subjects?.length ?? 0} mata pelajaran pilihan & seleksi disembunyikan
                      </span>
                    </div>
                  </div>
                  <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    Ditutup
                  </span>
                </div>
              ) : (
                <div className="mt-3 space-y-1.5 rounded-xl bg-[#f8fafc] p-3 border">
                  <div className="text-xs font-bold text-gray-700 mb-1">
                    Mata Pelajaran & Bobot Seleksi ({r.subjects?.length ?? 0}):
                  </div>
                  {r.subjects.map((x: any) => (
                    <div key={x.id} className="flex justify-between items-center rounded-lg bg-white px-2.5 py-1 text-xs border border-gray-100">
                      <span className="font-semibold text-gray-800">{x.subject.name}</span>
                      <span>
                        {x.isSelection ? (
                          <span className="font-bold text-blue-700">{Number(x.selectionWeight)}% Seleksi</span>
                        ) : (
                          <span className="text-gray-400 text-[11px]">Non-seleksi</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {(!r.subjects || r.subjects.length === 0) && (
                    <div className="text-xs text-gray-400 py-1">Belum ada mata pelajaran terpilih.</div>
                  )}
                </div>
              )}

              <div className="mt-4 pt-3 border-t flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {r._count?.choices ?? 0} siswa memilih paket ini
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" className="h-8 text-xs" onClick={() => start(r)}>
                    Edit Paket
                  </Button>
                  <Button variant="danger" className="h-8 text-xs" onClick={() => del(r.id)}>
                    Hapus Kelas
                  </Button>
                </div>
              </div>
            </Card>
          ))}

          {rows.length === 0 && (
            <div className="col-span-2 rounded-2xl border border-dashed p-10 text-center text-gray-500">
              Belum ada paket kelas XI aktif. Gunakan salah satu Template di atas atau klik &quot;+ Tambah Paket Manual&quot;.
            </div>
          )}
        </div>
      </div>

      {/* MODAL: EDIT / TAMBAH PAKET KELAS */}
      <Modal
        open={open}
        title={edit ? `Edit Paket Kelas · ${edit.class?.name}` : 'Tambah Paket Kelas Baru'}
        onClose={() => setOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Paket Kelas'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nama Kelas (Rombel)</Label>
              <Input
                placeholder="Contoh: XI-1"
                value={form.className}
                onChange={(e) => setForm({ ...form, className: e.target.value })}
              />
            </div>
            <div>
              <Label>Nama Paket / Peminatan</Label>
              <Input
                placeholder="Contoh: Sains Murni"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Kategori Rumpun</Label>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="Mayoritas IPA">Mayoritas IPA</option>
                <option value="Mayoritas IPS">Mayoritas IPS</option>
                <option value="Campuran">Campuran</option>
              </Select>
            </div>
            <div>
              <Label>Kapasitas Siswa (Maks)</Label>
              <Input
                type="number"
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Deskripsi Paket</Label>
              <Textarea
                placeholder="Deskripsi fokus pembelajaran paket..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Pilih Mata Pelajaran & Atur Bobot Seleksi</Label>
            <p className="text-xs text-gray-500 mb-2">
              Centang mata pelajaran yang dipelajari di kelas ini. Centang &quot;Seleksi&quot; dan isi persentase bobot untuk mapel yang dijadikan acuan seleksi Academic Fit.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded-xl p-2">
              {subjects.map((s) => {
                const x = form.subjects.find((z: any) => z.subjectId === s.id);
                return (
                  <div
                    key={s.id}
                    className={`grid grid-cols-[auto_1fr_auto_90px] items-center gap-2 rounded-xl border p-2.5 transition ${
                      x ? 'bg-blue-50/30 border-blue-200' : 'bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={!!x}
                      onChange={(e) => toggleSubject(s.id, e.target.checked)}
                    />
                    <b className="text-xs text-gray-800">{s.name}</b>
                    <label className="flex items-center gap-1 text-xs font-semibold text-gray-600">
                      <input
                        type="checkbox"
                        disabled={!x}
                        checked={!!x?.isSelection}
                        onChange={(e) => changeSubject(s.id, 'isSelection', e.target.checked)}
                      />
                      Seleksi
                    </label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        disabled={!x?.isSelection}
                        value={x?.selectionWeight ?? 0}
                        onChange={(e) => changeSubject(s.id, 'selectionWeight', Number(e.target.value))}
                        className="h-8 text-xs text-center"
                      />
                      <span className="text-xs text-gray-500">%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] p-3 text-xs border">
            <span>Total Bobot Mapel Seleksi:</span>
            <b className={`text-sm ${Math.abs(total - 100) < 0.01 ? 'text-green-700' : 'text-red-600'}`}>
              {total}% (Harus 100%)
            </b>
          </div>
        </div>
      </Modal>

      {/* MODAL: EDIT / TAMBAH TEMPLATE PAKET */}
      <Modal
        open={templateEditOpen}
        title={editingTemplateKey ? `Edit Template · ${templateForm.title}` : 'Tambah Template Paket Baru'}
        onClose={() => setTemplateEditOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTemplateEditOpen(false)}>Batal</Button>
            <Button onClick={saveTemplate} disabled={templateSaving}>
              {templateSaving ? 'Menyimpan...' : 'Simpan Template'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nama / Judul Template *</Label>
              <Input
                placeholder="Contoh: Sains Murni, Sains Teknologi, dll."
                value={templateForm.title}
                onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Kategori Rumpun</Label>
              <Select
                value={templateForm.category}
                onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
              >
                <option value="Mayoritas IPA">Mayoritas IPA</option>
                <option value="Mayoritas IPS">Mayoritas IPS</option>
                <option value="Campuran">Campuran</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>Pilih Mata Pelajaran untuk Template *</Label>
            <p className="text-xs text-gray-500 mb-2">
              Pilih mata pelajaran yang termasuk ke dalam template ini. Bobot seleksi akan otomatis dibagi rata saat template diterapkan.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 max-h-60 overflow-y-auto border rounded-xl p-3 bg-gray-50/50">
              {subjects.map((s) => {
                const isSelected = templateForm.subjects.includes(s.name);
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs font-semibold cursor-pointer transition ${
                      isSelected ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleTemplateSubject(s.name, e.target.checked)}
                    />
                    <span>{s.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600">
            Terpilih: <b>{templateForm.subjects.length}</b> mata pelajaran ({templateForm.subjects.join(', ') || 'Belum ada'})
          </div>
        </div>
      </Modal>

      {/* MODAL: GUNAKAN TEMPLATE */}
      <Modal
        open={useTemplateOpen}
        title={`Gunakan Template · ${selectedTemplateForUse?.title ?? ''}`}
        onClose={() => setUseTemplateOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setUseTemplateOpen(false)}>Batal</Button>
            <Button onClick={confirmUseTemplate}>Buat Paket Kelas</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            Sistem akan membuat rombel paket kelas XI baru menggunakan kombinasi mapel seleksi dari template <b>{selectedTemplateForUse?.title}</b> ({selectedTemplateForUse?.subjects?.join(', ')}).
          </p>
          <div>
            <Label>Nama Kelas Baru (Rombel) *</Label>
            <Input
              placeholder="Contoh: XI-1"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

