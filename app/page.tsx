"use client";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-8">Olympiades</h1>
      <a
        href="/login"
        className="rounded-2xl bg-black text-white px-6 py-3 text-lg font-semibold"
      >
        C’est parti !
      </a>
    </main>
  );
}
