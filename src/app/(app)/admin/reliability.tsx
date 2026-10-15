"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LevelBadge } from "@/components/level-badge";
import type { CheckCandidate, CheckStats, Report } from "@/lib/admin/reliability";
import { LEVEL_LABELS, type Level } from "@/lib/domain/offer";

const FIELD_LABELS: Record<string, string> = { niveau: "Niveau ou raison", metier: "Pas le métier", experience: "Expérience", salaire: "Salaire", contrat: "Contrat", lieu: "Lieu ou télétravail", autre: "Autre" };
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

// Reliability measured: the admin checks the sort one offer at a time, and fixes what people flag.
export function Reliability({ next, stats, reports }: { next: CheckCandidate | null; stats: CheckStats; reports: Report[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(body: object) {
    setBusy(true);
    await fetch("/api/admin/reliability", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-[22px] border border-line bg-surface p-5">
        <h3 className="font-display text-lg font-bold">Contrôle du tri</h3>
        <p className="mt-1 text-sm text-muted">
          {stats.n >= 10
            ? `Tri juste dans ${pct(stats.right, stats.n)} % des ${stats.n} offres contrôlées (90 derniers jours).`
            : `Une offre tirée au hasard dans ta sélection : dis si Scout a vu juste. Le taux s'affiche à partir de 10 contrôles (${stats.n} pour l'instant).`}
        </p>
        {stats.n >= 10 && (
          <p className="mt-1 text-[13px] text-muted">{stats.byLevel.map((l) => `${LEVEL_LABELS[l.level as Level] ?? l.level} : ${l.right}/${l.n}`).join(" · ")}</p>
        )}
        {next ? (
          <div className="mt-4 rounded-2xl bg-pill-solid p-4">
            <LevelBadge level={next.level as Level} />
            <a href={next.url} target="_blank" rel="noreferrer" className="mt-2 block font-semibold hover:underline">
              {next.title}
            </a>
            <p className="text-[13px] text-muted">{next.company}</p>
            {next.why && <p className="mt-2 text-[14px] leading-relaxed">{next.why}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={() => post({ action: "check", offerId: next.offerId, level: next.level, right: true })} className="btn-soft">
                Juste
              </button>
              <button type="button" disabled={busy} onClick={() => post({ action: "check", offerId: next.offerId, level: next.level, right: false })} className="btn-soft">
                Faux
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Aucune offre à contrôler pour l&apos;instant.</p>
        )}
      </section>

      <section className="rounded-[22px] border border-line bg-surface p-5">
        <h3 className="font-display text-lg font-bold">Erreurs signalées · {reports.length}</h3>
        <p className="mt-1 text-sm text-muted">Ce que les utilisateurs disent faux dans une offre. Corrige la règle en cause, puis marque-le corrigé.</p>
        {reports.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Rien à corriger.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2.5">
                <span className="rounded-full bg-peach-soft px-2.5 py-0.5 text-[12.5px] font-semibold text-peach-ink">{FIELD_LABELS[r.field] ?? r.field}</span>
                <span className="min-w-0 flex-1">
                  <a href={r.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                    {r.title}
                  </a>
                  <span className="text-muted"> · {r.company}</span>
                  {r.comment && <span className="block text-[13px] text-muted">« {r.comment} »</span>}
                </span>
                <button type="button" disabled={busy} onClick={() => post({ action: "resolve", id: r.id })} className="btn-soft py-1.5">
                  Corrigé
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
