"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CloseIcon } from "@/components/icons";

// "Ma recherche" opens over the Offres page (the sidebar stays), like an offer but wider: it is opened
// by "?recherche=1", so the browser's back button closes it and saving (which returns to Offres) too.
export function SearchPanel({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = params.get("recherche") === "1";
  const close = () => router.push(pathname, { scroll: false });

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.push(pathname, { scroll: false });
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, pathname, router]);

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Ma recherche" onClick={close} className="fixed inset-0 z-40 flex justify-center bg-[#17151f]/45 p-4 backdrop-blur-sm md:left-[252px] md:p-6">
      <div onClick={(e) => e.stopPropagation()} className="animate-rise flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-line bg-page shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4 md:px-8">
          <h2 className="font-display text-3xl font-extrabold tracking-tight">Ma recherche</h2>
          <button type="button" onClick={close} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface hover:border-ink">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8">{children}</div>
      </div>
    </div>
  );
}

// The button of the Offres page that opens it.
export function EditSearchButton({ label = "Modifier ma recherche" }: { label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <button type="button" onClick={() => router.push(`${pathname}?recherche=1`, { scroll: false })} className="btn-soft">
      {label}
    </button>
  );
}
