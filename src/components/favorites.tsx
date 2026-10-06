"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AutoTextarea } from "@/components/auto-textarea";
import { CompanyLogo } from "@/components/company-logo";
import { CloseIcon } from "@/components/icons";

type Favorite = { input: string; company: { id: string; name: string; domain: string | null; brand: string | null; ats: string | null; careers_platform: string | null } };

const CHUNK = 8;
const TEMPLATE = "entreprise,site\nAcme Sport,https://www.acme-sport.fr/carrieres\nExemple Santé,\n";

export type Entry = { name?: string; site?: string };

const looksLikeSite = (x: string) => /^https?:\/\//i.test(x) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(x);

// "Acme Sport" or a URL per line, "Acme, Exemple" on one line, or CSV rows "company,site" (site optional).
// A row keeps its name and its site together: the name finds boards, the site finds the careers page.
export function parseEntries(text: string): Entry[] {
  return text
    .split(/\r?\n/)
    .flatMap((line): Entry[] => {
      const parts = line.split(/[,;\t]/).map((x) => x.trim());
      if (parts.length === 2 && (parts[1] === "" || looksLikeSite(parts[1]))) return [{ name: parts[0] || undefined, site: parts[1] || undefined }];
      return parts.map((p) => (looksLikeSite(p) ? { site: p } : { name: p }));
    })
    .filter((e) => (e.name || e.site) && !/^(entreprise|company|nom|name|site)$/i.test(e.name ?? ""));
}

// Sends entries in chunks so a long list never hits the serverless time limit, reporting progress.
export async function addFavorites(entries: Entry[], onProgress: (done: number) => void) {
  for (let i = 0; i < entries.length; i += CHUNK) {
    await fetch("/api/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries: entries.slice(i, i + CHUNK) }) }).catch(() => null);
    onProgress(Math.min(entries.length, i + CHUNK));
  }
}

export function Favorites() {
  const router = useRouter();
  const [items, setItems] = useState<Favorite[] | null>(null);
  const [draft, setDraft] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/favorites").catch(() => null);
    const data = await res?.json().catch(() => null);
    setItems((data?.favorites ?? []) as Favorite[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of the user's list
    load();
  }, [load]);

  async function add(entries: Entry[]) {
    if (entries.length === 0) return;
    setProgress({ done: 0, total: entries.length });
    await addFavorites(entries, (done) => setProgress({ done, total: entries.length }));
    setProgress(null);
    setDraft("");
    await load();
    router.refresh();
  }

  async function remove(id: string) {
    setItems((list) => list?.filter((f) => f.company.id !== id) ?? null);
    await fetch("/api/favorites", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId: id }) });
    router.refresh();
  }

  return (
    <section className="rounded-[22px] border border-line bg-surface p-5 md:p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">Mes entreprises favorites</h2>
      <p className="mt-1 text-sm text-muted">
        Les entreprises où tu rêverais de travailler. Scout surveille leur page carrière à chaque collecte et signale leurs offres. Elles ne limitent jamais ta recherche.
      </p>

      <AutoTextarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        minRows={3}
        placeholder={"Une entreprise par ligne, ou l'adresse de sa page carrière\nEx. Acme Sport\nhttps://www.acme-sport.fr/carrieres"}
        aria-label="Entreprises à ajouter"
        className="mt-4 w-full resize-none rounded-2xl border border-line bg-pill-solid p-4 text-[15px] leading-relaxed placeholder:text-muted focus:border-ink focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => add(parseEntries(draft))} disabled={!draft.trim() || progress !== null} className="rounded-xl bg-button px-5 py-2.5 text-sm font-semibold text-button-ink disabled:opacity-40">
          Ajouter
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await add(parseEntries(await file.text()));
            e.target.value = "";
          }}
        />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={progress !== null} className="rounded-xl border border-line bg-pill px-4 py-2.5 text-sm font-medium hover:border-ink">
          Importer un CSV
        </button>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`} download="scout-entreprises.csv" className="btn-soft">
          Télécharger le modèle CSV
        </a>
      </div>

      {progress && (
        <div className="mt-4 rounded-2xl bg-brand-soft px-4 py-3 text-sm" role="status">
          <p className="font-semibold">
            Scout cherche leurs pages carrière : {progress.done} / {progress.total}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand/15">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${Math.max(6, Math.round((100 * progress.done) / progress.total))}%` }} />
          </div>
        </div>
      )}

      {items === null ? (
        <p className="mt-4 text-sm text-muted">Chargement…</p>
      ) : items.length > 0 ? (
        <ul className="mt-5 divide-y divide-line">
          {items.map((f) => (
            <li key={f.company.id} className="flex items-center gap-3 py-2.5">
              <CompanyLogo name={f.company.name} domain={f.company.domain} brand={f.company.brand} size={32} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{f.company.name}</span>
              {f.company.ats ? (
                <span className="whitespace-nowrap rounded-full bg-pill px-2.5 py-1 text-xs font-medium text-ink">Page carrière trouvée</span>
              ) : f.company.careers_platform ? (
                <span className="whitespace-nowrap rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-muted" title="Scout ne peut pas lire cette plateforme. Ses offres vues sur les moteurs d'emploi restent signalées.">
                  Offres sur {f.company.careers_platform}
                </span>
              ) : (
                <span className="whitespace-nowrap rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-muted" title="Ses offres vues sur les moteurs d'emploi restent signalées.">
                  Page carrière introuvable
                </span>
              )}
              <button type="button" onClick={() => remove(f.company.id)} aria-label={`Retirer ${f.company.name}`} className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-pill-solid hover:text-ink">
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
