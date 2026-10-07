"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RemoveFavorite({ companyId, name }: { companyId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/favorites", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) }).catch(() => null);
        router.refresh();
      }}
      aria-label={`Retirer ${name} de mes favorites`}
      className="btn-soft shrink-0 px-3 py-1.5 text-[13px] disabled:opacity-50"
    >
      Retirer
    </button>
  );
}
