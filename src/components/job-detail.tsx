"use client";

import { ArrowUpRight, Bookmark, Building2, Calendar, ListChecks, MapPin, Wallet, X } from "lucide-react";
import clsx from "clsx";
import { useState } from "react";
import { ApplicationEntry, ApplicationStage, JobOffer } from "@/lib/types";
import { formatRelativeDate, formatSalary, isNewOffer } from "@/lib/format";
import { APPLICATION_STAGES, SOURCE_COLORS } from "@/lib/constants";
import { MatchBadge } from "./match-badge";
import { StaticTag } from "./chip";
import { Select } from "./select";
import { CompanyLogo } from "./company-logo";

export function JobDetail({
  offer,
  score,
  matchedLabels,
  saved,
  onToggleSave,
  onClose,
  application,
  onStartTracking,
  onStageChange,
  onNotesChange,
}: {
  offer: JobOffer;
  score?: number;
  matchedLabels?: string[];
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
  application?: ApplicationEntry;
  onStartTracking?: () => void;
  onStageChange?: (stage: ApplicationStage) => void;
  onNotesChange?: (notes: string) => void;
}) {
  const salary = formatSalary(offer);
  const fresh = isNewOffer(offer.postedAt);
  const expired = offer.status === "expired";
  const [notesDraft, setNotesDraft] = useState(application?.notes ?? "");
  const paragraphs = offer.fullDescription.split("\n").filter((p) => p.trim() !== "");
  const applyLabel = offer.source === "Page carrière" ? `le site de ${offer.company}` : offer.source;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-sm font-semibold text-foreground">Détail de l&apos;offre</span>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-foreground-secondary hover:bg-surface-hover"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-6 lg:px-8 lg:py-8">
        {expired && (
          <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-surface-hover px-4 py-3 text-sm text-foreground-secondary">
            <span className="h-2 w-2 shrink-0 rounded-full bg-foreground-tertiary" />
            Cette offre a été retirée, le poste est probablement pourvu.
          </div>
        )}

        <div className="flex items-start gap-4">
          <CompanyLogo offer={offer} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {fresh && (
                <span className="flex items-center gap-1 rounded-full bg-fresh-soft px-2 py-1 text-[11px] font-semibold text-fresh">
                  <span className="h-1.5 w-1.5 rounded-full bg-fresh" />
                  Nouveau
                </span>
              )}
              {score !== undefined && <MatchBadge score={score} />}
            </div>
            <h1 className="mt-2 text-xl font-semibold leading-tight text-foreground lg:text-2xl">{offer.title}</h1>
            <p className="mt-1 text-[15px] text-foreground-secondary">{offer.company}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetaItem icon={MapPin} label="Lieu" value={`${offer.location} · ${offer.workMode}`} />
          <MetaItem icon={Building2} label="Contrat" value={`${offer.contractType} · ${offer.companySize}`} />
          {salary && <MetaItem icon={Wallet} label="Rémunération" value={salary} />}
          <MetaItem icon={Calendar} label="Publiée" value={formatRelativeDate(offer.postedAt)} />
        </div>

        {matchedLabels && matchedLabels.length > 0 && (
          <div className="mt-6 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
            Correspond sur : <span className="font-medium">{matchedLabels.join(" · ")}</span>
          </div>
        )}

        {onStartTracking && (
          <section className="mt-6 rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ListChecks size={15} className="text-accent" />
              Suivi de candidature
            </div>

            {!application ? (
              <button
                type="button"
                onClick={onStartTracking}
                className="mt-3 rounded-full bg-accent px-3.5 py-2 text-xs font-semibold text-white hover:bg-accent-hover"
              >
                Commencer le suivi
              </button>
            ) : (
              <div className="mt-3 flex flex-col gap-3">
                <Select
                  value={application.stage}
                  onChange={(e) => onStageChange?.(e.target.value as ApplicationStage)}
                  className="w-full"
                >
                  {APPLICATION_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
                <textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  onBlur={() => onNotesChange?.(notesDraft)}
                  placeholder="Notes : prochaine étape, contact, ressenti…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-foreground placeholder:text-foreground-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </div>
            )}
          </section>
        )}

        {offer.companyDescription && (
          <section className="mt-7">
            <h2 className="text-sm font-semibold text-foreground">Ce que fait {offer.company}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-foreground-secondary">{offer.companyDescription}</p>
          </section>
        )}

        <section className="mt-7">
          <h2 className="text-sm font-semibold text-foreground">Description du poste</h2>
          <div className="mt-2.5 flex flex-col gap-3">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-foreground-secondary">
                {p}
              </p>
            ))}
          </div>
        </section>

        {(offer.tags.length > 0 || offer.domains.length > 0) && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">Mots-clés</h2>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {offer.tags.map((tag) => (
                <StaticTag key={tag} label={tag} />
              ))}
              {offer.domains.map((domain) => (
                <StaticTag key={domain} label={domain} />
              ))}
            </div>
          </section>
        )}

        <section className="mt-7 flex items-center gap-2 border-t border-border pt-4 text-xs text-foreground-tertiary">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SOURCE_COLORS[offer.source] }} />
          Repérée sur {offer.source}
        </section>
      </div>

      <div className="flex items-center gap-2.5 border-t border-border bg-surface px-6 py-4 lg:px-8">
        <button
          type="button"
          onClick={onToggleSave}
          aria-pressed={saved}
          className={clsx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors",
            saved ? "border-accent bg-accent-soft text-accent" : "border-border text-foreground-secondary hover:bg-surface-hover",
          )}
          aria-label={saved ? "Retirer des offres enregistrées" : "Enregistrer l'offre"}
        >
          <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
        </button>
        <a
          href={offer.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full py-3 text-sm font-semibold transition-colors",
            expired
              ? "bg-surface-hover text-foreground-secondary hover:bg-border"
              : "bg-foreground text-background hover:bg-foreground/85",
          )}
        >
          {expired ? "Voir l'annonce d'origine" : `Voir l'offre sur ${applyLabel}`}
          <ArrowUpRight size={15} />
        </a>
      </div>
    </div>
  );
}

function MetaItem({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground-tertiary">
        <Icon size={12} />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
