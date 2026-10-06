"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Two steps, plainly worded: nothing is kept afterwards.
export function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      return setError("La suppression n'a pas abouti, réessaie.");
    }
    // The session belongs to a user that no longer exists: sign out and leave.
    await fetch("/auth/signout", { method: "POST" }).catch(() => null);
    router.replace("/login?compte=supprime");
    router.refresh();
  }

  return (
    <section className="rounded-[22px] border border-line bg-surface p-5 md:p-6">
      <h2 className="font-display text-xl font-bold tracking-tight">Ton compte</h2>
      <p className="mt-1 text-sm text-muted">
        Tu peux supprimer ton compte à tout moment : ta recherche, ce que Scout a retenu de ton CV, tes offres, ton suivi et tes favorites sont effacés aussitôt et définitivement.{" "}
        <a href="/confidentialite" className="font-medium text-ink underline underline-offset-4">Confidentialité</a>
      </p>
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="mt-4 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-muted hover:border-ink hover:text-ink">
          Supprimer mon compte
        </button>
      ) : (
        <div className="mt-4 rounded-2xl bg-warn-soft p-4 text-sm">
          <p className="font-semibold text-warn">Tout sera effacé, sans retour possible. On continue ?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={remove} disabled={busy} className="rounded-xl bg-warn px-4 py-2.5 font-semibold text-page disabled:opacity-50">
              {busy ? "Suppression…" : "Oui, tout supprimer"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="rounded-xl border border-line px-4 py-2.5 font-medium">
              Annuler
            </button>
          </div>
          {error && <p className="mt-2 text-warn">{error}</p>}
        </div>
      )}
    </section>
  );
}
