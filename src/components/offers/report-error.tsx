"use client";

import { useState } from "react";

const FIELDS: [string, string][] = [
  ["niveau", "Le niveau ou la raison"],
  ["metier", "Ce n'est pas mon métier"],
  ["experience", "L'expérience demandée"],
  ["salaire", "Le salaire"],
  ["contrat", "Le contrat"],
  ["lieu", "Le lieu ou le télétravail"],
  ["autre", "Autre chose"],
];

// Scout must never show something false: anyone can say what is wrong, in two clicks. The admin sees
// it and fixes the rule behind it, for everyone.
export function ReportError({ offerId, demo }: { offerId: string; demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    if (!field) return;
    setState("sending");
    const res = await fetch(`/api/offers/${offerId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ field, comment }) }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  if (state === "sent") return <p className="mt-5 text-[13px] text-muted">Merci, c&apos;est noté : Scout corrigera la règle en cause, pour tout le monde.</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-5 text-[13px] text-muted underline-offset-2 hover:text-ink hover:underline">
        Une information est fausse ?
      </button>
    );
  if (demo) return <p className="mt-5 text-[13px] text-muted">Avec un compte, tu peux signaler ce qui est faux : Scout corrige la règle en cause.</p>;
  return (
    <section className="mt-5 rounded-2xl border border-line p-4">
      <h3 className="text-[14px] font-semibold">Qu&apos;est-ce qui est faux ?</h3>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {FIELDS.map(([key, label]) => (
          <button key={key} type="button" aria-pressed={field === key} onClick={() => setField(key)} className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${field === key ? "bg-button text-button-ink" : "bg-pill-solid text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))} placeholder="Ce qui est écrit dans l'offre (facultatif)" rows={2} className="mt-3 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[14px]" />
      <div className="mt-2 flex items-center gap-3">
        <button type="button" disabled={!field || state === "sending"} onClick={send} className="btn-soft disabled:opacity-50">
          {state === "sending" ? "Envoi…" : "Envoyer"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-muted hover:text-ink">
          Annuler
        </button>
        {state === "error" && <span className="text-[13px] text-peach-ink">Le signalement n&apos;est pas passé, réessaie.</span>}
      </div>
    </section>
  );
}
