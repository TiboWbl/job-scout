"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type Action = { label: string; hint?: string; href: string };

const PAGES: Action[] = [
  { label: "Aujourd'hui", href: "/aujourdhui" },
  { label: "Offres", href: "/offres" },
  { label: "Entreprises", href: "/entreprises" },
  { label: "Suivi", href: "/suivi" },
  { label: "Mon CV", href: "/cv" },
  { label: "Ma recherche", href: "/recherche" },
  { label: "Paramètres", href: "/parametres" },
];
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// ⌘K (Ctrl+K) from any page: search the offers by company or title, open a page, add an offer found
// elsewhere. Also opened by the "Rechercher" button of the sidebar.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scout:command", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scout:command", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
  }, [open]);

  const actions = useMemo(() => {
    const q = query.trim();
    const list: Action[] = [];
    if (/^https?:\/\//i.test(q)) list.push({ label: "Ajouter cette offre à mon suivi", hint: "Scout la lit et la juge", href: `/suivi?ajouter=${encodeURIComponent(q)}` });
    else if (q) list.push({ label: `Chercher « ${q} » dans les offres`, hint: "entreprise ou intitulé", href: `/offres?q=${encodeURIComponent(q)}` });
    list.push(...PAGES.filter((p) => !q || fold(p.label).includes(fold(q))));
    if (!q || fold("ajouter une offre").includes(fold(q))) list.push({ label: "Ajouter une offre trouvée ailleurs", href: "/suivi?ajouter=1" });
    return list;
  }, [query]);

  function go(a: Action | undefined) {
    if (!a) return;
    setOpen(false);
    setQuery("");
    setActive(0);
    router.push(a.href);
  }

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Recherche rapide" onClick={() => setOpen(false)} className="fixed inset-0 z-50 flex items-start justify-center bg-[#17151f]/40 p-4 pt-[14vh] backdrop-blur-sm">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(actions.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") go(actions[active]);
          }}
          placeholder="Une entreprise, un intitulé, une page, ou l'adresse d'une offre"
          aria-label="Rechercher"
          className="w-full border-b border-line bg-transparent px-5 py-4 text-[15px] placeholder:text-muted focus:outline-none"
        />
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {actions.map((a, i) => (
            <li key={a.href + a.label}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(a)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm ${i === active ? "bg-pill-solid" : ""}`}
              >
                <span className="font-medium">{a.label}</span>
                {a.hint && <span className="text-[12.5px] text-muted">{a.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// The sidebar button that opens the palette, with the shortcut shown.
export function CommandButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("scout:command"))}
      className="mb-3 flex w-full items-center justify-between rounded-[14px] border border-line bg-surface px-3 py-2 text-sm text-muted hover:border-ink hover:text-ink max-md:hidden"
    >
      Rechercher
      <kbd className="rounded-md bg-pill-solid px-1.5 py-0.5 font-sans text-[11px]">⌘K</kbd>
    </button>
  );
}
