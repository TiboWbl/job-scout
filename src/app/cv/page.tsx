"use client";

import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, FileUp, Loader2, Lock, XCircle } from "lucide-react";
import clsx from "clsx";
import { useCvText, useSearchCriteria } from "@/lib/storage";
import { analyzeCv, CvAnalysisResult, FindingStatus } from "@/lib/cv-analysis";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { ScoreRing } from "@/components/score-ring";

const STATUS_STYLES: Record<FindingStatus, { icon: typeof CheckCircle2; className: string }> = {
  ok: { icon: CheckCircle2, className: "text-success" },
  warning: { icon: AlertTriangle, className: "text-fresh" },
  critical: { icon: XCircle, className: "text-danger" },
};

export default function CvAnalysisPage() {
  const { text, setText, hydrated } = useCvText();
  const { criteria } = useSearchCriteria();
  const [result, setResult] = useState<CvAnalysisResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pasteMode, setPasteMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setImportError(null);
    setImporting(true);
    try {
      const extracted = await extractTextFromPdf(file);
      if (extracted.trim().length < 20) {
        setImportError("Peu de texte extrait de ce PDF, colle plutôt le contenu manuellement ci-dessous.");
        setPasteMode(true);
        setImporting(false);
        return;
      }
      setText(extracted);
      setResult(analyzeCv(extracted, criteria));
    } catch {
      setImportError("Impossible de lire ce PDF, colle le contenu manuellement ci-dessous.");
      setPasteMode(true);
    } finally {
      setImporting(false);
    }
  }

  if (!hydrated) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-accent">
          <FileSearch size={16} />
          Analyse CV
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
          Un œil d&apos;ATS sur ton CV
        </h1>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-foreground-secondary">
          <Lock size={13} />
          Tout se passe dans ton navigateur : rien n&apos;est jamais envoyé à un serveur.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex w-full flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-border py-10 text-center transition-colors hover:border-accent hover:bg-accent-soft disabled:cursor-wait"
        >
          {importing ? (
            <Loader2 size={24} className="animate-spin text-accent" />
          ) : (
            <FileUp size={24} className="text-accent" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {importing ? "Lecture du PDF…" : "Importer mon CV"}
          </span>
          {!importing && <span className="text-xs text-foreground-tertiary">Fichier PDF</span>}
        </button>

        {importError && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-fresh-soft px-3 py-2 text-xs text-fresh">
            <AlertTriangle size={13} />
            {importError}
          </p>
        )}

        {!pasteMode ? (
          <button
            type="button"
            onClick={() => setPasteMode(true)}
            className="mt-3 text-xs font-medium text-foreground-tertiary underline-offset-2 hover:text-foreground hover:underline"
          >
            Coller le texte à la place
          </button>
        ) : (
          <div className="mt-4">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setResult(null);
              }}
              placeholder="Colle ici le texte de ton CV…"
              rows={10}
              className="w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-3 text-sm leading-relaxed text-foreground placeholder:text-foreground-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
            <button
              type="button"
              onClick={() => setResult(analyzeCv(text, criteria))}
              disabled={text.trim().length < 20}
              className="mt-3 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              Analyser mon CV
            </button>
          </div>
        )}
      </div>

      {result && (
        <div className="mt-5 flex flex-col gap-4">
          <div className="flex items-center gap-5 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
            <ScoreRing score={result.score} />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {result.score >= 75 ? "Bien optimisé pour les ATS" : result.score >= 50 ? "Des points à améliorer" : "Plusieurs points bloquants"}
              </p>
              <p className="mt-1 text-sm text-foreground-secondary">
                {result.score >= 75
                  ? "Ton CV passe bien les filtres automatiques, les retours ci-dessous sont des détails à peaufiner."
                  : "Corrige les points critiques ci-dessous en priorité, ils pèsent le plus sur le tri automatique."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {result.findings.map((finding) => {
              const { icon: Icon, className } = STATUS_STYLES[finding.status];
              return (
                <div
                  key={finding.id}
                  className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]"
                >
                  <Icon size={18} className={clsx("mt-0.5 shrink-0", className)} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{finding.label}</p>
                    <p className="mt-0.5 text-sm text-foreground-secondary">{finding.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
