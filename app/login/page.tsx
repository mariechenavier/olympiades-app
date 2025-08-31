"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// PINs d'exemple (à changer)
const ADMIN_PINS = ["9999", "1234"];
const ANIMATOR_PINS = ["1111", "2222", "3333", "4444"];

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = pin.trim();

    if (ADMIN_PINS.includes(code)) {
      localStorage.setItem("current-role", "admin");
      router.push("/leaderboard");
      return;
    }

    if (ANIMATOR_PINS.includes(code)) {
      localStorage.setItem("current-role", "animator");
      router.push("/station");
      return;
    }

    alert("PIN invalide.");
  }

  return (
    <form onSubmit={onSubmit} className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-xs space-y-4">
        <h1 className="text-xl font-bold text-center">Connexion</h1>

        <input
          type="password"
          placeholder="Code PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border p-3 text-center tracking-widest"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus
          required
        />

        <button type="submit" className="w-full rounded-lg bg-black py-3 text-white">
          Entrer
        </button>

        <p className="text-xs text-neutral-500 text-center">
          PIN admin → classement. PIN animateur → saisie des scores.
        </p>
      </div>
    </form>
  );
}

