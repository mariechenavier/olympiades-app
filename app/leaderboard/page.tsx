"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
const ACTIVITIES = [
  ...ACTIVITIES_DUEL,
  ...ACTIVITIES_TRIPLE,
  ...ACTIVITIES_RACE,
  ...ACTIVITIES_FREE,
];

const NO_RECORD_ACTIVITIES = new Set<string>([
  "Foulard musical",
  "Jenga géant",
  "Morpion géant",
  "Tir croisé (électronique)",
  "Blind test",
  "La rumeur",
  "Question pour un champion",
]);

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

type DbEntry = {
  id: string;
  created_at: string;
  activity: string;
  team: string;
  score_points: number;
  participation_points: number;
  record_bonus: number;
  record_value: string | null;
};
type RecordRow = { activity: string; label: string; value: string | null };

export default function LeaderboardPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [entries, setEntries] = useState<DbEntry[]>([]);
  const [records, setRecords] = useState<Record<string, RecordInfo>>({ ...DEFAULT_RECORDS });

  // états de chargement des actions admin
  const [resettingScores, setResettingScores] = useState(false);
  const [resettingRecords, setResettingRecords] = useState(false);

  // 1) Vérifier rôle
  useEffect(() => {
    const role = typeof window !== "undefined" ? localStorage.getItem("current-role") : null;
    if (role !== "admin") router.replace("/login");
    else setReady(true);
  }, [router]);

  // 2) Charger entries + realtime
  useEffect(() => {
    if (!ready) return;

    (async () => {
      const { data } = await supabase
        .from("entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setEntries(data as DbEntry[]);
    })();

    const channel = supabase
      .channel("entries-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "entries" },
        (payload) => setEntries((prev) => [payload.new as DbEntry, ...prev])
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ready]);

  // 3) Charger records + realtime
  useEffect(() => {
    if (!ready) return;

    (async () => {
      const { data } = await supabase.from("records").select("*");
      if (data) {
        const map: Record<string, RecordInfo> = { ...DEFAULT_RECORDS };
        for (const r of data as RecordRow[]) {
          map[r.activity] = { label: r.label, value: r.value ?? undefined };
        }
        setRecords(map);
      }
    })();

    const channel = supabase
      .channel("records-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "records" },
        (payload) => {
          const r = payload.new as RecordRow;
          setRecords((prev) => ({ ...prev, [r.activity]: { label: r.label, value: r.value ?? undefined } }));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "records" },
        (payload) => {
          const r = payload.new as RecordRow;
          setRecords((prev) => ({ ...prev, [r.activity]: { label: r.label, value: r.value ?? undefined } }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ready]);

  // 4) Agrégation
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
      row.totalScorePoints += e.score_points;
      row.totalParticipation += e.participation_points;
      row.totalRecordBonus += e.record_bonus;
      row.combined = row.totalScorePoints + row.totalParticipation + row.totalRecordBonus;
      map.set(e.team, row);
    }
    return Array.from(map.values()).sort((a, b) => b.combined - a.combined);
  }, [entries]);

  // 5) Préparer records à afficher
  const recordsForDisplay = useMemo(() => {
    const withRecord = ACTIVITIES.filter((a) => !NO_RECORD_ACTIVITIES.has(a));
    return withRecord.map((activity) => {
      const r = records[activity] ?? DEFAULT_RECORDS[activity] ?? { label: "Record" };
      return { activity, label: r.label, value: r.value };
    });
  }, [records]);

  // 6) Actions admin : reset scores / reset records
  async function handleResetScores() {
    if (!confirm("Confirmer la réinitialisation de TOUS les scores ? Cette action est irréversible.")) return;
    setResettingScores(true);
    // Supabase demande un filtre pour delete-all : on met une condition toujours vraie
    const { error } = await supabase
      .from("entries")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    setResettingScores(false);
    if (error) {
      alert("Erreur lors de la réinitialisation des scores : " + error.message);
      return;
    }
    setEntries([]);
  }

  async function handleResetRecords() {
    if (!confirm("Confirmer la réinitialisation des valeurs de records (les libellés seront conservés) ?")) return;
    setResettingRecords(true);
    const { error } = await supabase
      .from("records")
      .update({ value: null })
      .not("activity", "is", null); // filtre toujours vrai
    setResettingRecords(false);
    if (error) {
      alert("Erreur lors de la réinitialisation des records : " + error.message);
      return;
    }
    setRecords({ ...DEFAULT_RECORDS }); // on conserve les libellés, valeurs vides
  }

  return (
    <main className="min-h-screen py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Classement & Records (Administration)</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetScores}
            disabled={resettingScores}
            className="rounded-2xl border border-red-300 bg-white px-3 py-2 text-sm text-red-700 disabled:opacity-60"
            title="Vider toutes les saisies de scores"
          >
            {resettingScores ? "Réinitialisation…" : "Réinitialiser scores"}
          </button>
          <button
            onClick={handleResetRecords}
            disabled={resettingRecords}
            className="rounded-2xl border border-amber-300 bg-white px-3 py-2 text-sm text-amber-700 disabled:opacity-60"
            title="Remettre tous les records à vide (conserve les libellés)"
          >
            {resettingRecords ? "Réinitialisation…" : "Réinitialiser records"}
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("current-role");
              location.href = "/login";
            }}
            className="rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            Déconnexion
          </button>
        </div>
      </div>

      {!ready ? (
        <p className="text-sm text-neutral-500">Chargement…</p>
      ) : (
        <>
          {/* Classement */}
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

          {/* Records */}
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
          </section>
        </>
      )}
    </main>
  );
}
