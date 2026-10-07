"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Ask = { title: string; detail?: string; action?: string };

// Every deletion asks first: a click by mistake must never cost anything. `confirm()` resolves to the
// answer; `dialog` is rendered once by the component that asks.
export function useConfirm(): { confirm: (ask: Ask) => Promise<boolean>; dialog: ReactNode } {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);

  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setAsk(null);
  };

  useEffect(() => {
    if (!ask) return;
    confirmButton.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ask]);

  const confirm = (next: Ask) =>
    new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setAsk(next);
    });

  const dialog = ask ? (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-sm rounded-[22px] bg-surface p-6 shadow-xl">
        <h2 id="confirm-title" className="font-display text-lg font-bold">
          {ask.title}
        </h2>
        {ask.detail && <p className="mt-1.5 text-sm text-muted">{ask.detail}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="btn-soft">
            Annuler
          </button>
          <button ref={confirmButton} type="button" onClick={() => close(true)} className="rounded-xl bg-[#d14343] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#b93a3a]">
            {ask.action ?? "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}
