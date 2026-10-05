"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STAGE_LABELS, STAGES, type Application, type Stage } from "@/lib/domain/application";
import { tintStyle } from "@/lib/design/color";
import { shortDate } from "@/lib/format";
import { CompanyLogo } from "@/components/company-logo";
import { ArrowIcon } from "@/components/icons";

export type BoardItem = Application & { domain: string | null; accent: string | null };

// Refused and archived share the last column: presented soberly, never front and centre.
const COLUMNS: { title: string; stages: Stage[] }[] = [
  { title: "À postuler", stages: ["a_postuler"] },
  { title: "Postulé", stages: ["postule"] },
  { title: "Entretien", stages: ["entretien"] },
  { title: "Offre", stages: ["offre"] },
  { title: "Refusé ou archivé", stages: ["refuse", "archive"] },
];

export function Board({ items: initial }: { items: BoardItem[] }) {
  const [items, setItems] = useState(initial);

  async function patch(id: string, body: Partial<Pick<Application, "stage" | "notes">>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...body } : i)));
    await fetch(`/api/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
  }

  const sent = items.filter((i) => i.stage !== "a_postuler").length;
  const interviews = items.filter((i) => i.stage === "entretien" || i.stage === "offre").length;

  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Suivi</h1>
      <p className="mt-2 text-[15px] text-muted">
        {items.length === 0
          ? "Quand tu postules depuis une offre, Scout te propose de l'ajouter ici."
          : `${sent} candidature${sent > 1 ? "s" : ""} envoyée${sent > 1 ? "s" : ""}${interviews ? `, ${interviews} en entretien ou plus loin` : ""}. Continue comme ça.`}
      </p>

      {items.length === 0 ? (
        <Link href="/offres" className="mt-8 inline-block rounded-xl bg-button px-4 py-2.5 text-sm font-semibold text-button-ink">
          Voir mes offres
        </Link>
      ) : (
        <div className="mt-8 grid gap-4 overflow-x-auto pb-2 md:grid-cols-5">
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
    </div>
  );
}

function Card({ item, onPatch, onRemove }: { item: BoardItem; onPatch: (b: Partial<Pick<Application, "stage" | "notes">>) => void; onRemove: () => void }) {
  const style = useMemo(() => tintStyle(item.accent), [item.accent]);
  const [notes, setNotes] = useState(item.notes);
  const [open, setOpen] = useState(false);

  return (
    <article style={style} className="tinted rounded-[20px] border border-line p-4">
      <div className="flex items-center gap-3">
        <CompanyLogo name={item.company} domain={item.domain} size={34} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.company}</p>
          {item.applied_at && <p className="text-[12.5px] text-muted">Postulé le {shortDate(item.applied_at)}</p>}
        </div>
      </div>
      <h3 className="mt-3 font-display text-base font-bold leading-tight">{item.title}</h3>
      <select
        value={item.stage}
        onChange={(e) => onPatch({ stage: e.target.value as Stage })}
        aria-label="Étape"
        className="mt-3 w-full rounded-xl border border-line bg-pill px-3 py-2 text-sm"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>{STAGE_LABELS[s]}</option>
        ))}
      </select>
      {open ? (
        <div className="mt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== item.notes && onPatch({ notes })}
            rows={3}
            placeholder="Contact, prochaine étape, impressions…"
            aria-label="Notes"
            className="w-full rounded-xl border border-line bg-pill p-2.5 text-sm placeholder:text-muted"
          />
          <div className="mt-2 flex items-center justify-between text-[13px]">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 font-medium text-[var(--accent)]">
                Voir l&apos;offre <ArrowIcon className="h-3.5 w-3.5" />
              </a>
            ) : <span />}
            <button type="button" onClick={onRemove} className="text-muted hover:text-ink">Retirer du suivi</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="mt-2 text-[13px] font-medium text-muted hover:text-ink">
          {item.notes ? "Notes et détails" : "Ajouter une note"}
        </button>
      )}
    </article>
  );
}
