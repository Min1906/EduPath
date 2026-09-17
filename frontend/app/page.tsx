import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#10285f] text-white">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="inline-block rounded-full border border-white/20 px-3 py-1 text-xs font-semibold">
          EduPath XI v2.4
        </div>
        <h1 className="mt-6 max-w-4xl text-5xl font-black leading-tight">
          Perencanaan paket kelas, nilai akademik, asesmen minat bakat RIASEC, dan placement.
        </h1>
        <Link
          className="mt-8 inline-block rounded-xl bg-white px-5 py-3 font-bold text-[#173a91] hover:bg-blue-50 transition shadow-lg"
          href="/login"
        >
          Masuk ke Sistem
        </Link>
      </div>
    </main>
  );
}

