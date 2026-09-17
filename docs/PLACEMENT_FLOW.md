# Alur Placement Siswa

## A. Siswa Sesuai dengan Pilihan

1. Siswa memilih maksimal tiga paket: P1, P2, P3.
2. Backend menghitung Academic Fit untuk setiap paket berdasarkan nilai mapel seleksi dan bobot manual paket.
3. Nilai Academic Fit digabung dengan TKA tunggal dan Preference Score sesuai Scoring Version aktif.
4. Passing Grade tahun ajaran menentukan `ELIGIBLE` atau `NEED_REVIEW`.
5. Sistem mengurutkan kandidat per paket berdasarkan Final Score.
6. Placement memproses P1 dahulu, kemudian P2 dan P3, dengan tetap memeriksa kapasitas.
7. Siswa yang memperoleh kursi berstatus `TEMPORARY` sampai admin menekan Finalisasi.

## B. Siswa Tidak Memenuhi Kriteria Semua Pilihan

Siswa tidak dipaksa masuk ke salah satu pilihan yang tidak memenuhi syarat. Statusnya menjadi:

```text
UNPLACED
```

Backend kemudian mencari rekomendasi dengan aturan:

1. paket lain yang memiliki score `ELIGIBLE`;
2. kelas masih memiliki kursi;
3. urutkan berdasarkan Final Score tertinggi;
4. tampilkan maksimal tiga rekomendasi kepada admin/BK.

Admin memilih **Review & Tempatkan**, memeriksa rekomendasi, lalu menentukan kelas tujuan dan alasan.

## C. Tidak Eligible di Semua Paket

Jika siswa tidak eligible pada seluruh paket, rekomendasi otomatis dapat kosong. Kasus masuk `NEED_REVIEW` dan perlu keputusan manusia, misalnya:

- koreksi data rapor/TKA;
- wawancara BK;
- kelas bridging/remedial;
- kebijakan khusus sekolah;
- penyesuaian passing grade hanya melalui policy resmi dan scoring ulang.

Sistem tidak boleh diam-diam memasukkan siswa ke kelas yang tidak memenuhi kriteria.

## D. Perubahan Setelah Final

`FINAL` berarti hasil resmi, bukan tidak dapat diubah selamanya. Pemindahan setelah final tetap tersedia melalui controlled override:

- kelas tujuan diperiksa kapasitasnya;
- alasan wajib diisi;
- status tetap FINAL;
- aktivitas dicatat dalam AuditLog.

## E. Fairness Audit

Fairness Audit tidak menentukan kelas dan tidak memindahkan siswa. Fungsinya mencari kasus yang perlu penjelasan, seperti:

- skor tinggi tidak memperoleh paket;
- skor lebih rendah memperoleh kursi karena prioritas pilihan;
- override manual;
- pengecualian kapasitas atau kebijakan.
