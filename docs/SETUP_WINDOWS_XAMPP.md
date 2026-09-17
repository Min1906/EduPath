# Setup EduPath XI v2.4 pada Windows + XAMPP

## 1. Prasyarat

- Node.js 20 atau lebih baru
- npm
- XAMPP dengan MariaDB/MySQL

## 2. Database

1. Start **MySQL** pada XAMPP Control Panel.
2. Buka `http://localhost/phpmyadmin`.
3. Jalankan file `database/xampp-setup.sql`.

Konfigurasi development:

```text
Database : edupath_xi
Host     : 127.0.0.1
Port     : 3306
User     : edupath_app
Password : EduPathDev123!
```

## 3. Backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run dev
```

Validasi:

- `http://localhost:4000/api/v1/health`
- `http://localhost:4000/docs`

## 4. Frontend

```powershell
cd frontend
Copy-Item .env.local.example .env.local
npm install
npm run dev
```

Buka `http://localhost:3000`.

## 5. Urutan Uji End-to-End

1. Login `admin / Admin123!`.
2. Periksa Mata Pelajaran dan Kelas.
3. Import siswa/guru menggunakan template.
4. Import nilai rapor Semester 1–2 dan TKA tunggal.
5. Atur paket dan bobot mapel seleksi total 100%.
6. Login sebagai siswa, simpan serta konfirmasi P1/P2/P3.
7. Jalankan Scoring dan Ranking.
8. Jalankan Placement Simulation.
9. Periksa Occupancy dan UNPLACED.
10. Review rekomendasi lalu pindahkan siswa bila diperlukan.
11. Buat bank soal/ujian CBT, pilih mapel, kelas target, dan soal.
12. Aktifkan ujian lalu login sebagai siswa untuk mengerjakannya.

## 6. Admin Operasional

`guru.bk` memiliki role ADMIN dan otomatis menggunakan tahun ajaran aktif. Akun tersebut tidak perlu dan tidak diizinkan memilih tahun aktif melalui Settings.

SUPER_ADMIN dapat:

- membuat admin operasional baru;
- mengaktifkan tahun ajaran;
- mengatur passing grade;
- reset password user.

## 7. Import Password

Template siswa/guru memiliki kolom Username dan Password. Backend tidak menyimpan plaintext. Password langsung diubah menjadi bcrypt hash sebelum disimpan ke database.

## 8. Production

XAMPP cocok untuk development lokal. Untuk production gunakan MariaDB/MySQL Server yang dikonfigurasi untuk production, HTTPS, secret JWT kuat, backup otomatis, dan process manager.
