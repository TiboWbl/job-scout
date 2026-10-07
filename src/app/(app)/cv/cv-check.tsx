"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AtsResult } from "@/lib/cv/ats";
import type { Skill } from "@/lib/scoring/judge";
import type { SkillStat } from "@/lib/views/skills";
import type { Level } from "@/lib/domain/offer";
import { LevelBadge } from "@/components/level-badge";
import { readCv } from "@/lib/cv/extract";
import { createClient } from "@/lib/supabase/browser";
import { TrashIcon } from "@/components/icons";

export type HistoryRow = { id: string; created_at: string; filename: string; total: number; result: AtsResult | null; suggestions: Suggestion[]; comparison: Comparison | null; recruiter: Recruiter | null };
export type OfferOption = { id: string; title: string; company: string; place: string | null; level: Level; tracked: boolean };
type Suggestion = { ligne: string; proposition: string; pourquoi?: string | null };
type Comparison = { title: string; company: string; score: number; present: string[]; missing: string[]; tips: string[] };
type Recruiter = { target: string; avis: string; atouts: { point: string; citation: string }[]; manques: { point: string; citation: string | null }[]; conseils: string[] };
// `text` exists only right after an analysis: the CV is never stored, so a saved one has no ATS view.
type Analysis = { id: string | null; createdAt: string | null; filename: string; result: AtsResult; suggestions: Suggestion[]; comparison: Comparison | null; recruiter: Recruiter | null; text: string | null };

const tone = (ratio: number) => (ratio >= 0.8 ? "bg-success" : ratio >= 0.5 ? "bg-brand" : "bg-warn");
const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

export function CvCheck({ history, offers, initialOfferId, demand, hasCv }: { history: HistoryRow[]; offers: OfferOption[]; initialOfferId: string | null; demand: { read: number; byKind: Record<Skill["kind"], SkillStat[]> }; hasCv: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [offerId, setOfferId] = useState(initialOfferId && offers.some((o) => o.id === initialOfferId) ? initialOfferId : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [rows, setRows] = useState(history);
  // Fresh server data (after a refresh) replaces the list kept in memory.
  const [lastHistory, setLastHistory] = useState(history);
  if (lastHistory !== history) {
    setLastHistory(history);
    setRows(history);
  }

  function openSaved(h: HistoryRow) {
    if (!h.result) return;
    setAnalysis({ id: h.id, createdAt: h.created_at, filename: h.filename, result: h.result, suggestions: h.suggestions ?? [], comparison: h.comparison, recruiter: h.recruiter ?? null, text: null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function removeSaved(id: string) {
    setRows((r) => r.filter((h) => h.id !== id));
    if (analysis?.id === id) setAnalysis(null);
    await createClient().from("cv_analyses").delete().eq("id", id);
    router.refresh();
  }

  // The PDF is shown from the browser's memory, next to what an ATS reads; it is never uploaded.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL tied to the chosen file
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function analyse(chosen = file) {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const { text, layout } = await readCv(chosen);
      const res = await fetch("/api/cv/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, layout, filename: chosen.name, sizeBytes: chosen.size, ...(offerId ? { offerId } : {}) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "L'analyse n'a pas abouti, réessaie.");
      setAnalysis({ ...data, filename: chosen.name, text });
      setRows((r) => [{ id: data.id, created_at: data.createdAt, filename: chosen.name, total: data.result.total, result: data.result, suggestions: data.suggestions, comparison: data.comparison, recruiter: data.recruiter }, ...r].filter((h) => h.id));
      // The page kept in the browser cache must list this analysis when the person comes back.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Ce PDF ne se lit pas bien. Essaie une autre version.");
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Mon CV</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">
        Deux lectures de ton CV. Le test ATS vérifie qu&apos;un logiciel de recrutement le lit bien : une note sur 100 où chaque point a une raison. La lecture recruteur dit ce qui convainc et ce qui manque pour ton métier, ou pour une offre que tu choisis.
      </p>

      <section className="mt-6 rounded-[22px] bg-brand-soft/50 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              // Choosing the file does not start the analysis: an offer to compare with can be picked first.
              setFile(e.target.files?.[0] ?? null);
              setAnalysis(null);
              e.target.value = "";
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={file ? "btn-soft" : "rounded-xl bg-button px-5 py-2.5 text-sm font-semibold text-button-ink disabled:opacity-50"}>
            {file ? `CV : ${file.name}` : "Choisir mon CV (PDF)"}
          </button>
          {file && (
            <button type="button" onClick={() => analyse()} disabled={busy} className="rounded-xl bg-button px-5 py-2.5 text-sm font-semibold text-button-ink disabled:opacity-50">
              {busy ? "Analyse en cours…" : analysis ? "Relancer l'analyse" : "Analyser mon CV"}
            </button>
          )}
        </div>
        {offers.length > 0 && <OfferPicker offers={offers} value={offerId} onChange={setOfferId} />}
        <p className="mt-3 text-[13px] text-muted">Le PDF est lu dans ton navigateur. Ton nom et tes coordonnées ne sont jamais envoyés à l&apos;IA, et le texte du CV n&apos;est pas conservé : seule la note l&apos;est.</p>
        {error && <p className="mt-3 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{error}</p>}
      </section>

      {busy && (
        <p role="status" className="mt-6 flex items-center gap-3 text-sm text-muted">
          <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
          Scout lit ton CV comme un ATS, puis comme un recruteur pour le poste visé. Compte une vingtaine de secondes.
        </p>
      )}

      {analysis && !busy && <Results analysis={analysis} pdfUrl={pdfUrl} />}

      <Demand demand={demand} hasCv={hasCv} />

      {rows.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold">Tes analyses</h2>
          <p className="mt-1 text-sm text-muted">Clique sur une analyse pour la relire. Seuls le nom du fichier et l&apos;analyse sont gardés, jamais ton CV.</p>
          <ul className="mt-4 space-y-2">
            {rows.map((h) => (
              // The whole row reacts (and grows a little): it is one thing to open.
              <li
                key={h.id}
                className={`group flex items-center gap-2 rounded-2xl border bg-surface p-2 transition-transform duration-150 hover:scale-[1.01] hover:border-ink hover:shadow-md ${analysis?.id === h.id ? "border-ink" : "border-line"}`}
              >
                <button type="button" onClick={() => openSaved(h)} disabled={!h.result} className="grid min-w-0 flex-1 grid-cols-[6.5rem_minmax(0,1fr)_7rem_2.5rem] items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm disabled:cursor-default">
                  <span className="text-muted">{date(h.created_at)}</span>
                  <span className="truncate font-medium">{h.filename || "CV"}</span>
                  <span className="h-2.5 overflow-hidden rounded-full bg-pill-solid">
                    <span className={`block h-full rounded-full ${tone(h.total / 100)}`} style={{ width: `${h.total}%` }} />
                  </span>
                  <span className="text-right font-semibold tabular-nums">{h.total}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeSaved(h.id)}
                  aria-label={`Supprimer l'analyse du ${date(h.created_at)}`}
                  title="Supprimer cette analyse"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#d14343] hover:bg-[#d14343]/10"
                >
                  <TrashIcon className="h-[18px] w-[18px]" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Results({ analysis, pdfUrl }: { analysis: Analysis; pdfUrl: string | null }) {
  const { result, suggestions, comparison, recruiter, text } = analysis;
  return (
    <div className="mt-8 space-y-6">
      <p className="text-sm text-muted">
        {analysis.filename || "Ton CV"}
        {analysis.createdAt ? ` · analysé le ${date(analysis.createdAt)}` : ""}
      </p>
      <p className="rounded-2xl bg-pill-solid px-4 py-3 text-[14px]">
        {result.total >= 85
          ? "Ton CV passe bien les logiciels de recrutement. Pour savoir s'il convainc, lis la lecture recruteur : rien n'est obligatoire, garde ce qui te ressemble."
          : "Ce sont des recommandations, pas des obligations : commence par ce qui rapporte le plus de points, et garde ce qui te ressemble."}
      </p>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-[14rem_1fr]">
        <div className="rounded-[22px] bg-violet-soft p-6 text-violet-ink">
          <p className="font-display text-6xl font-extrabold tabular-nums">{result.total}</p>
          <p className="text-sm">sur 100, test ATS</p>
        </div>
        <div className="space-y-3 rounded-[22px] border border-line bg-surface p-5">
          {result.categories.map((c) => (
            <div key={c.key} className="grid grid-cols-[minmax(0,11rem)_1fr_4rem] items-center gap-3 text-sm">
              <span className="font-medium">{c.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-pill-solid">
                <span className={`block h-full rounded-full ${tone(c.score / c.max)}`} style={{ width: `${(100 * c.score) / c.max}%` }} />
              </span>
              <span className="text-right tabular-nums text-muted">
                {c.score}/{c.max}
              </span>
            </div>
          ))}
        </div>
      </section>

      {recruiter && (recruiter.avis || recruiter.atouts.length > 0) && (
        <section className="rounded-[22px] border border-line bg-surface p-5 md:p-6">
          <h2 className="font-display text-xl font-bold">Lecture recruteur</h2>
          <p className="mt-1 text-sm text-muted">Pour « {recruiter.target} ». Chaque atout cite ton CV{comparison ? ", chaque manque cite l'offre" : ""}.</p>
          {recruiter.avis && <p className="mt-4 text-[15px] leading-relaxed">{recruiter.avis}</p>}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {recruiter.atouts.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-muted">Ce qui convainc</h3>
                <ul className="mt-2 space-y-2.5">
                  {recruiter.atouts.map((a) => (
                    <li key={a.point} className="flex gap-2.5 text-[14px] leading-snug">
                      <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-soft text-[11px] font-bold text-mint-ink">✓</span>
                      <span>
                        {a.point}
                        <span className="mt-0.5 block text-[13px] italic text-muted">« {a.citation} »</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {recruiter.manques.length > 0 && (
              <div>
                <h3 className="text-[13px] font-semibold text-muted">Ce qui manque</h3>
                <ul className="mt-2 space-y-2.5">
                  {recruiter.manques.map((m) => (
                    <li key={m.point} className="flex gap-2.5 text-[14px] leading-snug">
                      <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-peach-soft text-[11px] font-bold text-peach-ink">!</span>
                      <span>
                        {m.point}
                        {m.citation && <span className="mt-0.5 block text-[13px] italic text-muted">L&apos;offre : « {m.citation} »</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {recruiter.conseils.length > 0 && (
            <div className="mt-5">
              <h3 className="text-[13px] font-semibold text-muted">Pour personnaliser ton CV</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[14.5px]">{recruiter.conseils.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
          )}
          <p className="mt-4 text-[13px] text-muted">N&apos;ajoute que ce qui correspond vraiment à ton expérience.</p>
        </section>
      )}

      {comparison && (
        <section className="rounded-[22px] border border-line bg-surface p-5 md:p-6">
          <h2 className="font-display text-xl font-bold">
            Mots-clés de l&apos;offre « {comparison.title} »{comparison.company ? ` · ${comparison.company}` : ""}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {comparison.score} % des mots-clés de l&apos;offre se retrouvent tels quels dans ton CV : c&apos;est ce qu&apos;un ATS compare.
          </p>
          {comparison.missing.length > 0 && (
            <div className="mt-4">
              <h3 className="text-[13px] font-semibold text-muted">Absents de ton CV</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {comparison.missing.map((k) => (
                  <span key={k} className="rounded-full bg-peach-soft px-3 py-1 text-[13px] font-medium text-peach-ink">{k}</span>
                ))}
              </div>
            </div>
          )}
          {comparison.present.length > 0 && (
            <div className="mt-3">
              <h3 className="text-[13px] font-semibold text-muted">Déjà présents</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {comparison.present.map((k) => (
                  <span key={k} className="rounded-full bg-mint-soft px-3 py-1 text-[13px] font-medium text-mint-ink">{k}</span>
                ))}
              </div>
            </div>
          )}
          {comparison.tips.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-[14.5px]">{comparison.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          )}
          {!recruiter && <p className="mt-3 text-[13px] text-muted">N&apos;ajoute que ce qui correspond vraiment à ton expérience.</p>}
        </section>
      )}

      {(() => {
        const strengths = result.categories.flatMap((c) => c.checks).filter((k) => k.ok && k.good);
        return strengths.length > 0 ? (
          <section className="rounded-[22px] border border-line bg-surface p-5 md:p-6">
            <h2 className="font-display text-xl font-bold">Ce qui fonctionne déjà</h2>
            <p className="mt-1 text-sm text-muted">Pourquoi ton CV passe bien les logiciels de recrutement et retient l&apos;attention d&apos;un recruteur.</p>
            <ul className="mt-4 grid grid-cols-1 gap-2 lg:grid-cols-2">
              {strengths.map((k) => (
                <li key={k.label} className="flex gap-2.5 text-[14px] leading-snug">
                  <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-mint-soft text-[11px] font-bold text-mint-ink">✓</span>
                  <span>{k.good}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })()}

      {result.categories.some((c) => c.checks.some((k) => !k.ok)) && (
      <section className="rounded-[22px] border border-line bg-surface p-5 md:p-6">
        <h2 className="font-display text-xl font-bold">Ce que tu peux encore améliorer</h2>
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {result.categories.filter((c) => c.checks.some((k) => !k.ok)).map((c) => (
            <div key={c.key}>
              <h3 className="text-[13px] font-semibold text-muted">
                {c.label} · {c.score}/{c.max}
              </h3>
              <ul className="mt-2 space-y-2">
                {c.checks.filter((k) => !k.ok).map((k) => (
                  <li key={k.label} className="flex gap-2.5 text-[14px] leading-snug">
                    <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${k.ok ? "bg-mint-soft text-mint-ink" : "bg-peach-soft text-peach-ink"}`}>
                      {k.ok ? "✓" : "!"}
                    </span>
                    <span>
                      <span className="font-medium">{k.label}</span>
                      {!k.ok && (
                        <>
                          <span className="block text-muted">
                            {k.fix} <span className="whitespace-nowrap">({k.points}/{k.max})</span>
                          </span>
                          {k.why && <span className="mt-1 block text-[13px] italic text-muted">Pourquoi : {k.why}</span>}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      )}

      {suggestions.length > 0 && (
        <section className="rounded-[22px] border border-line bg-surface p-5 md:p-6">
          <h2 className="font-display text-xl font-bold">Lignes à renforcer</h2>
          <ul className="mt-4 space-y-4">
            {suggestions.map((s) => (
              <li key={s.ligne} className="text-[14px]">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <p className="rounded-xl bg-pill-solid p-3 text-muted">{s.ligne}</p>
                  <p className="rounded-xl bg-mint-soft p-3 text-mint-ink">{s.proposition}</p>
                </div>
                {s.pourquoi && <p className="mt-1.5 text-[13px] italic text-muted">Pourquoi : {s.pourquoi}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] text-muted">Remplace [chiffre] par tes vrais résultats.</p>
        </section>
      )}

      {text !== null && (
      <section className="rounded-[22px] border border-line bg-surface p-5 md:p-6">
        <h2 className="font-display text-xl font-bold">Ce que voit un ATS</h2>
        <p className="mt-1 text-sm text-muted">À gauche ton CV, à droite le texte qu&apos;un logiciel de recrutement en extrait, dans l&apos;ordre où il le lit. Des blocs mélangés ou manquants à droite sont à corriger.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {pdfUrl && <iframe src={pdfUrl} title="Ton CV" className="h-[640px] w-full rounded-xl border border-line bg-white" />}
          <pre className="h-[640px] overflow-auto whitespace-pre-wrap rounded-xl bg-pill-solid p-4 font-sans text-[13px] leading-relaxed">{text || "Aucun texte extrait."}</pre>
        </div>
      </section>
      )}
    </div>
  );
}

const foldText = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Comparing with an offer: any offer of the selection, found by title or company, shown with enough to
// recognise it (company, place, level). Those in the tracking come first.
function OfferPicker({ offers, value, onChange }: { offers: OfferOption[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // A click beside the search, or Escape, closes it.
  useEffect(() => {
    if (!listOpen) return;
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) {
        setListOpen(false);
        setPicking(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setListOpen(false);
        setPicking(false);
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", onKey);
    };
  }, [listOpen]);
  const chosen = offers.find((o) => o.id === value) ?? null;
  const q = foldText(query.trim());
  const shown = (q ? offers.filter((o) => foldText(`${o.title} ${o.company}`).includes(q)) : offers).slice(0, 8);
  const line = (o: OfferOption) => (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">{o.title}</span>
      <span className="block truncate text-[12.5px] text-muted">
        {o.company}
        {o.place ? ` · ${o.place}` : ""}
        {o.tracked ? " · dans ton suivi" : ""}
      </span>
    </span>
  );

  return (
    <div className="mt-4">
      <p className="text-sm font-semibold">Cibler une offre <span className="font-normal text-muted">(facultatif, sinon la lecture se fait pour ton métier)</span></p>
      {chosen && !picking ? (
        <div className="mt-2 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-sm">
          {line(chosen)}
          <LevelBadge level={chosen.level} />
          <button
            type="button"
            onClick={() => {
              setPicking(true);
              setListOpen(true);
            }}
            className="btn-soft shrink-0"
          >
            Changer
          </button>
          <button type="button" onClick={() => onChange("")} className="btn-soft shrink-0">
            Aucune
          </button>
        </div>
      ) : (
        <div ref={box} className="mt-2 rounded-2xl border border-line bg-surface p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setListOpen(true)}
            placeholder={`Chercher parmi tes ${offers.length} offres : intitulé ou entreprise`}
            aria-label="Chercher une offre à comparer"
            className="w-full rounded-xl bg-pill-solid px-3.5 py-2.5 text-sm placeholder:text-muted focus:outline-none"
          />
          {listOpen && (
          <ul className="mt-1.5 max-h-72 overflow-y-auto">
            {shown.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.id);
                    setPicking(false);
                    setListOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-pill-solid"
                >
                  {line(o)}
                  <LevelBadge level={o.level} />
                </button>
              </li>
            ))}
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted">Aucune offre ne correspond.</li>}
          </ul>
          )}
        </div>
      )}
    </div>
  );
}

const KIND_LABELS: [Skill["kind"], string][] = [
  ["outil", "Outils"],
  ["methode", "Méthodes et savoir-faire"],
  ["savoir_etre", "Savoir-être"],
  ["langue", "Langues"],
];

// What the offers of the selection ask for most: where to put the effort, on the CV and beyond.
function Demand({ demand, hasCv }: { demand: { read: number; byKind: Record<Skill["kind"], SkillStat[]> }; hasCv: boolean }) {
  const kinds = KIND_LABELS.filter(([k]) => demand.byKind[k].length > 0);
  if (demand.read < 5 || kinds.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-bold">Ce que demandent tes offres</h2>
      <p className="mt-1 text-sm text-muted">
        D&apos;après les {demand.read} offres de ton métier que Scout connaît (tous niveaux et contrats confondus, plus ta sélection), la part qui cite chaque compétence{hasCv ? ", et ce que ton CV mentionne déjà" : ""}.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {kinds.map(([kind, label]) => (
          <div key={kind} className="rounded-[22px] border border-line bg-surface p-5">
            <h3 className="font-display text-lg font-bold">{label}</h3>
            <ul className="mt-3 space-y-2.5">
              {demand.byKind[kind].map((s) => (
                <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_6rem_3rem] items-center gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    {hasCv && (s.inCv ? <span className="shrink-0 rounded-full bg-mint-soft px-2 py-0.5 text-[11px] font-semibold text-mint-ink">dans ton CV</span> : null)}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-pill-solid">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${s.share}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-muted">{s.share} %</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
