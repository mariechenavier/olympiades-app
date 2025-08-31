"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StationPage() {
  const router = useRouter();

  useEffect(() => {
    const role = localStorage.getItem("current-role");
    if (role !== "animator") {
      router.replace("/login");
    }
  }, [router]);

  return (
    <main className="min-h-screen py-6">
      <h1 className="mb-4 text-xl font-bold">Poste animateur</h1>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="text-neutral-600">
          Utilisez “Nouvelle manche” pour enregistrer les résultats.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <a
          href="/station/new-heat"
          className="block w-full rounded-2xl bg-black py-3 text-center text-white"
        >
          Nouvelle manche
        </a>

        <button
          onClick={() => {
            localStorage.removeItem("current-role");
            // (facultatif) conserver les données de scores
            // localStorage.removeItem("journal-saisies");
            // localStorage.removeItem("activity-records");
            location.href = "/login";
          }}
          className="w-full rounded-2xl border border-neutral-300 bg-white py-3"
        >
          Déconnexion
        </button>
      </div>
    </main>
  );
}
