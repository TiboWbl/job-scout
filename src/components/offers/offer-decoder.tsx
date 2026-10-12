"use client";

import { useEffect, useState } from "react";
import { splitRequirements } from "@/lib/domain/requirements";
import type { FeedOffer } from "@/lib/domain/feed";

const DAY = 86_400_000;
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const date = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

// What a candidate cannot see on the posting itself: how long it has been online, whether it came
// back, how long this company's offers usually stay up, and what it only wishes for. Only shown when
// there is something worth knowing.
export function OfferDecoder({ offer, description }: { offer: FeedOffer; description: string | null }) {
  const [medianDays, setMedianDays] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/offers/${offer.id}/decoder`)
      .then((r) => r.json())
      .then((d: { medianDays?: number | null }) => !cancelled && setMedianDays(d.medianDays ?? null))
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [offer.id]);

  // eslint-disable-next-line react-hooks/purity -- the age is read when the panel opens
  const now = Date.now();
  const age = Math.floor((now - Date.parse(offer.published_at ?? offer.first_seen_at)) / DAY);
  const lines: { title: string; text: string }[] = [];

  if (offer.repost_count && offer.reposted_at)
    lines.push({ title: "Republiée", text: `Retirée puis remise en ligne le ${date(offer.reposted_at)} : le recrutement continue.` });
  if (age >= 90)
    lines.push({ title: "Publiée il y a plus de 3 mois", text: "Il peut s'agir d'une annonce permanente, ouverte en continu pour recevoir des candidatures. Vérifie auprès de l'entreprise qu'un poste est vraiment à pourvoir." });
  else if (age >= 30)
    lines.push({ title: `En ligne depuis ${age >= 60 ? "2 mois" : `${age} jours`}`, text: "Le recrutement dure, ou l'annonce n'a pas été retirée. Vérifie qu'elle est toujours ouverte avant d'y passer du temps." });
  if (medianDays !== null && age < medianDays)
    lines.push({ title: "Combien de temps elle reste en ligne", text: `Chez ${offer.company.name}, la moitié des offres disparaissent en moins de ${medianDays} jours. Celle-ci est en ligne depuis ${age} jour${age > 1 ? "s" : ""}.` });

  if (description && offer.skills?.length) {
    const { required, bonus } = splitRequirements(description);
    // As a whole word: "IA" is not in "social".
    const has = (text: string, name: string) => new RegExp(`(^|[^a-z0-9])${fold(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(fold(text));
    const wishes = offer.skills.filter((s) => has(bonus, s.name) && !has(required, s.name)).map((s) => s.name);
    if (wishes.length) lines.push({ title: "Un plus, pas une condition", text: `Dans les bonus de l'offre : ${wishes.join(", ")}. Ne pas ${wishes.length > 1 ? "les " : "l'"}avoir ne doit pas t'empêcher de postuler.` });
  }

  if (lines.length === 0) return null;
  return (
    <section className="mt-5 rounded-2xl border border-line p-4">
      <h3 className="font-display text-base font-bold">Ce que l&apos;annonce ne dit pas</h3>
      <ul className="mt-2 space-y-2.5">
        {lines.map((l) => (
          <li key={l.title} className="text-[14px] leading-relaxed">
            <span className="font-semibold">{l.title}.</span> <span className="text-muted">{l.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
