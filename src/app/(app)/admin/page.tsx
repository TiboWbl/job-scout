import { notFound } from "next/navigation";
import { CHART_DAYS, dashboardStats, invitees } from "@/lib/admin/stats";
import { isAdminEmail } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { CollectButton } from "./collect-button";
import { Columns, Rows } from "./charts";
import { Invitations } from "./invitations";

type Run = { source: string; started_at: string; offers_seen: number; offers_new: number; offers_archived: number; errors: number; error_sample: string | null };

export default async function AdminPage() {
  const { user } = await getUser();
  if (!isAdminEmail(user?.email)) notFound();

  const db = createAdminClient();
  const [runs, invitations, stats] = await Promise.all([
    db.from("collection_runs").select("source, started_at, offers_seen, offers_new, offers_archived, errors, error_sample").order("started_at", { ascending: false }).limit(300),
    db.from("invitations").select("email").order("created_at", { ascending: false }),
    dashboardStats(db),
  ]);
  const fromEnv = (process.env.INVITED_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const people = await invitees(db, process.env.ADMIN_EMAIL, fromEnv, (invitations.data ?? []).map((i) => i.email as string));

  // Latest run per source, plus the previous one to spot a sudden drop.
  const bySource = new Map<string, Run[]>();
  for (const r of (runs.data ?? []) as Run[]) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);
  const rows = [...bySource.entries()].map(([source, list]) => ({ source, last: list[0], prev: list[1] })).sort((a, b) => a.source.localeCompare(b.source));

  return (
    <div className="max-w-5xl px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Admin</h1>
      <p className="mt-2 text-[15px] text-muted">Chiffres agrégés uniquement : rien ici ne dit qui cherche quoi.</p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Offres actives en France", stats.activeOffers],
          ["Pages carrière surveillées", stats.directory],
          ["Offres lues par l'IA", stats.judgedByAi],
          ["Personnes qui cherchent", stats.onboarded],
          ["Candidatures suivies", stats.applications],
          ["Offres ajoutées par URL", stats.added],
          ["Entreprises favorites", stats.favorites],
          ["Invitations", people.length],
        ].map(([label, n]) => (
          <div key={label} className="rounded-[20px] border border-line bg-surface p-4">
            <p className="font-display text-3xl font-extrabold tabular-nums">{Number(n).toLocaleString("fr-FR")}</p>
            <p className="text-sm text-muted">{label}</p>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-[22px] border border-line bg-surface p-5">
        <h2 className="font-display text-xl font-bold">Nouvelles offres, {CHART_DAYS} derniers jours</h2>
        <div className="mt-4">
          <Columns data={stats.perDay} label="Nouvelles offres par jour" />
        </div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-[22px] border border-line bg-surface p-5">
          <h2 className="font-display text-xl font-bold">D&apos;où viennent les offres</h2>
          <div className="mt-4">
            <Rows data={stats.sources} label="Offres actives par source" />
          </div>
        </section>
        <section className="rounded-[22px] border border-line bg-surface p-5">
          <h2 className="font-display text-xl font-bold">Comment l&apos;annuaire s&apos;est construit</h2>
          <div className="mt-4">
            <Rows data={stats.origins} label="Pages carrière par origine" />
          </div>
          <h2 className="mt-6 font-display text-xl font-bold">Ce que l&apos;IA en a pensé</h2>
          <div className="mt-4">
            <Rows data={stats.levels} label="Offres lues par niveau, tous profils confondus" />
          </div>
        </section>
      </div>

      <h2 className="mt-10 font-display text-2xl font-bold">Invitations</h2>
      <Invitations people={people} />

      <div className="mt-10">
        <CollectButton />
      </div>

      <h2 className="mt-10 font-display text-2xl font-bold">Santé des sources</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-muted">Aucune collecte pour l&apos;instant.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-[12px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Dernière collecte</th>
                <th className="px-4 py-3 text-right">Vues</th>
                <th className="px-4 py-3 text-right">Nouvelles</th>
                <th className="px-4 py-3 text-right">Archivées</th>
                <th className="px-4 py-3">État</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(({ source, last, prev }) => {
                const dropped = prev && prev.offers_seen > 10 && last.offers_seen < prev.offers_seen * 0.5;
                const state = last.errors ? `Erreur : ${last.error_sample ?? "inconnue"}` : last.offers_seen === 0 ? "Aucune offre" : dropped ? `Chute (${prev.offers_seen} → ${last.offers_seen})` : "OK";
                return (
                  <tr key={source}>
                    <td className="px-4 py-2.5 font-medium">{source}</td>
                    <td className="px-4 py-2.5 text-muted">{new Date(last.started_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{last.offers_seen}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{last.offers_new}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{last.offers_archived}</td>
                    <td className={`px-4 py-2.5 ${state === "OK" ? "text-success" : "text-warn"}`}>{state}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
