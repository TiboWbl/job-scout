"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONTRACT_LABELS } from "@/lib/domain/criteria";
import type { FeedItem } from "@/lib/domain/feed";
import { REMOTE_LABELS } from "@/lib/domain/offer";
import { tintStyle } from "@/lib/design/color";
import { freshness, placeLabel } from "@/lib/format";
import { experienceText } from "@/lib/domain/signals";
import { companyIntro, structureDescription } from "@/lib/format-description";
import { createClient } from "@/lib/supabase/browser";
import { CompanyLogo } from "@/components/company-logo";
import { ArrowIcon, CloseIcon, NopeIcon, SaveIcon } from "@/components/icons";
import { LevelBadge } from "@/components/level-badge";
import { NopeMenu } from "./nope-menu";

type Props = {
  item: FeedItem;
  onClose: () => void;
  onSave: () => void;
  onNope: (reason: string) => void;
  onApply: () => void;
  // The public demo reads descriptions through a read-only API instead of the signed-in client.
  loadDescription?: (id: string) => Promise<string>;
};

type Block = { kind: "heading" | "paragraph"; text: string } | { kind: "list"; items: string[] };

// Rebuilds headings, paragraphs and bullet lists from the normalised plain text.
function toBlocks(text: string): Block[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const blocks: Block[] = [];
  lines.forEach((line, i) => {
    if (line.startsWith("•")) {
      const last = blocks[blocks.length - 1];
      const entry = line.replace(/^•\s*/, "");
      if (last?.kind === "list") last.items.push(entry);
      else blocks.push({ kind: "list", items: [entry] });
      return;
    }
    const next = lines[i + 1] ?? "";
    const looksLikeHeading = line.length < 70 && !/[.;,!?]$/.test(line) && (line.endsWith(":") || next.startsWith("•"));
    blocks.push({ kind: looksLikeHeading ? "heading" : "paragraph", text: line.replace(/:$/, "") });
  });
  return blocks;
}

export function OfferPanel({ item, onClose, onSave, onNope, onApply, loadDescription }: Props) {
  const { offer } = item;
  const [description, setDescription] = useState<string | null>(null);
  // Strengths and CV levers are prepared when the offer is opened (once, then kept).
  const [details, setDetails] = useState<{ strengths: string[]; cvLevers: string[]; loading: boolean }>({ strengths: item.strengths, cvLevers: item.cv_levers, loading: false });
  useEffect(() => {
    if (loadDescription || item.level === "ecartee" || item.strengths.length > 0 || item.cv_levers.length > 0) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shows the preparation while it runs
    setDetails((d) => ({ ...d, loading: true }));
    fetch(`/api/offers/${offer.id}/details`, { method: "POST" })
      .then((r) => r.json())
      .then((d: { strengths?: string[]; cvLevers?: string[] }) => !cancelled && setDetails({ strengths: d.strengths ?? [], cvLevers: d.cvLevers ?? [], loading: false }))
      .catch(() => !cancelled && setDetails((d) => ({ ...d, loading: false })));
    return () => {
      cancelled = true;
    };
  }, [offer.id, item.level, item.strengths, item.cv_levers, loadDescription]);
  // Stable across renders: the parent passes a new function each time.
  const loader = useRef(loadDescription);
  const [nopeOpen, setNopeOpen] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const style = useMemo(() => tintStyle(offer.company.accent_color), [offer.company.accent_color]);

  useEffect(() => {
    let cancelled = false;
    const done = (text: string) => !cancelled && setDescription(text);
    if (loader.current) {
      loader.current(offer.id).then(done, () => done(""));
      return () => {
        cancelled = true;
      };
    }
    try {
      createClient()
        .from("offers")
        .select("description")
        .eq("id", offer.id)
        .single()
        .then(({ data }) => done(data?.description ?? ""), () => done(""));
    } catch {
      // Falls back to the link to the original posting.
      queueMicrotask(() => done(""));
    }
    return () => {
      cancelled = true;
    };
  }, [offer.id]);

  // The page behind must not scroll while the offer fills the screen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const blocks = description ? toBlocks(structureDescription(description)) : [];
  // What the company makes or sells (read from its postings), otherwise the posting's own introduction.
  const about = offer.company.product ?? (description ? companyIntro(description) : null);
  const seenAt = offer.published_at ?? offer.first_seen_at;
  const facts = [
    ["Lieu", placeLabel(offer.places, offer.location_raw)],
    ["Télétravail", REMOTE_LABELS[offer.remote]],
    ["Contrat", offer.contract === "unknown" ? "Non précisé" : (CONTRACT_LABELS[offer.contract as keyof typeof CONTRACT_LABELS] ?? "Non précisé")],
    ["Expérience demandée", experienceText(offer.experience_min_years, offer.experience_max_years, offer.experience_level, offer.seniority_estimate) ?? item.experience_asked ?? "Non précisée"],
    ["Salaire", offer.salary_text ?? item.salary ?? "Non indiqué"],
    ["Publiée", freshness(seenAt).replace(/^./, (c) => c.toUpperCase())],
  ];

  const panel = (
    <aside
      style={style}
      aria-label={`Détail de l'offre ${offer.title}`}
      onClick={(e) => e.stopPropagation()}
      className="tinted-vars animate-rise flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
    >
      <div className={`relative shrink-0 bg-[var(--band)] ${(offer.image_url ?? offer.company.cover_url) && !coverFailed ? "h-44" : "h-[92px]"}`}>
        {(offer.image_url ?? offer.company.cover_url) && !coverFailed && (
          // eslint-disable-next-line @next/next/no-img-element -- external image, referenced not copied
          <img src={(offer.image_url ?? offer.company.cover_url)!} alt="" referrerPolicy="no-referrer" onError={() => setCoverFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute right-4 top-4 flex gap-2">
          <button type="button" onClick={onClose} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-white/80 text-[#17151f] hover:bg-white">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="absolute -bottom-7 left-6">
          <CompanyLogo name={offer.company.name} domain={offer.company.domain} brand={offer.company.brand} size={60} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-11 md:px-10">
        <div className="mx-auto max-w-3xl">
        <div className="flex justify-end">
          <LevelBadge level={item.level} />
        </div>
        <h2 className="mt-2 font-display text-[28px] font-extrabold leading-[1.1] tracking-tight">{offer.title}</h2>
        <p className="mt-1.5 text-[15px] text-muted">
          {offer.company.name}
          {offer.company.brand && ` · ${offer.company.brand}`}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-[var(--tint)] px-3 py-2.5">
              <dt className="text-[11.5px] font-medium text-muted">{label}</dt>
              <dd className="text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {about && (
          <section className="mt-5">
            <h3 className="mb-1.5 text-[13px] font-semibold text-muted">L&apos;entreprise</h3>
            <p className="text-[14.5px] leading-relaxed">{about}</p>
          </section>
        )}

        {item.missions.length > 0 && (
          <section className="mt-5">
            <h3 className="mb-1.5 text-[13px] font-semibold text-muted">Missions principales</h3>
            <ul className="list-disc space-y-1 pl-4 text-[14.5px] leading-normal">{item.missions.map((m) => <li key={m}>{m}</li>)}</ul>
          </section>
        )}

        {item.why && (
          <section className="mt-5 rounded-2xl border border-[var(--halo)] bg-[var(--tint)] p-4">
            <h3 className="font-display text-base font-bold text-[var(--accent)]">Pourquoi cette offre</h3>
            <p className="mt-1.5 text-[14.5px] leading-relaxed">{item.why}</p>
          </section>
        )}

        {details.loading && (
          <p role="status" className="mt-4 flex items-center gap-2 text-sm text-muted">
            <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
            Scout prépare tes atouts et les ajustements de CV pour ce poste…
          </p>
        )}
        {(details.strengths.length > 0 || item.watch.length > 0) && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {details.strengths.length > 0 && (
              <section>
                <h4 className="mb-1.5 text-[13px] font-semibold text-muted">Points forts</h4>
                <ul className="list-disc space-y-1 pl-4 text-[14.5px] leading-normal">{details.strengths.map((s) => <li key={s}>{s}</li>)}</ul>
              </section>
            )}
            {item.watch.length > 0 && (
              <section>
                <h4 className="mb-1.5 text-[13px] font-semibold text-muted">Points d&apos;attention</h4>
                <ul className="list-disc space-y-1 pl-4 text-[14.5px] leading-normal">{item.watch.map((s) => <li key={s}>{s}</li>)}</ul>
              </section>
            )}
          </div>
        )}

        {details.cvLevers.length > 0 && (
          <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
            <span className="font-semibold text-ink">Leviers CV : </span>
            {details.cvLevers.join(" · ")}
          </p>
        )}

        <div className="mt-6 space-y-3 border-t border-line pt-5">
          {description === null && <p className="text-sm text-muted">Chargement de l&apos;annonce…</p>}
          {description === "" && <p className="text-sm text-muted">La description complète est sur le site de l&apos;offre.</p>}
          {description !== null && description !== "" && description.length < 1200 && (
            <p className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted">
              Scout n&apos;a pu lire qu&apos;un extrait de cette offre. Lis-la en entier sur son site avant de te décider.
            </p>
          )}
          {blocks.map((b, i) =>
            b.kind === "heading" ? (
              <h4 key={i} className="pt-3 font-display text-lg font-bold">{b.text}</h4>
            ) : b.kind === "list" ? (
              <ul key={i} className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed">{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
            ) : (
              <p key={i} className="max-w-[62ch] text-[15px] leading-relaxed">{b.text}</p>
            ),
          )}
        </div>
        </div>
      </div>

      {nopeOpen && (
        <div className="px-6 pb-2">
          <NopeMenu onPick={(r) => { setNopeOpen(false); onNope(r); }} onCancel={() => setNopeOpen(false)} />
        </div>
      )}
      <footer className="flex shrink-0 gap-2 border-t border-line px-6 py-4">
        <button type="button" onClick={onSave} aria-pressed={item.saved} aria-label={item.saved ? "Retirer des sauvegardes" : "Sauvegarder"} className={`grid h-11 w-11 place-items-center rounded-xl border border-line bg-pill ${item.saved ? "text-[var(--accent)]" : "text-muted hover:text-ink"}`}>
          <SaveIcon filled={item.saved} className="h-[18px] w-[18px]" />
        </button>
        <button type="button" onClick={() => setNopeOpen((v) => !v)} aria-label="Pas pour moi" className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-pill text-muted hover:text-ink">
          <NopeIcon className="h-[18px] w-[18px]" />
        </button>
        {!loadDescription && (
          // Not in the demo (no account, no CV): adapt the CV to this offer before applying.
          <Link href={`/cv?offre=${offer.id}`} className="btn-soft h-11 max-sm:hidden">
            Adapter mon CV
          </Link>
        )}
        <button type="button" onClick={onApply} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-button px-4 text-sm font-semibold text-button-ink hover:opacity-90">
          {/greenhouse|lever\.co|ashbyhq/.test(offer.apply_url) ? `Postuler sur le site de ${offer.company.name}` : "Postuler sur l'annonce d'origine"}
          <ArrowIcon className="h-4 w-4" />
        </button>
      </footer>
    </aside>
  );

  // Full screen: a dialog over the content area (the sidebar stays visible); a click beside it or Escape closes it.
  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-40 flex justify-center bg-[#17151f]/45 p-4 backdrop-blur-sm md:left-[252px] md:p-6">
      {panel}
    </div>
  );
}
