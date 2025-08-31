"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/** --------- Config partagée (même dénominations que ta page de saisie) --------- */

// Catégories (utiles si tu veux filtrer plus tard)
const ACTIVITIES_DUEL = [
  "Accronomètre",
  "Jenga géant",
  "Morpion géant",
  "Combat de Sumo",
  "Tir à la corde",
  "Tir croisé (électronique)",
];

const ACTIVITIES_TRIPLE = ["Baby-foot humain"];

const ACTIVITIES_RACE = [
  "Ballon coop’",
  "Blind test",
  "Course en sac",
  "Foulard musical",
  "La rumeur",
  "La tour infernale",
  "Mission à l’aveugle",
  "Question pour un champion",
  "Teamwalk (Ski Géant)",
];

const ACTIVITIES_FREE = ["Archery Tag", "Tyro Basket"];

// Liste globale (ordre d’affichage souhaité)
const ACTIVITIES = [
  ...ACTIVITIES_DUEL,
  ...ACTIVITIES_TRIPLE,
  ...ACTIVITIES_RACE,
  ...ACTIVITIES_FREE,
];

// Activités SANS record (tu les as explicitement exclues du bonus + de l’UI)
const NO_RECORD_ACTIVITIES = new Set<string>([
  "Foulard musical",
  "Jenga géant",
  "Morpion géant",
  "Tir croisé (électronique)",
  "Blind test",
  "La rumeur",
  "Question pour un champion",
]);

// Libellés par défaut pour l’affichage “Record à battre”
type RecordInfo = { label: string; value?: string };
const DEFAULT_RECORDS: Record<string, RecordInfo> = {
  "Accronomètre": { label: "Meilleur chrono (mm:ss ou s)" },
  "Jenga géant": { label: "Plus haute tour (cm)" },
  "Morpion géant": { label: "Victoires consécutives" },
  "Combat de Sumo": { label: "Victoire la plus rapide (s)" },
  "Tir à la corde": { label: "Victoire la plus rapide (s)" },
  "Tir croisé (électronique)": { label: "Score le plus élevé" },
  "Baby-foot humain": { label: "Score de victoire le plus large" },
  "Ballon coop’": { label: "Meilleur chrono (s)" },
  "Blind test": { label: "Plus grand nombre de bonnes réponses" },
  "Course en sac": { label: "Meilleur chrono (s)" },
  "Foulard musical": { label: "Derniers survivants (compte)" },
  "La rumeur": { label: "Chaîne la plus longue sans erreur" },
  "La tour infernale": { label: "Hauteur max (cm)" },
  "Mission à l’aveugle": { label: "Meilleur chrono (s)" },
  "Question pour un champion": { label: "Score le plus élevé" },
  "Teamwalk (Ski Géant)": { label: "Meilleur chrono (s)" },
  "Archery Tag": { label: "Cibles tombées (sur 5 joueurs)" },
  "Tyro Basket": { label: "Points d'équipe max" },
};

/** ---------------------- Types ---------------------- */
type EntryLocal = {
  id: string;
  activity: string;
  team: string;
  scorePoints: number;
  rawScore?: number;
  participationPoints: number;
  recordBonus: number;
  recordValue?: string;
  createdAt: string;
};

/** ====================================================
 *                 Page Admin /leaderboard
 *  - Vérifie rôle admin
 *  - Charge scores + records depuis localStorage
 *  - Affiche Classement + Tableau des records
 * ==================================================== */
export default function LeaderboardPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<EntryLocal[]>([]);
  const [records, setRecords] = useState<Record<string, RecordInfo>>({});

  // Contrôle du rôle + chargement des données locales
  useEffect(() => {
    const role = localStorage.getItem("current-role");
    if (role !== "admin") {
      router.replace("/login");
      return;
    }

    // Journal de saisies
    try {
      const raw = localStorage.getItem("journal-saisies");
      if (raw) setEntries(JSON.parse(raw));
    } catch {}

    // Records
    try {
      const rawR = localStorage.getItem("activity-records");
      if (rawR) setRecords(JSON.parse(rawR));
      else setRecords(DEFAULT_RECORDS); // fallback
    } catch {
      setRecords(DEFAULT_RECORDS);
    }

    setReady(true);
  }, [router]);

  // Agrégation du classement
  const rows = useMemo(() => {
    type Row = {
      team: string;
      totalScorePoints: number;
      totalParticipation: number;
      totalRecordBonus: number;
      combined: number;
    };
    const map = new Map<string, Row>();

    for (const e of entries) {
      const row = map.get(e.team) ?? {
        team: e.team,
        totalScorePoints: 0,
        totalParticipation: 0,
        totalRecordBonus: 0,
        combined: 0,
      };
      row.totalScorePoints += e.scorePoints;
      row.totalParticipation += e.participationPoints;
      row.totalRecordBonus += e.recordBonus;
      row.combined = row.totalScorePoints + row.totalParticipation + row.totalRecordBonus;
      map.set(e.team, row);
    }

    return Array.from(map.values()).sort((a, b) => b.combined - a.combined);
  }, [entries]);

  // Records à afficher : uniquement les activités qui acceptent un record
  const recordsForDisplay = useMemo(() => {
    // On part de la liste d’activités (ordre fixé), on filtre celles avec record autorisé
    const withRecord = ACTIVITIES.filter((a) => !NO_RECORD_ACTIVITIES.has(a));
    // Pour chaque activité, on compose le libellé + valeur locale si existante
    return withRecord.map((activity) => {
      const fromLocal = records[activity];
      const base = DEFAULT_RECORDS[activity];
      const label = fromLocal?.label ?? base?.label ?? "Record";
      const value = fromLocal?.value ?? base?.value ?? undefined; // si jamais stockée
      return { activity, label, value };
    });
  }, [records]);

  if (!ready) return null;

  return (
    <main className="min-h-screen py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Classement & Records (Administration)</h1>
        <button
          onClick={() => {
            localStorage.removeItem("current-role");
            location.href = "/login";
          }}
          className="rounded-2xl border border-neutral-300 bg-white px-4 py-2 text-sm"
        >
          Déconnexion
        </button>
      </div>

      {/* --- Classement global --- */}
      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Classement global</h2>

        {rows.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucune donnée pour le moment.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Équipe</th>
                  <th className="px-3 py-2 text-right">Points épreuve</th>
                  <th className="px-3 py-2 text-right">Participation</th>
                  <th className="px-3 py-2 text-right">Bonus record</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.team} className="border-t">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2">{row.team}</td>
                    <td className="px-3 py-2 text-right">{row.totalScorePoints}</td>
                    <td className="px-3 py-2 text-right">{row.totalParticipation}</td>
                    <td className="px-3 py-2 text-right">{row.totalRecordBonus}</td>
                    <td className="px-3 py-2 text-right">{row.combined}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Tableau des records --- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Meilleurs records par activité</h2>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-left">Activité</th>
                <th className="px-3 py-2 text-left">Record à battre</th>
                <th className="px-3 py-2 text-left">Valeur actuelle</th>
              </tr>
            </thead>
            <tbody>
              {recordsForDisplay.map((r) => (
                <tr key={r.activity} className="border-t">
                  <td className="px-3 py-2">{r.activity}</td>
                  <td className="px-3 py-2">{r.label}</td>
                  <td className="px-3 py-2">{r.value ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-neutral-500">
          Astuce : les records se mettent à jour automatiquement quand un animateur coche “Record battu ?” et saisit la nouvelle valeur sur la page de saisie.
        </p>
      </section>
    </main>
  );
}
