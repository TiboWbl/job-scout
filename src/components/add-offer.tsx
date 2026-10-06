"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LEVEL_LABELS, type Level } from "@/lib/domain/offer";
import { CloseIcon } from "@/components/icons";

type Result = { diagnostic: { kind: "new" | "known" | "excluded"; text: string }; title: string; company: string; level: Level | null; why: string | null };

const STEPS = ["Scout lit l'offre…", "Il la compare à ce qu'il connaît déjà…", "Il la juge pour ta recherche…", "Il l'ajoute à ton suivi…"];

// Offers found on WTTJ, LinkedIn or elsewhere join the tracking, with what Scout knew about them.
export function AddOffer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [needText, setNeedText] = useState(false);
  const [applied, setApplied] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (step === null) return;
    const t = setTimeout(() => setStep((s) => (s === null ? s : Math.min(STEPS.length - 1, s + 1))), 4500);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setError(null);
    setStep(0);
    const res = await fetch("/api/offers/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url.trim() || undefined, text: needText ? text : undefined, applied }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setStep(null);
    if (!res?.ok) return setError(data?.error ?? "L'ajout n'a pas abouti, réessaie.");
    if (data.needText) return setNeedText(true);
    setResult(data as Result);
    router.refresh();
  }

  const busy = step !== null;
  const canSubmit = needText ? text.trim().length > 80 : /^https?:\/\//i.test(url.trim());

  return (
    <div role="dialog" aria-modal="true" aria-label="Ajouter une offre" onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-[#17151f]/45 p-4 backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg animate-rise rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl font-bold tracking-tight">Ajouter une offre trouvée ailleurs</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-pill-solid">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {result ? (
          <div className="mt-4">
            <p className={`rounded-2xl px-4 py-3 text-sm ${result.diagnostic.kind === "excluded" ? "bg-warn-soft text-warn" : "bg-brand-soft"}`}>{result.diagnostic.text}</p>
            <p className="mt-4 font-display text-lg font-bold leading-tight">{result.title}</p>
            <p className="text-sm text-muted">{result.company}</p>
            {result.level && (
              <p className="mt-3 text-sm">
                <span className="font-semibold">Pour ta recherche : {LEVEL_LABELS[result.level]}. </span>
                {result.why}
              </p>
            )}
            <p className="mt-3 text-sm text-muted">Elle est dans ton suivi, colonne « {applied ? "Postulé" : "À postuler"} ».</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onClose} className="rounded-xl bg-button px-5 py-2.5 text-sm font-semibold text-button-ink">
                Voir mon suivi
              </button>
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setUrl("");
                  setText("");
                  setNeedText(false);
                }}
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium"
              >
                En ajouter une autre
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium">
              Adresse de l&apos;offre
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.welcometothejungle.com/fr/companies/…"
                disabled={busy}
                className="mt-1.5 w-full rounded-xl border border-line bg-pill-solid px-3.5 py-2.5 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
              />
            </label>
            {needText ? (
              <label className="block text-sm font-medium">
                <span className="mb-1.5 block font-normal text-muted">Cette page ne se laisse pas lire (c&apos;est souvent le cas de LinkedIn). Copie tout le texte de l&apos;offre et colle-le ici.</span>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={7}
                  disabled={busy}
                  className="w-full rounded-xl border border-line bg-pill-solid p-3 text-sm focus:border-ink focus:outline-none"
                />
              </label>
            ) : (
              <button type="button" onClick={() => setNeedText(true)} className="text-[13px] text-muted underline underline-offset-4 hover:text-ink">
                Pas d&apos;adresse ? Coller le texte de l&apos;offre
              </button>
            )}
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={applied} onChange={(e) => setApplied(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
              J&apos;ai déjà postulé
            </label>
            {error && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{error}</p>}
            {busy ? (
              <p role="status" className="flex items-center gap-2.5 rounded-2xl bg-brand-soft px-4 py-3 text-sm font-medium">
                <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
                {STEPS[step]}
              </p>
            ) : (
              <button type="button" onClick={submit} disabled={!canSubmit} className="rounded-xl bg-button px-5 py-2.5 text-sm font-semibold text-button-ink disabled:opacity-40">
                Ajouter à mon suivi
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
