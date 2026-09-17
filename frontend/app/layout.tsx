import './globals.css';

export const metadata = {
  title: 'EduPath XI v2.4',
  description: 'Sistem Informasi Penjurusan & Peminatan Akademik Kelas XI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
