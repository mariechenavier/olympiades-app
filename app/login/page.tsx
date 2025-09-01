"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (pin === "9999") {
      localStorage.setItem("current-role", "admin");
      router.replace("/leaderboard");      // admin → tableau
      return;
    }

    if (pin === "1111") {
      localStorage.setItem("current-role", "animateur");
      router.replace("/station/new-heat"); // animateur → saisie directe
      return;
    }

    alert("PIN invalide");
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="rounded-2xl border p-6 bg-white">
        <h1 className="text-xl font-bold mb-4">Connexion</h1>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          className="border rounded-lg p-3 w-64"
          placeholder="PIN"
        />
        <button type="submit" className="mt-4 w-full rounded-xl bg-black text-white py-2">
          Entrer
        </button>
      </form>
    </main>
  );
}
