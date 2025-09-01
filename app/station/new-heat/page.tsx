"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

/** ---------------- Config activités (comme tes règles) ---------------- */
const TEAMS = [
  "2nd A", "2nd B", "2nd C", "2nd D", "2nd E", "2nd F", "2nd G", "2nd H",
  "2nd MEMN", "2nd MTNE A", "2nd MTNE B"
];

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

type ActivityType = "duel" | "triple" | "race" | "free";
function getActivityType(name: string): ActivityType {
  if (ACTIVITIES_DUEL.includes(name)) return "duel";
  if (ACTIVITIES_TRIPLE.includes(name)) return "triple";
  if (ACTIVITIES_RACE.includes(name)) return "race";
  return "free";
}

// Activités SANS record (+20 désactivé et pas d'affichage du champ)
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

/** ---------------- Types ---------------- */
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

/** ---------------- Utilitaires ---------------- */
function participationBonusForNthPass(nthPassZeroBased: number): number {
  if (nthPassZeroBased === 0) return 10;
  if (nthPassZeroBased === 1) return 5;
  if (nthPassZeroBased === 2) return 2;
  return 0;
}

/** ===================== PAGE ===================== */
export default function NewHeatPage() {
  const router = useRouter();

  const [role, setRole] = useState<string | null>(null);

  // Form state
  const [activity, setActivity] = useState<string>(ACTIVITIES[0] ?? "");
  const [team, setTeam] = useState<string>("");

  // Contrôles selon type d’activité
  const [duelOutcome, setDuelOutcome] = useState<"win" | "loss" | "">("");
  const [tripleOutcome, setTripleOutcome] = useState<"win" | "draw" | "loss" | "">("");
  const [racePlacement, setRacePlacement] = useState<1 | 2 | 3 | 4 | null>(null);
  const [freeScore, setFreeScore] = useState<string>("");

  // Records
  const [records, setRecords] = useState<Record<string, RecordInfo>>({});
  const [recordBeaten, setRecordBeaten] = useState<boolean>(false);
  const [newRecordValue, setNewRecordValue] = useState<string>("");

  // Journal : on stocke directement les lignes venues de Supabase
  const [entries, setEntries] = useState<DbEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  /** 1) Auth locale : exiger un rôle (admin/animateur), sinon login */
  useEffect(() => {
    const r = localStorage.getItem("current-role");
    if (!r) {
      router.replace("/login");
      return;
    }
    setRole(r);
  }, [router]);

  /** 2) Charger les records depuis Supabase au montage */
  useEffect(() => {
    type RecordRow = { activity: string; label: string; value: string | null };
    async function loadRecords() {
      const { data } = await supabase.from("records").select("*");
      if (data) {
        const map: Record<string, RecordInfo> = { ...DEFAULT_RECORDS };
        for (const r of data as RecordRow[]) {
          map[r.activity] = { label: r.label, value: r.value ?? undefined };
        }
        setRecords(map);
      } else {
        setRecords({ ...DEFAULT_RECORDS });
      }
    }
    loadRecords();
  }, []);

  /** 3) Charger le journal depuis Supabase (persistant) */
  useEffect(() => {
    async function loadEntries() {
      setLoadingEntries(true);
      // On récupère les dernières 100 saisies (toutes activités confondues), plus simple et fiable
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setLoadingEntries(false);
      if (!error && data) setEntries(data as DbEntry[]);
    }
    loadEntries();
  }, []);

  /** 4) Reset des contrôles quand l’activité change */
  useEffect(() => {
    setDuelOutcome("");
    setTripleOutcome("");
    setRacePlacement(null);
    setFreeScore("");
    setRecordBeaten(false);
    setNewRecordValue("");
  }, [activity]);

  /** 5) Saisie stricte numérique pour "free" */
  function handleFreeScoreChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, "");
    setFreeScore(val);
  }

  /** 6) Suppression d’une ligne : supprime en base, puis côté UI */
  async function deleteEntry(id: string) {
    const ok = confirm("Supprimer définitivement cette saisie ? (action irréversible)");
    if (!ok) return;
    const { error } = await supabase.from("entries").delete().eq("id", id);
    if (error) {
      alert("Erreur lors de la suppression : " + error.message);
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  /** 7) Calcul des points d’épreuve selon le type */
  function computeScorePoints(type: ActivityType): number | null {
    if (type === "duel") {
      if (duelOutcome === "win") return 10;
      if (duelOutcome === "loss") return 4;
      return null;
    }
    if (type === "triple") {
      if (tripleOutcome === "win") return 10;
      if (tripleOutcome === "draw") return 7;
      if (tripleOutcome === "loss") return 5;
      return null;
    }
    if (type === "race") {
      if (racePlacement === 1) return 10;
      if (racePlacement === 2) return 7;
      if (racePlacement === 3) return 5;
      if (racePlacement === 4) return 3;
      return null;
    }
    // free: la valeur entrée devient les points d’épreuve
    if (freeScore === "" || isNaN(Number(freeScore))) return null;
    return Number(freeScore);
  }

  /** 8) Soumission : compte les participations depuis Supabase + insert + upsert record */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!activity) { alert("Choisis une activité."); return; }
    if (!team)     { alert("Choisis une équipe."); return; }

    const type = getActivityType(activity);
    const scorePoints = computeScorePoints(type);
    if (scorePoints === null) {
      alert("Sélectionne le résultat (ou entre un score) selon l’activité.");
      return;
    }

    // Participation : compter les passages DÉJÀ enregistrés en base (persistant)
    const { count, error: cntErr } = await supabase
      .from("entries")
      .select("id", { count: "exact", head: true })
      .eq("activity", activity)
      .eq("team", team);

    if (cntErr) {
      alert("Erreur lors du calcul des participations : " + cntErr.message);
      return;
    }

    const previousPasses = count ?? 0;
    const participationPoints = participationBonusForNthPass(previousPasses);

    // Record : si activé et coché, upsert dans Supabase
    const recordsDisabled = NO_RECORD_ACTIVITIES.has(activity);
    let recordBonus = 0;
    let recordValue: string | null = null;

    if (!recordsDisabled && recordBeaten) {
      if (!newRecordValue.trim()) {
        alert("Entre la nouvelle valeur du record.");
        return;
      }
      recordBonus = 20;
      recordValue = newRecordValue.trim();

      const label =
        records[activity]?.label ||
        DEFAULT_RECORDS[activity]?.label ||
        "Record";

      const { error: recErr } = await supabase
        .from("records")
        .upsert({ activity, label, value: recordValue }, { onConflict: "activity" });

      if (recErr) {
        alert("Erreur mise à jour du record : " + recErr.message);
        return;
      }

      // mettre à jour l’état local d’affichage (record)
      setRecords((prev) => ({
        ...prev,
        [activity]: { label, value: recordValue ?? undefined },
      }));
    }

    // Insérer la saisie et récupérer la ligne créée (id réel)
    const { data: inserted, error: insErr } = await supabase
      .from("entries")
      .insert({
        activity,
        team,
        score_points:         scorePoints,
        participation_points: participationPoints,
        record_bonus:         recordBonus,
        record_value:         recordValue,
      })
      .select("*")
      .single();

    if (insErr || !inserted) {
      alert("Erreur enregistrement des points : " + (insErr?.message ?? "insert null"));
      return;
    }

    // Ajouter en haut du journal (persistance + affichage)
    setEntries((prev) => [inserted as DbEntry, ...prev]);

    // Reset des champs
    setTeam("");
    setDuelOutcome("");
    setTripleOutcome("");
    setRacePlacement(null);
    setFreeScore("");
    setRecordBeaten(false);
    setNewRecordValue("");
  }

  /** 9) Mini-classement local (facultatif) : basé sur entries chargés */
  const miniRows = useMemo(() => {
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

  if (role === null) return null;
  const isAdmin = role === "admin";
  const type = getActivityType(activity);
  const currentRecord = records[activity] ?? DEFAULT_RECORDS[activity];
  const recordsDisabled = NO_RECORD_ACTIVITIES.has(activity);

  function Button({
    active,
    onClick,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={
          "flex-1 rounded-xl border px-3 py-2 text-sm " +
          (active
            ? "border-neutral-900 bg-neutral-900 text-white"
            : "border-neutral-300 bg-white")
        }
      >
        {children}
      </button>
    );
  }

  return (
    <main className="min-h-screen py-6">
      <h1 className="mb-4 text-xl font-bold">Saisir un score (par équipe)</h1>

      {/* Sélecteur d’activité + record (si autorisé) */}
      <div className="mb-4 rounded-2xl border border-neutral-200 bg-white p-4 space-y-2">
        <label className="block">
          <span className="mb-1 block text-sm text-neutral-600">Activité</span>
          <select
            value={activity}
            onChange={(e) => setActivity(e.target.value)}
            className="w-full rounded-lg border p-3 bg-white"
          >
            {ACTIVITIES.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        {!recordsDisabled && (
          <div className="rounded-xl bg-neutral-50 p-3 text-sm">
            <div className="text-neutral-600">Record à battre</div>
            <div className="mt-1">
              <span className="font-medium">{currentRecord?.label ?? "Record"}</span>
              {" : "}
              <span className="text-neutral-800">
                {currentRecord?.value ? currentRecord.value : "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Formulaire */}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
          {/* ÉQUIPE */}
          <label className="block">
            <span className="mb-1 block text-sm text-neutral-600">Équipe</span>
            <select
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className="w-full rounded-lg border p-3 bg-white"
              required
            >
              <option value="" disabled>Choisir une équipe…</option>
              {TEAMS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          {/* Points d’épreuve selon type */}
          {type === "duel" && (
            <div>
              <div className="mb-2 text-sm text-neutral-600">Résultat (duel) :</div>
              <div className="flex gap-2">
                <Button active={duelOutcome === "win"} onClick={() => setDuelOutcome("win")}>
                  Victoire · 10 pts
                </Button>
                <Button active={duelOutcome === "loss"} onClick={() => setDuelOutcome("loss")}>
                  Défaite · 4 pts
                </Button>
              </div>
            </div>
          )}

          {type === "triple" && (
            <div>
              <div className="mb-2 text-sm text-neutral-600">Résultat :</div>
              <div className="flex gap-2">
                <Button active={tripleOutcome === "win"} onClick={() => setTripleOutcome("win")}>
                  Victoire · 10 pts
                </Button>
                <Button active={tripleOutcome === "draw"} onClick={() => setTripleOutcome("draw")}>
                  Nul · 7 pts
                </Button>
                <Button active={tripleOutcome === "loss"} onClick={() => setTripleOutcome("loss")}>
                  Défaite · 5 pts
                </Button>
              </div>
            </div>
          )}

          {type === "race" && (
            <div>
              <div className="mb-2 text-sm text-neutral-600">Classement de la manche :</div>
              <div className="grid grid-cols-4 gap-2">
                <Button active={racePlacement === 1} onClick={() => setRacePlacement(1)}>
                  1er · 10 pts
                </Button>
                <Button active={racePlacement === 2} onClick={() => setRacePlacement(2)}>
                  2e · 7 pts
                </Button>
                <Button active={racePlacement === 3} onClick={() => setRacePlacement(3)}>
                  3e · 5 pts
                </Button>
                <Button active={racePlacement === 4} onClick={() => setRacePlacement(4)}>
                  4e · 3 pts
                </Button>
              </div>
            </div>
          )}

          {type === "free" && (
            <label className="block">
              <span className="mb-1 block text-sm text-neutral-600">Score libre (entier)</span>
              <input
                value={freeScore}
                onChange={handleFreeScoreChange}
                className="w-full rounded-lg border p-3 text-right"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Ce score libre compte comme « points d’épreuve ».
              </p>
            </label>
          )}

          {/* Record (si autorisé) */}
          {!NO_RECORD_ACTIVITIES.has(activity) && (
            <div className="rounded-xl border border-neutral-200 p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recordBeaten}
                  onChange={(e) => setRecordBeaten(e.target.checked)}
                />
                Record battu ? (+20 pts)
              </label>

              {recordBeaten && (
                <div className="mt-3">
                  <label className="block text-sm text-neutral-600">
                    Nouvelle valeur du record {(records[activity] ?? DEFAULT_RECORDS[activity])?.label ? `(${(records[activity] ?? DEFAULT_RECORDS[activity])?.label})` : ""}
                  </label>
                  <input
                    value={newRecordValue}
                    onChange={(e) => setNewRecordValue(e.target.value)}
                    className="mt-1 w-full rounded-lg border p-3"
                    placeholder="ex. 12.34 s · 210 cm · 25 pts…"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <a
            href="/station"
            className="flex-1 rounded-2xl border border-neutral-300 bg-white py-3 text-center"
          >
            Retour
          </a>
          <button type="submit" className="flex-1 rounded-2xl bg-black py-3 text-white">
            Enregistrer
          </button>
        </div>
      </form>

      {/* Journal des saisies (chargé depuis Supabase) */}
      <section className="mt-6 space-y-3">

        {loadingEntries ? (
          <p className="text-sm text-neutral-500">Chargement…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-neutral-500">Aucune saisie pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => (
              <li key={e.id} className="rounded-2xl border border-neutral-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-neutral-500">
                      {new Date(e.created_at).toLocaleString()}
                    </div>
                    <div className="mt-1 text-base">
                      <span className="font-medium">{e.team}</span> · {e.activity}
                    </div>
                    <div className="text-sm text-neutral-700">
                      Points épreuve : {e.score_points}
                    </div>
                    <div className="text-sm text-neutral-700">
                      Points participation : {e.participation_points}
                    </div>
                    {e.record_bonus > 0 && (
                      <div className="text-sm text-green-700">
                        Record battu : +{e.record_bonus} pts — valeur = {e.record_value}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => deleteEntry(e.id)}
                    className="shrink-0 rounded-xl border border-neutral-300 bg-white px-3 py-1 text-sm"
                    aria-label="Supprimer cette saisie"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mini-classement local : indicatif */}
      {isAdmin && (
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">Mini-classement (local)</h2>
          <MiniLeaderboardLocal rows={miniRows} />
        </section>
      )}

      {/* Bouton Déconnexion */}
      <div className="mt-10">
        <button
          onClick={() => {
            localStorage.removeItem("current-role");
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

/** --------- Composant mini-classement local --------- */
function MiniLeaderboardLocal({
  rows,
}: {
  rows: {
    team: string;
    totalScorePoints: number;
    totalParticipation: number;
    totalRecordBonus: number;
    combined: number;
  }[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-500">Pas encore de points à agréger.</p>;
    }

  return (
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
  );
}
