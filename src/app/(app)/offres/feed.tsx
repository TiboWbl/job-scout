"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isExceptional, LEVEL_ORDER, SCORE_SELECT, type FeedItem } from "@/lib/domain/feed";
import { createClient } from "@/lib/supabase/browser";
import type { Level } from "@/lib/domain/offer";
import { rank } from "@/lib/scoring/judge";
import { isFresh, isStale, STALE_DAYS } from "@/lib/format";
import { OfferCard } from "@/components/offers/offer-card";
import { OfferPanel } from "@/components/offers/offer-panel";

type Filter = "all" | Exclude<Level, "ecartee"> | "ecartees";

const EXCLUDED_PAGE = 100;

const LEVEL_FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "coeur", label: "Coups de cœur" },
  { key: "solide", label: "Solides" },
  { key: "tremplin", label: "Tremplins" },
];

// What each level means for the person, in one short line.
const LEVEL_HELP: Partial<Record<Filter, string>> = {
  coeur: "Le métier que tu vises, dans un secteur que tu préfères, avec de vraies chances.",
  solide: "Le métier que tu vises, dans un autre secteur ou avec moins de chances.",
  tremplin: "Un poste proche qui peut te mener au métier que tu vises.",
};

// Junior: 2 years asked at most, or announced as such in the title or the requirements.
const JUNIOR_WORDS = /\b(junior|jr|associate|graduate|entry[- ]level|d[ée]butant|premi[eè]re exp[ée]rience|jeune dipl[oô]m)/i;
const isJunior = (i: FeedItem) =>
  (i.offer.experience_min_years !== null && i.offer.experience_min_years <= 2) || JUNIOR_WORDS.test(i.offer.title) || JUNIOR_WORDS.test(i.experience_asked ?? "");

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-medium ${on ? "border-transparent bg-violet-soft text-violet-ink" : "border-line bg-surface text-muted hover:text-ink"}`}
    >
      <span aria-hidden className={`grid h-4 w-4 place-items-center rounded-[5px] border text-[11px] leading-none ${on ? "border-violet-ink bg-violet-ink text-surface" : "border-line"}`}>
        {on ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}

type Props = { items: FeedItem[]; openness: number; pending: number; total: number; excludedCount: number; favoriteCompanyIds: string[]; initialOpenId: string | null; criteriaVersion: number; hasOffers: boolean; isAdmin: boolean };

export function Feed({ items: initial, openness, pending, total, excludedCount, favoriteCompanyIds, initialOpenId, criteriaVersion, hasOffers, isAdmin }: Props) {
  const router = useRouter();
  // Optimistic local changes (save, pas pour moi) layered over server data.
  const [overrides, setOverrides] = useState<Record<string, Partial<FeedItem>>>({});
  // "Écartées" can hold thousands of offers: loaded 100 at a time, only when that view is opened.
  const [excluded, setExcluded] = useState<{ items: FeedItem[]; loading: boolean; done: boolean }>({ items: [], loading: false, done: false });
  const loadExcluded = useCallback(async (from: number) => {
    setExcluded((e) => ({ ...e, loading: true }));
    const { data } = await createClient()
      .from("offer_scores")
      .select(SCORE_SELECT)
      .eq("criteria_version", criteriaVersion)
      .eq("level", "ecartee")
      .order("created_at", { ascending: false })
      .range(from, from + EXCLUDED_PAGE - 1);
    const rows = ((data ?? []) as unknown as (Omit<FeedItem, "saved" | "dismissed">)[]).filter((r) => r.offer).map((r) => ({ ...r, saved: false, dismissed: false }));
    setExcluded((e) => ({ items: [...e.items, ...rows], loading: false, done: rows.length < EXCLUDED_PAGE }));
  }, [criteriaVersion]);
  const items = useMemo(
    () => [...initial, ...excluded.items].map((i) => (overrides[i.offer.id] ? { ...i, ...overrides[i.offer.id] } : i)),
    [initial, excluded.items, overrides],
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [freshOnly, setFreshOnly] = useState(false);
  const [juniorOnly, setJuniorOnly] = useState(false);
  const [showStale, setShowStale] = useState(false);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const favoriteIds = useMemo(() => new Set(favoriteCompanyIds), [favoriteCompanyIds]);
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
    // Within a level, the newest first (applying early matters); fit breaks ties.
    const day = (i: FeedItem) => Math.floor(new Date(i.offer.published_at ?? i.offer.first_seen_at).getTime() / 86_400_000);
    const byRank = (a: FeedItem, b: FeedItem) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || day(b) - day(a) || rank(b, openness) - rank(a, openness);
    const visible = items.filter((i) => !i.dismissed);
    return {
      main: visible.filter((i) => i.level !== "ecartee" && !i.out_of_zone).sort(byRank),
      outOfZone: visible.filter((i) => i.level !== "ecartee" && i.out_of_zone && isExceptional(i)).sort(byRank),
      set_aside: items.filter((i) => i.dismissed || i.level === "ecartee" || (i.out_of_zone && !isExceptional(i))),
    };
  }, [items, openness]);

  // Model-set-aside offers are counted server-side; dismissed and out-of-zone ones are already here.
  const excludedTotal = excludedCount + set_aside.filter((i) => i.level !== "ecartee").length;

  const published = (i: FeedItem) => i.offer.published_at ?? i.offer.first_seen_at;
  const staleCount = main.filter((i) => isStale(published(i))).length;
  // Search by company or title, accents and case ignored.
  const fold = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const q = fold(query.trim());
  const matches = (i: FeedItem) => !q || fold(`${i.offer.title} ${i.offer.company.name} ${i.offer.company.brand ?? ""}`).includes(q);

  const shown = main
    .filter(matches)
    .filter((i) => filter === "all" || filter === "ecartees" || i.level === filter)
    .filter((i) => showStale || !isStale(published(i)))
    .filter((i) => !freshOnly || isFresh(published(i)))
    .filter((i) => !juniorOnly || isJunior(i));
  // Counts per level follow the refinements, so each option says what it would show.
  const refined = main.filter(matches).filter((i) => (showStale || !isStale(published(i))) && (!freshOnly || isFresh(published(i))) && (!juniorOnly || isJunior(i)));
  const levelCount = (key: Filter) => (key === "all" ? refined.length : refined.filter((i) => i.level === key).length);
  const openExcluded = () => {
    setFilter("ecartees");
    if (excluded.items.length === 0 && !excluded.loading && !excluded.done) loadExcluded(0);
  };
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
    <div className="px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Offres</h1>
      <p className="mt-2 text-[15px] text-muted">
        {main.length - staleCount > 0
          ? `${main.length - staleCount} offre${main.length - staleCount > 1 ? "s" : ""} pour toi, par niveau, les plus récentes d'abord.`
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

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une entreprise ou un intitulé"
          aria-label="Rechercher une entreprise ou un intitulé"
          className="w-full max-w-sm rounded-xl border border-line bg-surface px-4 py-2.5 text-sm placeholder:text-muted focus:border-ink focus:outline-none"
        />
        {filter === "ecartees" ? (
          <button type="button" onClick={() => setFilter("all")} className="btn-soft">
            ← Retour à ma sélection
          </button>
        ) : (
          excludedTotal > 0 && (
            <button type="button" onClick={openExcluded} className="btn-soft sm:ml-auto">
              Voir les écartées · {excludedTotal.toLocaleString("fr-FR")}
            </button>
          )
        )}
      </div>

      {filter !== "ecartees" && (
        <div className="mb-5 mt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div role="radiogroup" aria-label="Niveau" className="inline-flex flex-wrap rounded-xl border border-line bg-surface p-1">
              {LEVEL_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  aria-checked={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${filter === f.key ? "bg-button text-button-ink" : "text-muted hover:text-ink"}`}
                >
                  {f.label} <span className={filter === f.key ? "opacity-70" : "opacity-60"}>{levelCount(f.key)}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Affiner">
              <Toggle on={juniorOnly} onClick={() => setJuniorOnly((v) => !v)}>
                Junior (2 ans max)
              </Toggle>
              <Toggle on={freshOnly} onClick={() => setFreshOnly((v) => !v)}>
                Moins de 48 h
              </Toggle>
              {staleCount > 0 && (
                <Toggle on={showStale} onClick={() => setShowStale((v) => !v)}>
                  Inclure les +{STALE_DAYS} jours
                </Toggle>
              )}
            </div>
          </div>
          {LEVEL_HELP[filter] && <p className="mt-2.5 text-sm text-muted">{LEVEL_HELP[filter]}</p>}
        </div>
      )}

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
        <SetAside
          items={set_aside.filter(matches)}
          loading={excluded.loading}
          more={!excluded.done && excluded.items.length > 0}
          onMore={() => loadExcluded(excluded.items.length)}
          onOpen={(id) => setOpenId(id)}
        />
      ) : (
        <>
          <div className="grid gap-3.5 sm:grid-cols-2 2xl:grid-cols-3">
            {shown.map((item) => (
              <OfferCard key={item.offer.id} item={item} favorite={favoriteIds.has(item.offer.company.id)} selected={item.offer.id === openId} {...handlers(item)} />
            ))}
          </div>
          {hasOffers && shown.length === 0 && !progress && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface p-6 text-muted">
              Rien ici pour l&apos;instant.
              <Link href="/recherche" className="btn-soft">
                Élargir ma recherche
              </Link>
            </div>
          )}
          {outOfZone.length > 0 && filter === "all" && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold">Hors de ta zone</h2>
              <p className="mt-1 text-sm text-muted">Gardées à part parce que tout le reste correspond très bien.</p>
              <div className="mt-4 grid gap-3.5 sm:grid-cols-2 2xl:grid-cols-3">
                {outOfZone.map((item) => (
                  <OfferCard key={item.offer.id} item={item} favorite={favoriteIds.has(item.offer.company.id)} selected={item.offer.id === openId} {...handlers(item)} />
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

function SetAside({ items, loading, more, onMore, onOpen }: { items: FeedItem[]; loading: boolean; more: boolean; onMore: () => void; onOpen: (id: string) => void }) {
  if (items.length === 0)
    return <p className="rounded-2xl border border-line bg-surface p-6 text-muted">{loading ? "Chargement des offres écartées…" : "Aucune offre écartée pour l'instant."}</p>;
  return (
    <div>
      <p className="mb-4 text-sm text-muted">Chaque offre écartée affiche sa raison. Si une raison te semble fausse, c&apos;est un réglage de Ma recherche à revoir.</p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {items.map((i) => (
          <li key={i.offer.id}>
            <button type="button" onClick={() => onOpen(i.offer.id)} className="block w-full px-4 py-3 text-left hover:bg-pill-solid">
              <span className="block truncate text-[15px] font-medium">
                {i.offer.title} <span className="font-normal text-muted">· {i.offer.company.name}</span>
              </span>
              <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted">
                {i.dismissed ? "Tu l'as marquée « Pas pour moi »." : i.level === "ecartee" ? i.excluded_reason : "Hors de ta zone, et pas assez exceptionnelle pour être montrée à part."}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {more && (
        <button type="button" onClick={onMore} disabled={loading} className="mt-4 rounded-xl border border-line bg-pill px-4 py-2.5 text-sm font-medium hover:border-ink disabled:opacity-50">
          {loading ? "Chargement…" : "Afficher plus"}
        </button>
      )}
    </div>
  );
}
