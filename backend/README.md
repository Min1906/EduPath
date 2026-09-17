# Backend EduPath XI v2.4

NestJS + Prisma + MariaDB/MySQL backend.

## Commands

```bash
npm install
npx prisma generate
npx prisma db push
npm run prisma:seed
npm run dev
```

## Role

- `SUPER_ADMIN`: seluruh operasi dan Settings.
- `ADMIN`: operasi akademik tanpa Settings.
- `STUDENT`: profil, pilihan kelas, CBT, dan ubah password.

Swagger tersedia pada `/docs` dan health check pada `/api/v1/health`.
