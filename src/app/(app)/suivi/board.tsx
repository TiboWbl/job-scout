"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { followUpDue, isUpcoming, STAGE_LABELS, STAGES, type Application, type Stage } from "@/lib/domain/application";
import { tintStyle } from "@/lib/design/color";
import { shortDate } from "@/lib/format";
import { AddOffer } from "@/components/add-offer";
import { CompanyLogo } from "@/components/company-logo";
import { ArrowIcon } from "@/components/icons";

import type { BoardItem } from "@/lib/views/board";
type Patch = Partial<Pick<Application, "stage" | "notes" | "contact" | "applied_at" | "interview_at" | "followed_up_at">>;

// Refused and archived share the last column: presented soberly, never front and centre.
const COLUMNS: { title: string; stages: Stage[] }[] = [
  { title: "À postuler", stages: ["a_postuler"] },
  { title: "Postulé", stages: ["postule"] },
  { title: "Entretien", stages: ["entretien"] },
  { title: "Offre", stages: ["offre"] },
  { title: "Refusé ou archivé", stages: ["refuse", "archive"] },
];

// <input type="date|datetime-local"> speaks local time without zone; the API stores ISO instants.
const toInput = (iso: string | null, withTime: boolean) => {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString();
  return withTime ? local.slice(0, 16) : local.slice(0, 10);
};
const fromInput = (value: string) => (value ? new Date(value).toISOString() : null);
const when = (iso: string) => new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// demo: moves and notes work during the visit, nothing is saved; adding an offer is explained instead.
export function Board({ items: initial, demo = false, base = "" }: { items: BoardItem[]; demo?: boolean; base?: string }) {
  const [items, setItems] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [demoNote, setDemoNote] = useState(false);

  async function patch(id: string, body: Patch) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...body } : i)));
    if (demo) return;
    await fetch(`/api/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (demo) return;
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
  }

  const sent = items.filter((i) => i.stage !== "a_postuler").length;
  const interviews = items.filter((i) => i.stage === "entretien" || i.stage === "offre").length;

  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight">Suivi</h1>
          <p className="mt-2 text-[15px] text-muted">
            {items.length === 0
              ? "Tes candidatures vivent ici, celles de Scout comme celles trouvées ailleurs."
              : `${sent} candidature${sent > 1 ? "s" : ""} envoyée${sent > 1 ? "s" : ""}${interviews ? `, ${interviews} en entretien ou plus loin` : ""}. Continue comme ça.`}
          </p>
        </div>
        <button type="button" onClick={() => (demo ? setDemoNote(true) : setAdding(true))} className="rounded-xl bg-button px-4 py-2.5 text-sm font-semibold text-button-ink">
          Ajouter une offre trouvée ailleurs
        </button>
      </div>
      {demoNote && (
        <p role="status" className="mt-4 max-w-2xl rounded-2xl bg-violet-soft px-4 py-3 text-sm text-violet-ink">
          Désactivé en démo. Dans ton compte, tu colles l&apos;adresse d&apos;une offre vue sur WTTJ ou LinkedIn : Scout la lit, te dit s&apos;il la connaissait déjà, la juge pour ton profil et l&apos;ajoute ici.
        </p>
      )}

      {items.length === 0 ? (
        <div className="mt-8 flex flex-wrap items-center gap-3 text-[15px] text-muted">
          Rien pour l&apos;instant : postule depuis tes offres, ou ajoute une offre vue ailleurs.
          <Link href={`${base}/offres`} className="btn-soft">
            Voir mes offres
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 overflow-x-auto pb-2 md:grid-cols-5">
          {COLUMNS.map((col) => {
            const cards = items.filter((i) => col.stages.includes(i.stage));
            return (
              <section key={col.title} className="min-w-[230px]">
                <h2 className="mb-3 flex items-baseline gap-2 font-display text-lg font-bold">
                  {col.title}
                  <span className="text-sm font-medium text-muted">{cards.length}</span>
                </h2>
                <div className="space-y-3">
                  {cards.map((card) => (
                    <Card key={card.id} item={card} onPatch={(b) => patch(card.id, b)} onRemove={() => remove(card.id)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {adding && (
        <AddOffer
          onClose={() => {
            setAdding(false);
            // The server list includes what was just added.
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

function Card({ item, onPatch, onRemove }: { item: BoardItem; onPatch: (b: Patch) => void; onRemove: () => void }) {
  const style = useMemo(() => tintStyle(item.accent), [item.accent]);
  const [notes, setNotes] = useState(item.notes);
  const [contact, setContact] = useState(item.contact);
  const [open, setOpen] = useState(false);
  const due = followUpDue(item);
  const upcoming = isUpcoming(item.interview_at);

  return (
    <article style={style} className="tinted rounded-[20px] border border-line p-4">
      <div className="flex items-center gap-3">
        <CompanyLogo name={item.company} domain={item.domain} brand={item.brand} size={34} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.company}</p>
          <p className="text-[12.5px] text-muted">
            {item.applied_at ? `Postulé le ${shortDate(item.applied_at)}` : item.origin === "added" ? "Ajoutée par toi" : "Repérée par Scout"}
          </p>
        </div>
      </div>
      <h3 className="mt-3 font-display text-base font-bold leading-tight">{item.title}</h3>

      {upcoming && <p className="mt-2 rounded-xl bg-surface/80 px-3 py-2 text-[13px] font-medium">Entretien {when(item.interview_at!)}</p>}
      {due && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-surface/80 px-3 py-2 text-[13px]">
          <span>Une relance peut aider.</span>
          <button type="button" onClick={() => onPatch({ followed_up_at: new Date().toISOString() })} className="font-semibold text-[var(--accent)]">
            J&apos;ai relancé
          </button>
        </div>
      )}

      <select value={item.stage} onChange={(e) => onPatch({ stage: e.target.value as Stage })} aria-label="Étape" className="mt-3 w-full rounded-xl border border-line bg-pill px-3 py-2 text-sm">
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABELS[s]}
          </option>
        ))}
      </select>

      {open ? (
        <div className="mt-3 space-y-2.5 text-[13px]">
          <label className="block">
            <span className="text-muted">Contact</span>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              onBlur={() => contact !== item.contact && onPatch({ contact })}
              placeholder="Nom, rôle, email…"
              className="mt-1 w-full rounded-xl border border-line bg-pill px-2.5 py-2 text-sm placeholder:text-muted"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-muted">Candidature</span>
              <input type="date" value={toInput(item.applied_at, false)} onChange={(e) => onPatch({ applied_at: fromInput(e.target.value) })} className="mt-1 w-full rounded-xl border border-line bg-pill px-2 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-muted">Entretien</span>
              <input type="datetime-local" value={toInput(item.interview_at, true)} onChange={(e) => onPatch({ interview_at: fromInput(e.target.value) })} className="mt-1 w-full rounded-xl border border-line bg-pill px-2 py-2 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-muted">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes !== item.notes && onPatch({ notes })}
              rows={3}
              placeholder="Prochaine étape, impressions…"
              className="mt-1 w-full rounded-xl border border-line bg-pill p-2.5 text-sm placeholder:text-muted"
            />
          </label>
          <div className="flex items-center justify-between">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-[var(--accent)]">
                Voir l&apos;offre <ArrowIcon className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span />
            )}
            <button type="button" onClick={onRemove} className="text-muted hover:text-ink">
              Retirer du suivi
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 text-[13px] font-medium text-muted hover:text-ink">
          {item.notes || item.contact ? "Détails, contact et notes" : "Ajouter contact, dates, notes"}
        </button>
      )}
    </article>
  );
}
