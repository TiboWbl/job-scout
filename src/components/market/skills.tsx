"use client";

import { useState } from "react";
import type { MarketSkill } from "@/lib/market/compute";

const KINDS: [MarketSkill["kind"], string][] = [
  ["outil", "Outils"],
  ["methode", "Méthodes"],
  ["savoir_etre", "Savoir-être"],
  ["langue", "Langues"],
];

// What the offers of the role ask for, one family at a time: the share of offers, how it moved, and
// where the person stands (in the CV, or cited by their own offers).
export function MarketSkills({ skills, trend, mine, personal, since }: { skills: MarketSkill[]; trend: Record<string, number>; mine: number; personal: boolean; since: string | null }) {
  const kinds = KINDS.filter(([k]) => skills.some((s) => s.kind === k));
  const [kind, setKind] = useState(kinds[0]?.[0] ?? "outil");
  const shown = skills.filter((s) => s.kind === kind).slice(0, 8);
  return (
    <div>
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {kinds.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${kind === k ? "bg-button text-button-ink" : "bg-pill-solid text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="mt-5 space-y-3.5">
        {shown.map((s) => {
          const delta = trend[s.key ?? s.name];
          const plus = s.count >= 10 && (s.bonus ?? 0) / s.count >= 0.4;
          return (
            <li key={s.key ?? s.name} className="grid grid-cols-[minmax(0,1fr)_3rem] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,1fr)_14rem_3rem_4.5rem]">
              <span className="order-1 min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold">{s.name}</span>
                  {personal && s.inCv && <span className="rounded-full bg-mint-soft px-2 py-0.5 text-[11px] font-semibold text-mint-ink">dans ton CV</span>}
                  {plus && <span className="rounded-full bg-pill-solid px-2 py-0.5 text-[11px] font-semibold text-muted">souvent un plus</span>}
                </span>
                {personal && s.mine > 0 && !s.inCv && (
                  <span className="block text-[12.5px] text-muted">
                    dans {s.mine} de tes {mine} offres
                  </span>
                )}
              </span>
              <span className="order-3 col-span-2 h-2 overflow-hidden rounded-full bg-pill-solid sm:order-2 sm:col-span-1">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${s.share}%` }} />
              </span>
              <span className="order-2 text-right font-semibold tabular-nums sm:order-3">{s.share} %</span>
              <span className="order-4 hidden text-right text-[12.5px] tabular-nums sm:block">
                {delta !== undefined && Math.abs(delta) >= 2 ? (
                  <span className={delta > 0 ? "text-mint-ink" : "text-peach-ink"} title={since ? `Depuis le ${since}` : undefined}>
                    {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} pts
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
