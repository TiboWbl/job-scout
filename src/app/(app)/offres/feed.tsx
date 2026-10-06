"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isExceptional, LEVEL_ORDER, type FeedItem } from "@/lib/domain/feed";
import type { Level } from "@/lib/domain/offer";
import { rank } from "@/lib/scoring/judge";
import { isFresh } from "@/lib/format";
import { OfferCard } from "@/components/offers/offer-card";
import { OfferPanel } from "@/components/offers/offer-panel";

type Filter = "all" | Exclude<Level, "ecartee"> | "ecartees";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "coeur", label: "Coups de cœur" },
  { key: "solide", label: "Solides" },
  { key: "tremplin", label: "Tremplins" },
  { key: "ecartees", label: "Écartées" },
];

type Props = { items: FeedItem[]; openness: number; pending: number; total: number; hasOffers: boolean; isAdmin: boolean };

export function Feed({ items: initial, openness, pending, total, hasOffers, isAdmin }: Props) {
  const router = useRouter();
  // Optimistic local changes (save, pas pour moi) layered over server data.
  const [overrides, setOverrides] = useState<Record<string, Partial<FeedItem>>>({});
  const items = useMemo(() => initial.map((i) => (overrides[i.offer.id] ? { ...i, ...overrides[i.offer.id] } : i)), [initial, overrides]);
  const [filter, setFilter] = useState<Filter>("all");
  const [freshOnly, setFreshOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [applying, setApplying] = useState<FeedItem | null>(null);
  const [askApplied, setAskApplied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ remaining: number; note?: string } | null>(pending > 0 ? { remaining: pending } : null);

  // Score what's left in successive calls (each one fits in a serverless time budget), refreshing as results land.
  // Interruptions are retried on their own: the person never has to reload.
  // Started once per visit: refreshing the server data must not start a second loop.
  const initialPending = useRef(pending);
  useEffect(() => {
    if (initialPending.current <= 0) return;
    let cancelled = false;
    const abort = new AbortController();
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      let remaining = initialPending.current;
      let failures = 0;
      let idle = 0;
      for (let call = 0; call < 120 && !cancelled && remaining > 0; call++) {
        const res = await fetch("/api/score", { method: "POST", signal: abort.signal }).catch(() => null);
        if (cancelled) return;
        if (!res?.ok) {
          const body = (await res?.json().catch(() => null)) as { error?: string; retry?: boolean } | null;
          failures++;
          // The model is unreachable: say so and keep trying, never fall back to a rough guess.
          const delay = body?.retry ? 30_000 : Math.min(5_000 * failures, 30_000);
          setProgress({ remaining, note: body?.retry ? `${body.error} Nouvel essai dans 30 secondes.` : "Petite coupure, Scout reprend dans un instant." });
          if (failures >= 10) {
            setProgress({ remaining, note: "Le classement n'avance plus. Reviens un peu plus tard, il reprendra là où il s'est arrêté." });
            return;
          }
          await wait(delay);
          continue;
        }
        failures = 0;
        const data = (await res.json()) as { remaining: number; scoredNow: number };
        if (cancelled) return;
        remaining = data.remaining;
        idle = data.scoredNow === 0 ? idle + 1 : 0;
        setProgress({ remaining });
        router.refresh();
        if (idle >= 3) break;
      }
      if (!cancelled) setProgress(null);
    })();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [router]);

  // Back on the tab after opening an offer: ask, once, whether the person applied.
  useEffect(() => {
    if (!applying) return;
    const onReturn = () => {
      if (document.visibilityState === "visible") setAskApplied(true);
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [applying]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const { main, outOfZone, set_aside } = useMemo(() => {
    const byRank = (a: FeedItem, b: FeedItem) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || rank(b, openness) - rank(a, openness);
    const visible = items.filter((i) => !i.dismissed);
    return {
      main: visible.filter((i) => i.level !== "ecartee" && !i.out_of_zone).sort(byRank),
      outOfZone: visible.filter((i) => i.level !== "ecartee" && i.out_of_zone && isExceptional(i)).sort(byRank),
      set_aside: items.filter((i) => i.dismissed || i.level === "ecartee" || (i.out_of_zone && !isExceptional(i))),
    };
  }, [items, openness]);

  const shown = main
    .filter((i) => filter === "all" || filter === "ecartees" || i.level === filter)
    .filter((i) => !freshOnly || isFresh(i.offer.published_at ?? i.offer.first_seen_at));
  const open = items.find((i) => i.offer.id === openId) ?? null;

  const act = useCallback(async (id: string, body: Record<string, unknown>, patch: Partial<FeedItem>) => {
    setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    await fetch(`/api/offers/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }, []);

  const handlers = (item: FeedItem) => ({
    onOpen: () => setOpenId(item.offer.id),
    onSave: () => act(item.offer.id, { saved: !item.saved }, { saved: !item.saved }),
    onNope: (reason: string) => {
      act(item.offer.id, { dismissed: true, reason }, { dismissed: true });
      if (openId === item.offer.id) setOpenId(null);
      setToast("C'est noté, Scout en tiendra compte.");
    },
    onApply: () => {
      window.open(item.offer.apply_url, "_blank", "noopener,noreferrer");
      setApplying(item);
      setAskApplied(false);
    },
  });

  async function confirmApplied() {
    if (!applying) return;
    const { offer } = applying;
    setAskApplied(false);
    setApplying(null);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: offer.id, title: offer.title, company: offer.company.name, url: offer.apply_url, stage: "postule" }),
    });
    setToast(res.ok ? "Candidature ajoutée au suivi. Bonne chance !" : "L'ajout au suivi n'a pas marché, réessaie depuis l'offre.");
  }

  return (
    <div className={`px-1 pb-16 pt-3 md:px-2 ${open ? "xl:pr-[500px]" : ""}`}>
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Offres</h1>
      <p className="mt-2 text-[15px] text-muted">
        {main.length > 0
          ? `${main.length} offre${main.length > 1 ? "s" : ""} pour toi, classées par niveau puis par pertinence.`
          : "Ta sélection apparaît ici dès que des offres correspondent à ta recherche."}
      </p>

      {progress && (
        <div className="mt-5 rounded-2xl bg-brand-soft px-4 py-3.5 text-sm" role="status">
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand/25 border-t-brand" />
            <p className="font-semibold">
              Scout trie les offres pour toi : {Math.max(0, total - progress.remaining).toLocaleString("fr-FR")} / {total.toLocaleString("fr-FR")}
            </p>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-brand/15">
            <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${total ? Math.round((100 * (total - progress.remaining)) / total) : 0}%` }} />
          </div>
          <p className="mt-2 text-muted">{progress.note ?? "Garde cette page ouverte : ta sélection se complète au fur et à mesure."}</p>
        </div>
      )}

      <div className="mb-5 mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-medium ${filter === f.key ? "border-transparent bg-button text-button-ink" : "border-line bg-pill text-muted hover:text-ink"}`}
          >
            {f.label}
            {f.key === "ecartees" && set_aside.length > 0 ? ` · ${set_aside.length}` : ""}
          </button>
        ))}
        {filter !== "ecartees" && (
          <button
            type="button"
            onClick={() => setFreshOnly((v) => !v)}
            aria-pressed={freshOnly}
            className={`whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-medium ${freshOnly ? "border-transparent bg-button text-button-ink" : "border-line bg-pill text-muted hover:text-ink"}`}
          >
            Moins de 48 h
          </button>
        )}
      </div>

      {!hasOffers && (
        <div className="rounded-3xl border border-line bg-surface p-8">
          <p className="font-display text-2xl font-bold">Les offres arrivent bientôt</p>
          <p className="mt-2 text-muted">La première collecte n&apos;a pas encore eu lieu.</p>
          {isAdmin && (
            <Link href="/admin" className="mt-5 inline-block rounded-xl bg-button px-4 py-2.5 text-sm font-semibold text-button-ink">
              Lancer la première collecte
            </Link>
          )}
        </div>
      )}

      {filter === "ecartees" ? (
        <SetAside items={set_aside} onOpen={(id) => setOpenId(id)} />
      ) : (
        <>
          <div className={`grid gap-3.5 ${open ? "sm:grid-cols-2" : "sm:grid-cols-2 2xl:grid-cols-3"}`}>
            {shown.map((item) => (
              <OfferCard key={item.offer.id} item={item} selected={item.offer.id === openId} {...handlers(item)} />
            ))}
          </div>
          {hasOffers && shown.length === 0 && !progress && (
            <p className="rounded-2xl border border-line bg-surface p-6 text-muted">
              Rien dans ce filtre pour l&apos;instant. Tu peux élargir ta recherche depuis{" "}
              <Link href="/recherche" className="font-semibold text-ink underline underline-offset-4">Ma recherche</Link>.
            </p>
          )}
          {outOfZone.length > 0 && filter === "all" && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold">Hors de ta zone</h2>
              <p className="mt-1 text-sm text-muted">Gardées à part parce que tout le reste correspond très bien.</p>
              <div className={`mt-4 grid gap-3.5 ${open ? "sm:grid-cols-2" : "sm:grid-cols-2 2xl:grid-cols-3"}`}>
                {outOfZone.map((item) => (
                  <OfferCard key={item.offer.id} item={item} selected={item.offer.id === openId} {...handlers(item)} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {open && <OfferPanel key={open.offer.id} item={open} onClose={() => setOpenId(null)} {...handlers(open)} />}

      {askApplied && applying && (
        <div className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 animate-rise rounded-2xl border border-line bg-surface p-5 shadow-2xl" role="dialog" aria-label="As-tu postulé ?">
          <p className="font-display text-lg font-bold">Tu as postulé chez {applying.offer.company.name} ?</p>
          <p className="mt-1 text-sm text-muted">{applying.offer.title}</p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={confirmApplied} className="flex-1 rounded-xl bg-button px-4 py-2.5 text-sm font-semibold text-button-ink">
              Oui, ajouter au suivi
            </button>
            <button type="button" onClick={() => { setAskApplied(false); setApplying(null); }} className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-muted">
              Pas encore
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-rise rounded-full bg-button px-5 py-3 text-sm font-medium text-button-ink shadow-xl" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function SetAside({ items, onOpen }: { items: FeedItem[]; onOpen: (id: string) => void }) {
  if (items.length === 0) return <p className="rounded-2xl border border-line bg-surface p-6 text-muted">Aucune offre écartée pour l&apos;instant.</p>;
  return (
    <div>
      <p className="mb-4 text-sm text-muted">Chaque offre écartée affiche sa raison. Si une raison te semble fausse, c&apos;est un réglage de Ma recherche à revoir.</p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.slice(0, 300).map((i) => (
          <li key={i.offer.id}>
            <button type="button" onClick={() => onOpen(i.offer.id)} className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-pill-solid sm:flex-row sm:items-baseline sm:gap-4">
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                {i.offer.title} <span className="font-normal text-muted">· {i.offer.company.name}</span>
              </span>
              <span className="text-[13px] text-muted sm:max-w-[45%] sm:text-right">
                {i.dismissed ? "Tu l'as marquée « Pas pour moi »." : i.level === "ecartee" ? i.excluded_reason : "Hors de ta zone, et pas assez exceptionnelle pour être montrée à part."}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
