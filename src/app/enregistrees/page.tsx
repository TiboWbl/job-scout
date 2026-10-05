"use client";

import { useEffect, useState } from "react";
import { Bookmark } from "lucide-react";
import Link from "next/link";
import { useApplications, useCvText, useSavedOffers, useSearchCriteria } from "@/lib/storage";
import { computeMatch } from "@/lib/match";
import { cvOverlapBonus } from "@/lib/cv-match";
import { ApplicationStage, JobOffer } from "@/lib/types";
import { JobCard } from "@/components/job-card";
import { JobDetail } from "@/components/job-detail";
import { EmptyState } from "@/components/empty-state";

const STATUS_STALE_MS = 6 * 60 * 60 * 1000;

export default function SavedOffersPage() {
  const { criteria } = useSearchCriteria();
  const { savedOffers, isSaved, toggleSaved, applyStatuses, hydrated } = useSavedOffers();
  const { applicationForOffer, addApplication, updateApplication } = useApplications();
  const { text: cvText } = useCvText();
  const [openId, setOpenId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!hydrated) return;
    const now = Date.now();
    const stale = savedOffers.filter(
      (o) => o.source === "France Travail" && (!o.statusCheckedAt || now - new Date(o.statusCheckedAt).getTime() > STATUS_STALE_MS),
    );
    if (stale.length === 0) return;

    fetch("/api/offers/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: stale.map((o) => o.id) }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.statuses) applyStatuses(data.statuses);
      })
      .catch(() => {});
  }, [hydrated, savedOffers, applyStatuses]);

  const ranked = savedOffers.map((offer) => {
    const { score, matchedLabels, excluded } = computeMatch(offer, criteria);
    const bonus = cvOverlapBonus(cvText, offer);
    return {
      offer,
      excluded,
      score: Math.min(100, score + bonus),
      matchedLabels: bonus > 0 ? [...matchedLabels, "Profil CV"] : matchedLabels,
    };
  });
  const open = ranked.find((r) => r.offer.id === openId) ?? null;

  if (!hydrated) return null;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-accent">
          <Bookmark size={16} />
          Offres enregistrées
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
          {ranked.length > 0
            ? `${ranked.length} offre${ranked.length > 1 ? "s" : ""} enregistrée${ranked.length > 1 ? "s" : ""}`
            : "Rien d'enregistré pour l'instant"}
        </h1>
        <p className="mt-1.5 text-sm text-foreground-secondary">
          Les offres que tu mets de côté restent ici, même si elles disparaissent ensuite des résultats de recherche.
        </p>
      </header>

      {ranked.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Aucune offre enregistrée"
          description="Clique sur l'icône favori d'une offre pour la retrouver ici plus tard."
          action={
            <Link
              href="/"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/85"
            >
              Parcourir les nouvelles offres
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
