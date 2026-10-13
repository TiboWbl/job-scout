"use client";

import { useState } from "react";

type Part = "message" | "letter";
type Kit = { message?: string; letter?: string };
const LABELS: Record<Part, string> = { message: "Message de candidature", letter: "Lettre de motivation" };

// What to send when applying: the short message, or the cover letter when the offer asks for one.
// Each is prepared on demand and kept. In the demo, the block says what it does without a call.
export function ApplicationKit({ offerId, demo }: { offerId: string; demo: boolean }) {
  const [kit, setKit] = useState<Kit>({});
  const [shown, setShown] = useState<Part | null>(null);
  const [busy, setBusy] = useState<Part | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function open(part: Part) {
    setShown(part);
    setCopied(false);
    if (kit[part]) return;
    setBusy(part);
    setError(null);
    const res = await fetch(`/api/offers/${offerId}/kit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ part }) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(null);
    if (!res?.ok) return setError(data?.error ?? "La préparation n'a pas abouti, réessaie.");
    setKit(data);
  }

  const text = shown ? kit[shown] : null;
  return (
    <section className="mt-5 rounded-2xl bg-violet-soft p-4">
      <h3 className="font-display text-base font-bold text-violet-ink">Préparer ma candidature</h3>
      {demo ? (
        <p className="mt-1 text-[13.5px] text-violet-ink/80">Avec un compte : un message prêt à envoyer et, si l&apos;offre la demande, une lettre de motivation tirée de cette offre et de ton CV.</p>
      ) : (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {(Object.keys(LABELS) as Part[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => open(p)}
              disabled={busy !== null}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold disabled:opacity-60 ${shown === p ? "bg-button text-button-ink" : "bg-surface text-ink"}`}
            >
              {busy === p ? "Préparation…" : LABELS[p]}
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-warn">{error}</p>}
      {text && (
        <div className="mt-3">
          <p className="whitespace-pre-line rounded-xl bg-surface p-3.5 text-[14px] leading-relaxed">{text}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[12.5px] text-violet-ink/80">À relire et compléter là où c&apos;est écrit [à compléter].</p>
            <button type="button" onClick={() => navigator.clipboard?.writeText(text).then(() => setCopied(true), () => null)} className="btn-soft py-1.5 text-[13px]">
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
