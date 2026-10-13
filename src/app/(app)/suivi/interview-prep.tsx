"use client";

import { useEffect, useState } from "react";

type Prep = { presentation: string; questions: { question: string; preparer: string }[] };

// Once the interview is obtained: the self-introduction to say in two minutes, and the questions to
// prepare. Opened from the application's card, prepared on demand, kept.
export function InterviewPrep({ applicationId, demo }: { applicationId: string; demo: boolean }) {
  const [open, setOpen] = useState(false);
  const [prep, setPrep] = useState<Prep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function start() {
    setOpen(true);
    if (prep || demo) return;
    setError(null);
    const res = await fetch(`/api/applications/${applicationId}/prep`, { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) return setError(data?.error ?? "La préparation n'a pas abouti, réessaie.");
    setPrep(data);
  }

  return (
    <>
      <button type="button" onClick={start} className="mt-2 w-full rounded-xl bg-surface/80 px-3 py-2 text-left text-[13px] font-semibold text-[var(--accent)] hover:bg-surface">
        Préparer mon entretien →
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Préparer mon entretien" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[22px] bg-surface p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-display text-xl font-bold">Préparer mon entretien</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn-soft py-1.5 text-[13px]">
                Fermer
              </button>
            </div>
            {demo ? (
              <p className="mt-3 text-[14.5px] text-muted">Avec un compte : ta réponse à « Présentez-vous », à dire en deux minutes, tirée de ton CV et du poste, et les questions probables avec ce qu&apos;il faut préparer.</p>
            ) : error ? (
              <p className="mt-3 text-[14px] text-warn">{error}</p>
            ) : !prep ? (
              <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted">
                <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
                Scout prépare ta présentation et les questions, une quinzaine de secondes.
              </p>
            ) : (
              <>
                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[13px] font-semibold text-muted">« Présentez-vous », en deux minutes</h3>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(prep.presentation).then(() => setCopied(true), () => null)} className="btn-soft py-1.5 text-[13px]">
                      {copied ? "Copié" : "Copier"}
                    </button>
                  </div>
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-pill-solid p-4 text-[14.5px] leading-relaxed">{prep.presentation}</p>
                  <p className="mt-1.5 text-[12.5px] text-muted">Un point de départ : dis-la avec tes mots, à voix haute, deux ou trois fois.</p>
                </div>
                {prep.questions.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-[13px] font-semibold text-muted">Les questions à préparer</h3>
                    <ol className="mt-2 space-y-3">
                      {prep.questions.map((q, i) => (
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
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
