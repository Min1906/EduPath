# Changelog v2.4

### Pembaruan Minat Bakat (RIASEC) & Rekomendasi Peminatan:
- **Impor Nilai RIASEC**: Menambahkan fitur impor asesmen RIASEC siswa via Excel dengan preview dan validasi tipe dominan (`admin/scores`).
- **Bobot RIASEC Seleksi**: Mengganti bobot pilihan menjadi bobot RIASEC pada scoring konfigurasi seleksi (`admin/selection`).
- **Dashboard RIASEC Interaktif**: Menambahkan visualisasi radar chart Holland Model untuk melihat kecenderungan minat bakat per kelas maupun agregat angkatan (`admin/dashboard`).
- **Grafik Interaktif Keselarasan Placement & RIASEC**: Menambahkan visualisasi SVG Donut Ring, Radial Alignment Index, horizontal bar chart per rombel paket dengan filter cluster rumpun keilmuan, matriks korelasi RIASEC, dan tabel interaktif siswa bimbingan BK (`admin/dashboard`).
- **Simulasi Placement Cerdas**: Menambahkan dialog modal simulasi penempatan dengan auto-adjustment sisa kuota berbasis RIASEC, scoring config dinamis, dan multi-criteria tie breaking (`admin/placement`).
- **Perapian Format Angka RIASEC**: Memperbaiki tampilan skor RIASEC di seluruh komponen (radar chart, kartu dimensi, tabel per kelas) menjadi format 1 desimal yang rapi dan konsisten.
- **Rekomendasi Kelas Siswa**: Menyertakan profil RIASEC dalam radar chart portal siswa dan perhitungan kesesuaian rekomendasi paket peminatan.

### Manajemen Mata Pelajaran & Penempatan:
- **Filter Tahun Ajaran Mata Pelajaran**: Menambahkan selector filter tahun ajaran pada daftar nilai mapel (`admin/subjects`).
- **Pembersihan Kolom Mapel**: Menghapus kolom "Sampel Nilai" yang tidak diperlukan dari tabel mata pelajaran.

### Pembersihan Modul Ujian / CBT:
- Menghapus seluruh tabel, model Prisma, rute API, dan modul backend terkait Ujian & CBT (`Exam`, `ExamClassTarget`, `Question`, `ExamQuestion`, `ExamSession`, `StudentAnswer`).
- Membersihkan antarmuka frontend dari referensi CBT untuk fokus penuh pada Sistem Penjurusan & Peminatan Akademik Kelas XI.
