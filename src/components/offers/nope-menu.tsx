"use client";

// One click to say why: the reason is stored with the offer and will refine scoring.
export const NOPE_REASONS = ["Pas le bon métier", "Secteur", "Lieu ou télétravail", "Trop senior", "Entreprise", "Autre"] as const;

export function NopeMenu({ onPick, onCancel }: { onPick: (reason: string) => void; onCancel: () => void }) {
  return (
    <div className="animate-rise rounded-2xl border border-line bg-surface p-3 shadow-lg" role="menu" aria-label="Pourquoi pas pour toi ?">
      <p className="px-1 pb-2 text-[13px] font-medium text-muted">Pourquoi pas pour toi ?</p>
      <div className="flex flex-wrap gap-1.5">
        {NOPE_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            role="menuitem"
            onClick={(e) => {
              e.stopPropagation();
              onPick(r);
            }}
            className="rounded-full border border-line bg-pill-solid px-3 py-1.5 text-[13px] font-medium hover:border-[var(--accent,var(--ink))]"
          >
            {r}
          </button>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="px-2 py-1.5 text-[13px] text-muted hover:text-ink"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
