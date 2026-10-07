"use client";

import { useState } from "react";

export function DigestToggle({ initial, email }: { initial: boolean; email: string | null }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState(false);
  async function toggle() {
    const next = !on;
    setOn(next);
    setError(false);
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emailDigest: next }) }).catch(() => null);
    if (!res?.ok) {
      setOn(!next);
      setError(true);
    }
  }
  return (
    <div>
      <button type="button" role="switch" aria-checked={on} onClick={toggle} className="flex items-center gap-3 text-sm font-medium">
        <span className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-brand" : "bg-pill-solid"}`}>
          <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
        </span>
        {on ? "Activé" : "Désactivé"}
      </button>
      <p className="mt-2 text-[13px] text-muted">
        Un email par jour au plus, seulement s&apos;il y a de nouveaux coups de cœur{email ? `, envoyé à ${email}` : ""}.
      </p>
      {error && <p className="mt-2 text-sm text-warn">Le réglage n&apos;a pas été enregistré, réessaie.</p>}
    </div>
  );
}
