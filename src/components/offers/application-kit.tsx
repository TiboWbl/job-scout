"use client";

import { useState } from "react";

type Kit = { message: string; questions: { question: string; preparer: string }[] };

// Ten minutes to apply well: a message that cites the offer, and the questions to prepare.
// Prepared on demand (one model call), kept for the next time.
export function ApplicationKit({ offerId, demo }: { offerId: string; demo: boolean }) {
  const [kit, setKit] = useState<Kit | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function prepare() {
    setState("busy");
    setError(null);
    const res = await fetch(`/api/offers/${offerId}/kit`, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(data?.error ?? "La préparation n'a pas abouti, réessaie.");
      return setState("error");
    }
    setKit(data);
    setState("idle");
  }

  if (!kit)
    return (
      <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-soft p-4">
        <span className="min-w-0">
          <span className="block font-display text-base font-bold text-violet-ink">Préparer ma candidature</span>
          <span className="block text-[13.5px] text-violet-ink/80">{demo ? "Disponible avec un compte : un message prêt à envoyer et les questions d'entretien probables." : "Un message prêt à envoyer et les questions d'entretien probables, tirés de cette offre."}</span>
          {error && <span className="mt-1 block text-[13px] text-warn">{error}</span>}
        </span>
        {!demo && (
          <button type="button" onClick={prepare} disabled={state === "busy"} className="rounded-xl bg-button px-4 py-2.5 text-sm font-semibold text-button-ink disabled:opacity-60">
            {state === "busy" ? "Préparation…" : "Préparer"}
          </button>
        )}
      </section>
    );

  return (
    <section className="mt-5 rounded-2xl border border-line p-4 md:p-5">
      <h3 className="font-display text-base font-bold">Ta candidature</h3>
      {kit.message && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-[13px] font-semibold text-muted">Message à envoyer, à relire et adapter</h4>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(kit.message).then(() => setCopied(true), () => null)}
              className="btn-soft py-1.5 text-[13px]"
            >
              {copied ? "Copié" : "Copier"}
            </button>
          </div>
          <p className="mt-2 whitespace-pre-line rounded-xl bg-pill-solid p-3.5 text-[14px] leading-relaxed">{kit.message}</p>
        </div>
      )}
      {kit.questions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[13px] font-semibold text-muted">Les questions à préparer</h4>
          <ol className="mt-2 space-y-2.5">
            {kit.questions.map((q, i) => (
              <li key={q.question} className="text-[14px] leading-relaxed">
                <span className="font-semibold">
                  {i + 1}. {q.question}
                </span>
                {q.preparer && <span className="block text-muted">{q.preparer}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
