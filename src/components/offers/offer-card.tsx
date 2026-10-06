"use client";

import { useMemo, useState } from "react";
import { CONTRACT_LABELS } from "@/lib/domain/criteria";
import type { FeedItem } from "@/lib/domain/feed";
import { REMOTE_LABELS } from "@/lib/domain/offer";
import { tintStyle } from "@/lib/design/color";
import { freshness, isFresh, placeLabel } from "@/lib/format";
import { CompanyLogo } from "@/components/company-logo";
import { NopeIcon, SaveIcon } from "@/components/icons";
import { LevelBadge } from "@/components/level-badge";
import { NopeMenu } from "./nope-menu";

type Props = {
  item: FeedItem;
  favorite?: boolean;
  selected: boolean;
  onOpen: () => void;
  onSave: () => void;
  onNope: (reason: string) => void;
  onApply: () => void;
};

export function OfferCard({ item, favorite = false, selected, onOpen, onSave, onNope, onApply }: Props) {
  const [nopeOpen, setNopeOpen] = useState(false);
  const { offer } = item;
  const style = useMemo(() => tintStyle(offer.company.accent_color), [offer.company.accent_color]);
  const seenAt = offer.published_at ?? offer.first_seen_at;
  const fresh = isFresh(seenAt);
  // What the model read in "profil recherché", else what the posting's text states.
  const experience =
    item.experience_asked ??
    (offer.experience_min_years === null ? null : offer.experience_min_years === 0 ? "débutant accepté" : `${offer.experience_min_years} an${offer.experience_min_years > 1 ? "s" : ""} min.`);

  return (
    <article
      style={style}
      onClick={onOpen}
      className={`tinted group flex cursor-pointer flex-col gap-3 rounded-[22px] border border-line p-[18px] transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(23,21,31,0.25)] ${selected ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
    >
      <header className="flex items-center gap-3">
        <CompanyLogo name={offer.company.name} domain={offer.company.domain} brand={offer.company.brand} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {offer.company.name}
            {favorite && (
              <span className="rounded-full bg-[var(--accent)] px-1.5 py-px text-[10.5px] font-semibold text-white" title="Une de tes entreprises favorites">
                Favorite
              </span>
            )}
          </p>
          <p className={`text-[12.5px] ${fresh ? "font-semibold text-[var(--accent)]" : "text-muted"}`}>
            {fresh ? "Nouvelle · " : ""}
            {seenAt ? `Publiée ${freshness(seenAt)}` : ""}
          </p>
        </div>
        <span className="ml-auto">
          <LevelBadge level={item.level} />
        </span>
      </header>

      <h3 className="font-display text-xl font-bold leading-[1.15] tracking-tight">
        <button type="button" onClick={onOpen} className="text-left focus:outline-none focus-visible:underline">
          {offer.title}
        </button>
      </h3>

      <div className="flex flex-wrap gap-1.5 text-[12.5px] font-medium text-muted">
        <span className="rounded-full bg-pill px-2.5 py-1">{placeLabel(offer.places, offer.location_raw)}</span>
        {offer.remote !== "unknown" && <span className="rounded-full bg-pill px-2.5 py-1">{REMOTE_LABELS[offer.remote]}</span>}
        {offer.contract !== "unknown" && <span className="rounded-full bg-pill px-2.5 py-1">{CONTRACT_LABELS[offer.contract as keyof typeof CONTRACT_LABELS]}</span>}
        {/* Missing facts are said so, in a dashed chip: worth a look in the posting itself. */}
        {item.watch[0]?.startsWith("Extrait seulement") && <span className="rounded-full border border-dashed border-line px-2.5 py-1">Extrait seulement</span>}
        {item.salary ? <span className="rounded-full bg-pill px-2.5 py-1 text-ink">{item.salary}</span> : <span className="rounded-full border border-dashed border-line px-2.5 py-1">Salaire non indiqué</span>}
        {experience ? (
          <span className="rounded-full bg-pill px-2.5 py-1 text-ink">Expérience : {experience}</span>
        ) : (
          <span className="rounded-full border border-dashed border-line px-2.5 py-1">Expérience non précisée</span>
        )}
      </div>

      {item.missions.length > 0 && (
        <ul className="space-y-1 text-[13.5px] leading-snug">
          {item.missions.map((m) => (
            <li key={m} className="flex gap-2">
              <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
              {m}
            </li>
          ))}
        </ul>
      )}

      {item.why && (
        <p className="rounded-xl bg-surface/80 px-3 py-2 text-[13.5px] leading-snug">
          <span className="font-semibold text-[var(--accent)]">Pour toi : </span>
          {item.why}
        </p>
      )}

      <div className="mt-auto flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onApply} className="rounded-xl bg-button px-4 py-2 text-[13.5px] font-semibold text-button-ink hover:opacity-90">
          Postuler
        </button>
        <button
          type="button"
          onClick={onSave}
          aria-pressed={item.saved}
          aria-label={item.saved ? "Retirer des sauvegardes" : "Sauvegarder"}
          title={item.saved ? "Sauvegardée" : "Sauvegarder"}
          className={`grid h-9 w-9 place-items-center rounded-xl border border-line bg-pill ${item.saved ? "text-[var(--accent)]" : "text-muted hover:text-ink"}`}
        >
          <SaveIcon filled={item.saved} className="h-[17px] w-[17px]" />
        </button>
        <button
          type="button"
          onClick={() => setNopeOpen((v) => !v)}
          aria-label="Pas pour moi"
          title="Pas pour moi"
          className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-pill text-muted hover:text-ink"
        >
          <NopeIcon className="h-[17px] w-[17px]" />
        </button>
      </div>
      {nopeOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <NopeMenu onPick={(r) => { setNopeOpen(false); onNope(r); }} onCancel={() => setNopeOpen(false)} />
        </div>
      )}
    </article>
  );
}
