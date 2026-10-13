import type { MarketData, MarketSkill } from "./compute";
import { skillLabel } from "@/lib/views/skills";

// What the market means for the person this week: at most three actions, built from the figures
// themselves. Written by rules, not by the model: every number shown is the one Scout counted.

export type Action = { kind: "ajouter" | "valoriser" | "relativiser" | "cibler"; titre: string; detail: string };

const HARD = new Set<MarketSkill["kind"]>(["outil", "methode"]);
const cap = skillLabel;

export function marketActions(m: MarketData): Action[] {
  const out: Action[] = [];
  const hard = m.skills.filter((s) => HARD.has(s.kind) || s.kind === "langue");
  const required = (s: MarketSkill) => s.count - (s.bonus ?? 0);

  // 1. The skill that counts most in the person's own offers and that the CV does not show.
  const add = hard
    .filter((s) => !s.inCv && s.mine >= 3 && required(s) >= s.count / 2)
    .sort((a, b) => b.mine - a.mine)[0];
  if (add)
    out.push({
      kind: "ajouter",
      titre: `${cap(add.name)} : à écrire, si c'est vrai pour toi`,
      detail: `${add.mine} de tes ${m.mine} offres en parlent, ton CV non. Si tu l'as pratiqué, écris-le dans une mission.`,
    });

  // 2. The most asked skill the CV already has: shown in a mission, it weighs more than in a list.
  const show = hard.filter((s) => s.inCv && s.kind !== "langue").sort((a, b) => b.share - a.share)[0];
  if (show)
    out.push({
      kind: "valoriser",
      titre: `${cap(show.name)} : déjà dans ton CV, à mettre en valeur`,
      detail: `${show.share} % des offres en parlent. Montre-le dans une mission, avec un résultat.`,
    });

  // 3. A skill mostly asked "as a plus": worth knowing, not worth putting the week into.
  const plus = hard
    .filter((s) => !s.inCv && s.count >= 15 && (s.bonus ?? 0) / s.count >= 0.4)
    .sort((a, b) => b.count - a.count)[0];
  if (plus)
    out.push({
      kind: "relativiser",
      titre: `${cap(plus.name)} : un plus, rarement une condition`,
      detail: `« Un plus » dans ${Math.round((100 * (plus.bonus ?? 0)) / plus.count)} % des offres qui en parlent. Postule quand même.`,
    });

  // Otherwise, where the doors are open: offers that do not set a number of years.
  if (out.length < 3) {
    const unspecified = m.experience.buckets.find((b) => b.label === "Non précisée")?.count ?? 0;
    if (m.total > 0 && unspecified / m.total >= 0.3)
      out.push({
        kind: "cibler",
        titre: "Les offres sans durée d'expérience sont ouvertes",
        detail: `${Math.round((100 * unspecified) / m.total)} % des offres ne chiffrent pas l'expérience : ne t'en prive pas.`,
      });
  }
  return out.slice(0, 3);
}
