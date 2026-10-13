"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = { firstName: string | null; avatarUrl: string | null; isAdmin: boolean };

// Bottom of the sidebar: the Google photo and first name; a click opens the account menu.
export function AccountMenu({ firstName, avatarUrl, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-52 md:bottom-full md:top-auto md:mb-2 md:mt-0 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-sm text-ink shadow-xl md:left-0 md:right-auto">
          {isAdmin && (
            <Link href="/admin" role="menuitem" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 font-medium hover:bg-pill-solid">
              Admin
            </Link>
          )}
          <Link href="/parametres" role="menuitem" onClick={() => setOpen(false)} className="block rounded-xl px-3 py-2.5 font-medium hover:bg-pill-solid">
            Paramètres
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left font-medium hover:bg-pill-solid">
              Se déconnecter
            </button>
          </form>
        </div>
      )}
      {/* A phone shows the photo alone; the sidebar adds the first name, on a soft row. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Mon compte"
        // A soft tile at rest; on hover (or open) it takes the brand tint, like the active page above it.
        className={`flex items-center gap-2.5 rounded-[14px] text-left text-rail-text transition-colors md:w-full md:px-2.5 md:py-2 ${open ? "md:bg-violet-soft md:text-violet-ink" : "md:bg-pill-solid md:hover:bg-violet-soft md:hover:text-violet-ink"}`}
      >
        {avatarUrl && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- Google profile photo, external
          <img src={avatarUrl} alt="" width={32} height={32} referrerPolicy="no-referrer" onError={() => setAvatarFailed(true)} className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-soft text-sm font-semibold text-violet-ink">{firstName?.[0]?.toUpperCase() ?? "?"}</span>
        )}
        <span className="hidden min-w-0 flex-1 truncate text-sm font-semibold md:block">{firstName ?? "Mon compte"}</span>
      </button>
    </div>
  );
}
