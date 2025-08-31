"use client";

import { supabase } from "@/lib/supabase";
import { useState } from "react";

export default function Home() {
  const [msg, setMsg] = useState<string>("");

  async function testSupabase() {
    setMsg("Test en cours...");
    const { data, error } = await supabase.from("records").select("*").limit(1);
    if (error) {
      setMsg("Erreur Supabase : " + error.message);
    } else {
      setMsg("OK ✅ Connexion Supabase opérationnelle");
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-8">Olympiades</h1>

      <a
        href="/login"
        className="rounded-2xl bg-black text-white px-6 py-3 text-lg font-semibold mb-4"
      >
        C’est parti !
      </a>

      <button
        onClick={testSupabase}
        className="rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm"
      >
        Test Supabase
      </button>

      {msg && <p className="mt-3 text-sm text-neutral-600">{msg}</p>}
    </main>
  );
}
