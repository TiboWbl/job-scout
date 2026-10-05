"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { useApplications, useCvText, useSavedOffers, useSearchCriteria } from "@/lib/storage";
import { ApplicationStage, JobOffer } from "@/lib/types";
import { useOffers } from "@/lib/use-offers";
import { computeMatch, isExcluded } from "@/lib/match";
import { cvOverlapBonus } from "@/lib/cv-match";
import { isNewOffer } from "@/lib/format";
import { JobCard } from "@/components/job-card";
import { JobDetail } from "@/components/job-detail";
import { EmptyState } from "@/components/empty-state";
import { Select } from "@/components/select";

type SortOption = "match" | "recent" | "salary";

export default function NewOffersPage() {
  const { criteria } = useSearchCriteria();
  const { isSaved, toggleSaved } = useSavedOffers();
  const { applicationForOffer, addApplication, updateApplication } = useApplications();
  const { text: cvText } = useCvText();
  const offersState = useOffers();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("match");
  const [hideLowMatch, setHideLowMatch] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const activeSources = offersState.status === "ready" ? offersState.activeSources : [];

  const ranked = useMemo(() => {
    const offers = offersState.status === "ready" ? offersState.offers : [];
    return offers
      .filter((offer) => !isExcluded(offer, criteria))
      .map((offer) => {
        const { score, matchedLabels, excluded } = computeMatch(offer, criteria);
        const bonus = cvOverlapBonus(cvText, offer);
        return {
          offer,
          excluded,
          score: Math.min(100, score + bonus),
          matchedLabels: bonus > 0 ? [...matchedLabels, "Profil CV"] : matchedLabels,
        };
      })
      .filter(({ offer }) => {
        if (query.trim() === "") return true;
        const q = query.toLowerCase();
        const haystack = [offer.title, offer.company, offer.fullDescription, ...offer.tags].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .filter(({ score }) => !hideLowMatch || score >= 25)
      .sort((a, b) => {
        if (sort === "match") return b.score - a.score;
        if (sort === "recent") return new Date(b.offer.postedAt).getTime() - new Date(a.offer.postedAt).getTime();
        const aSalary = a.offer.salaryMax ?? a.offer.salaryMin ?? 0;
        const bSalary = b.offer.salaryMax ?? b.offer.salaryMin ?? 0;
        return bSalary - aSalary;
      });
  }, [offersState, criteria, query, sort, hideLowMatch, cvText]);

  const newToday = ranked.filter(({ offer }) => isNewOffer(offer.postedAt)).length;
  const open = ranked.find((r) => r.offer.id === openId) ?? null;

  function startTracking(offer: JobOffer) {
    addApplication({ offerId: offer.id, title: offer.title, company: offer.company, sourceUrl: offer.sourceUrl, stage: "interesse", notes: "" });
  }

  function changeStage(offer: JobOffer, stage: ApplicationStage) {
    const app = applicationForOffer(offer.id);
    if (app) updateApplication(app.id, { stage });
  }

  function changeNotes(offer: JobOffer, notes: string) {
    const app = applicationForOffer(offer.id);
    if (app) updateApplication(app.id, { notes });
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-accent">
          <Sparkles size={16} />
          Nouvelles offres
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
          {newToday > 0
            ? `${newToday} nouvelle${newToday > 1 ? "s" : ""} aujourd'hui`
            : "Aucune nouvelle offre aujourd'hui"}
        </h1>
        <p className="mt-1.5 text-sm text-foreground-secondary">
          Agrégées depuis les pages carrière d&apos;entreprises, France Travail et Adzuna, classées selon tes critères.
        </p>
      </header>

      {offersState.status === "ready" && activeSources.length === 0 && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-fresh-soft px-3.5 py-3 text-sm text-fresh">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>
            Aucune source n&apos;est configurée. Ajoute des clés API dans{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs">.env.local</code> (voir le README) pour voir
            apparaître de vraies offres.
          </p>
        </div>
      )}

      <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-tertiary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Poste, entreprise, mission…"
            className="w-full rounded-full border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value as SortOption)} className="shrink-0">
          <option value="match">Meilleur match</option>
          <option value="recent">Plus récent</option>
          <option value="salary">Salaire</option>
        </Select>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground-secondary">
          {offersState.status === "ready" && (
            <>
              <span className="font-semibold text-foreground">{ranked.length}</span> offre{ranked.length > 1 ? "s" : ""}{" "}
              correspond{ranked.length > 1 ? "ent" : ""} à tes critères
            </>
          )}
        </p>
        <label className="flex items-center gap-2 text-xs text-foreground-secondary">
          <input
            type="checkbox"
            checked={hideLowMatch}
            onChange={(e) => setHideLowMatch(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border-strong text-accent focus:ring-accent/30"
          />
          Masquer les offres peu pertinentes (&lt; 25%)
        </label>
      </div>

      {offersState.status === "loading" ? (
        <div className="flex items-center justify-center py-20 text-foreground-tertiary">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : offersState.status === "error" ? (
        <EmptyState
          icon={AlertTriangle}
          title="Impossible de charger les offres"
          description="Vérifie ta connexion ou réessaie dans quelques instants."
        />
      ) : ranked.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="Aucune offre ne correspond"
          description={
            activeSources.length === 0
              ? "Configure au moins une source d'offres pour commencer."
              : "Élargis tes critères ou suis plus de sources."
          }
          action={
            <Link
              href="/criteres"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/85"
            >
              Ajuster mes critères
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {ranked.map(({ offer, score }) => (
            <JobCard
              key={offer.id}
              offer={offer}
              score={score}
              saved={isSaved(offer.id)}
              onOpen={() => setOpenId(offer.id)}
              onToggleSave={() => toggleSaved(offer)}
            />
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-background">
          <JobDetail
            key={open.offer.id}
            offer={open.offer}
            score={open.score}
            matchedLabels={open.matchedLabels}
            saved={isSaved(open.offer.id)}
            onToggleSave={() => toggleSaved(open.offer)}
            onClose={() => setOpenId(null)}
            application={applicationForOffer(open.offer.id)}
            onStartTracking={() => startTracking(open.offer)}
            onStageChange={(stage) => changeStage(open.offer, stage)}
            onNotesChange={(notes) => changeNotes(open.offer, notes)}
          />
        </div>
      )}
    </div>
  );
}
