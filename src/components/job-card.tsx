"use client";

import { Bookmark, Briefcase, MapPin } from "lucide-react";
import clsx from "clsx";
import { JobOffer } from "@/lib/types";
import { formatRelativeDate, formatSalary, isNewOffer } from "@/lib/format";
import { SOURCE_COLORS } from "@/lib/constants";
import { MatchBadge } from "./match-badge";
import { CompanyLogo } from "./company-logo";
import { StaticTag } from "./chip";

export function JobCard({
  offer,
  score,
  saved,
  onOpen,
  onToggleSave,
}: {
  offer: JobOffer;
  score?: number;
  saved: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  const salary = formatSalary(offer);
  const fresh = isNewOffer(offer.postedAt);
  const expired = offer.status === "expired";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={clsx(
        "group relative cursor-pointer rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]",
        expired ? "opacity-60 grayscale" : "shadow-[var(--shadow-card)]",
      )}
    >
      <div className="flex items-start gap-4">
        <CompanyLogo offer={offer} size={48} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-semibold text-foreground">{offer.title}</h3>
              <p className="text-sm text-foreground-secondary">{offer.company}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {expired ? (
                <span className="rounded-full bg-surface-hover px-2.5 py-1 text-xs font-semibold text-foreground-tertiary">
                  Offre retirée
                </span>
              ) : (
                <>
                  {fresh && (
                    <span className="flex items-center gap-1 rounded-full bg-fresh-soft px-2 py-1 text-[11px] font-semibold text-fresh">
                      <span className="h-1.5 w-1.5 rounded-full bg-fresh" />
                      Nouveau
                    </span>
                  )}
                  {score !== undefined && <MatchBadge score={score} />}
                </>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-tertiary">
            <span className="flex items-center gap-1">
              <MapPin size={13} />
              {offer.location} · {offer.workMode}
            </span>
            <span className="flex items-center gap-1">
              <Briefcase size={13} />
              {offer.contractType}
            </span>
            {salary && <span className="font-medium text-foreground-secondary">{salary}</span>}
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-foreground-secondary">{offer.pitch}</p>

      {offer.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {offer.tags.slice(0, 3).map((tag) => (
            <StaticTag key={tag} label={tag} />
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-2 text-xs text-foreground-tertiary">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[offer.source] }} />
          {offer.source}
          <span>·</span>
          {formatRelativeDate(offer.postedAt)}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          aria-pressed={saved}
          aria-label={saved ? "Retirer des offres enregistrées" : "Enregistrer l'offre"}
          className={clsx(
            "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
            saved ? "bg-accent-soft text-accent" : "text-foreground-tertiary hover:bg-surface-hover hover:text-foreground",
          )}
        >
          <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
        </button>
      </div>
    </div>
  );
}
