"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { hasMinimumCriteria, type Criteria, type CvSummary } from "@/lib/domain/criteria";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { CriteriaEditor } from "./criteria-editor";

type Props = {
  mode: "onboarding" | "edit";
  initialText?: string;
  initialCriteria?: Criteria | null;
  initialCvSummary?: CvSummary | null;
};

// One line proving the CV was read: education, experience, key skills.
function cvLine(cv: CvSummary) {
  const parts = [cv.education.slice(0, 1).join(""), cv.roles.slice(0, 2).join(", "), cv.skills.slice(0, 5).join(", ")].filter(Boolean);
  return parts.join(" · ");
}

// Shared by onboarding and "Ma recherche": free text (+ optional CV) → editable chips → saved.
export function SearchSetup({ mode, initialText = "", initialCriteria = null, initialCvSummary = null }: Props) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [cvText, setCvText] = useState<string | null>(null);
  const [cvName, setCvName] = useState<string | null>(null);
  const [criteria, setCriteria] = useState<Criteria | null>(initialCriteria);
  const [cvSummary, setCvSummary] = useState<CvSummary | null | undefined>(undefined);
  const shownCv = cvSummary ?? initialCvSummary;
  const [busy, setBusy] = useState<"cv" | "interpret" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setError(null);
    setBusy("cv");
    try {
      const extracted = await extractTextFromPdf(file);
      if (extracted.trim().length < 40) throw new Error("empty");
      setCvText(extracted);
      setCvName(file.name);
    } catch {
      setError("Ce PDF ne se lit pas bien (souvent un CV en image). Tu peux continuer sans, ou essayer une autre version.");
    } finally {
      setBusy(null);
    }
  }

  async function interpret() {
    setError(null);
    setBusy("interpret");
    const res = await fetch("/api/profile/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, cvText: cvText ?? undefined }),
    }).catch(() => null);
    setBusy(null);
    if (!res) return setError("Connexion perdue. Vérifie ta connexion et réessaie.");
    const data = await res.json().catch(() => null);
    if (!res.ok) return setError(data?.error ?? "L'analyse n'a pas abouti, réessaie dans un instant.");
    setCriteria(data.criteria);
    if (data.cvSummary) setCvSummary(data.cvSummary);
  }

  async function save() {
    if (!criteria) return;
    setError(null);
    setBusy("save");
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria, searchText: text, ...(cvSummary !== undefined ? { cvSummary } : {}) }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setBusy(null);
      return setError(data?.error ?? "Enregistrement impossible, réessaie.");
    }
    router.push("/offres");
    router.refresh();
  }

  const ready = criteria && hasMinimumCriteria(criteria);

  return (
    <div className="space-y-6">
      <section className="rounded-[22px] border border-line bg-surface p-5 md:p-6">
        <label htmlFor="search-text" className="font-display text-xl font-bold tracking-tight">
          {mode === "onboarding" ? "Dis-moi ce que tu cherches, avec tes mots" : "Redis-le avec tes mots"}
        </label>
        <p className="mt-1 text-sm text-muted">Le métier, le lieu, ce qui te plaît, ce que tu veux éviter, où tu en es. Quelques phrases suffisent.</p>
        <textarea
          id="search-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Ex. Je termine mes études et je cherche un premier poste en marketing digital à Lyon, ou en télétravail. J'aimerais une entreprise à impact, et j'évite la grande distribution."
          className="mt-4 w-full resize-y rounded-2xl border border-line bg-pill-solid p-4 text-[15px] leading-relaxed placeholder:text-muted focus:border-ink focus:outline-none"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy !== null} className="rounded-xl border border-line bg-pill px-4 py-2.5 text-sm font-medium hover:border-ink">
            {busy === "cv" ? "Lecture du CV…" : cvName ? `CV : ${cvName}` : "Ajouter mon CV (PDF, facultatif)"}
          </button>
          <button
            type="button"
            onClick={interpret}
            disabled={busy !== null || (!text.trim() && !cvText)}
            className="rounded-xl bg-button px-5 py-2.5 text-sm font-semibold text-button-ink disabled:opacity-40"
          >
            {busy === "interpret" ? "Analyse en cours…" : criteria ? "Réanalyser" : "Analyser ma recherche"}
          </button>
        </div>

        <p className="mt-4 rounded-xl bg-pill-solid px-4 py-3 text-[13px] leading-relaxed text-muted">
          <span className="font-semibold text-ink">Ton nom et tes coordonnées ne sont jamais envoyés à l&apos;IA. </span>
          Ton CV est lu dans ton navigateur puis envoyé à Scout, qui en retire ton nom, ton email, ton téléphone et ton adresse avant de l&apos;analyser avec une IA (Mistral).
          Le CV lui-même n&apos;est pas conservé, seulement les compétences et l&apos;expérience qui en sont extraites.
        </p>
        {error && <p className="mt-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{error}</p>}
      </section>

      {busy === "interpret" && (
        <div role="status" className="flex items-center gap-4 rounded-[22px] border border-line bg-surface p-5">
          <span aria-hidden className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-brand" />
          <div>
            <p className="font-display text-lg font-bold tracking-tight">Scout lit ta recherche…</p>
            <p className="text-sm text-muted">{cvText ? "Il lit aussi ton CV, sans tes coordonnées. Compte une vingtaine de secondes." : "Compte une dizaine de secondes."}</p>
          </div>
        </div>
      )}

      {criteria && busy !== "interpret" && (
        <>
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Ce que j&apos;ai compris</h2>
            <p className="mt-1 text-sm text-muted">Ajuste ce qui ne va pas : chaque puce se retire d&apos;un clic, et on en ajoute avec Entrée.</p>
            {shownCv && cvLine(shownCv) && (
              <p className="mt-3 rounded-xl bg-pill-solid px-4 py-3 text-[14px] leading-relaxed">
                <span className="font-semibold">Depuis ton CV : </span>
                {cvLine(shownCv)}
              </p>
            )}
          </div>
          <CriteriaEditor value={criteria} onChange={setCriteria} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={!ready || busy !== null} className="rounded-xl bg-button px-6 py-3 text-[15px] font-semibold text-button-ink disabled:opacity-40">
              {busy === "save" ? "Enregistrement…" : mode === "onboarding" ? "C'est parti" : "Enregistrer"}
            </button>
            {!ready && <p className="text-sm text-muted">Il faut au moins un métier et un lieu.</p>}
            {ready && mode === "edit" && <p className="text-sm text-muted">Toutes les offres seront réévaluées avec ces critères.</p>}
          </div>
        </>
      )}
    </div>
  );
}
