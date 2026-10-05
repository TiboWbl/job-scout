"use client";

import { useMemo, useState } from "react";
import { CONTRACT_LABELS } from "@/lib/domain/criteria";
import type { FeedItem } from "@/lib/domain/feed";
import { LEVEL_LABELS, REMOTE_LABELS } from "@/lib/domain/offer";
import { tintStyle } from "@/lib/design/color";
import { freshness, isFresh, placeLabel } from "@/lib/format";
import { CompanyLogo } from "@/components/company-logo";
import { NopeIcon, SaveIcon } from "@/components/icons";
import { NopeMenu } from "./nope-menu";

type Props = {
  item: FeedItem;
  selected: boolean;
  onOpen: () => void;
  onSave: () => void;
  onNope: (reason: string) => void;
  onApply: () => void;
};

export function OfferCard({ item, selected, onOpen, onSave, onNope, onApply }: Props) {
  const [nopeOpen, setNopeOpen] = useState(false);
  const { offer } = item;
  const style = useMemo(() => tintStyle(offer.company.accent_color), [offer.company.accent_color]);
  const seenAt = offer.published_at ?? offer.first_seen_at;
  const fresh = isFresh(seenAt);

  return (
    <article
      style={style}
      onClick={onOpen}
      className={`tinted group flex cursor-pointer flex-col gap-3 rounded-[22px] border border-line p-[18px] transition-shadow hover:shadow-[0_8px_30px_-12px_rgba(23,21,31,0.25)] ${selected ? "outline outline-2 outline-offset-2 outline-[var(--accent)]" : ""}`}
    >
      <header className="flex items-center gap-3">
        <CompanyLogo name={offer.company.name} domain={offer.company.domain} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{offer.company.name}</p>
          <p className={`text-[12.5px] ${fresh ? "font-semibold text-[var(--accent)]" : "text-muted"}`}>
            {fresh ? "Nouvelle · " : ""}
            {freshness(seenAt)}
          </p>
        </div>
        <span className="ml-auto whitespace-nowrap rounded-full border border-[var(--halo)] bg-[var(--tint)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
          {LEVEL_LABELS[item.level]}
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
      </div>

      {item.why && <p className="line-clamp-2 text-sm leading-normal">{item.why}</p>}

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
