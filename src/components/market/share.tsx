"use client";

import { useState } from "react";

// A public card of the market, without anything from the CV: a link to send to a friend or post.
export function ShareMarket() {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "error">("idle");
  const [url, setUrl] = useState<string | null>(null);
  async function share() {
    setState("busy");
    const res = await fetch("/api/market/share", { method: "POST" }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data?.id) return setState("error");
    const link = `${window.location.origin}/carte/${data.id}`;
    setUrl(link);
    await navigator.clipboard?.writeText(link).catch(() => null);
    setState("copied");
  }
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button type="button" onClick={share} disabled={state === "busy"} className="btn-soft">
        {state === "busy" ? "Création du lien…" : state === "copied" ? "Lien copié" : "Partager la carte de mon marché"}
      </button>
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className="text-[12.5px] text-muted underline underline-offset-2">
          Voir la carte publique
        </a>
      )}
      {state === "error" && <p className="text-[12.5px] text-warn">Le lien n&apos;a pas pu être créé, réessaie.</p>}
    </div>
  );
}
