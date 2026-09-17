# Matriks Integrasi API v2.4

| Modul Frontend | Fungsi | Endpoint |
|---|---|---|
| Login | Login dan identitas | `POST /auth/login`, `GET /auth/me` |
| Student | Ganti password | `POST /auth/change-password` |
| Subjects | CRUD mata pelajaran | `/subjects` |
| Classes | Kelas X/XI dan daftar siswa | `/classes` |
| Students | List/search/sort/detail | `/students`, `/students/detail/:id` |
| Students | Template/import/reset akun | `/students/template/download`, `/students/import`, `/students/reset-passwords` |
| Teachers | Template/import admin terpilih | `/teachers/template`, `/teachers/import` |
| Scores | Ringkasan/freeze/import | `/scores/*` |
| Packages | CRUD, template, bobot mapel | `/packages/*` |
| Selection | Config, scoring, ranking | `/selection/*` |
| Placement | Simulation, occupancy, unplaced, move, finalize | `/placement/*` |
| CBT Admin | Questions/exams/targets/status | `/cbt/questions*`, `/cbt/exams*` |
| CBT Student | List/start/autosave/submit | `/cbt/student/*` |
| Settings | Tahun/policy/user password | `/academic-years/*`, `/settings/*`, `/users/*` |
| Student Choice | Profile/packages/preferences | `/student/*` |

Semua endpoint admin menggunakan JWT. Endpoint Settings hanya menerima role SUPER_ADMIN. Endpoint operasional menerima SUPER_ADMIN dan ADMIN. Endpoint portal siswa mengambil `studentId` dari JWT, bukan dari NIS yang dikirim frontend.
