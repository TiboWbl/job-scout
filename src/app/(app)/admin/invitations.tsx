"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Invitee } from "@/lib/admin/stats";
import { useConfirm } from "@/components/confirm";

const seen = (iso: string | null) =>
  iso ? `Connecté·e le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : "Pas encore connecté·e";

export function Invitations({ people }: { people: Invitee[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  async function call(method: "POST" | "DELETE", target: string) {
    if (method === "DELETE" && !(await confirm({ title: `Retirer l'invitation de ${target} ?`, detail: "Cette personne ne pourra plus se connecter à Scout.", action: "Retirer" }))) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/invitations", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: target }) });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return setError(data?.error ?? "Action impossible.");
    if (method === "POST") setEmail("");
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) call("POST", email);
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="adresse Gmail de la personne"
          aria-label="Email à inviter"
          className="min-w-0 flex-1 rounded-xl border border-line bg-page px-3.5 py-2.5 text-sm"
        />
        <button type="submit" disabled={busy} className="rounded-xl bg-button px-5 py-2.5 text-sm font-semibold text-button-ink disabled:opacity-50">
          Inviter
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-warn">{error}</p>}
      <ul className="mt-4 divide-y divide-line text-sm">
        {people.map((p) => (
          <li key={p.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span className="min-w-0 flex-1 truncate font-medium">{p.email}</span>
            <span className={p.lastSignIn ? "text-ink" : "text-muted"}>{seen(p.lastSignIn)}</span>
            {p.via === "admin page" ? (
              <button type="button" disabled={busy} onClick={() => call("DELETE", p.email)} className="btn-soft py-1.5">
                Retirer
              </button>
            ) : (
              <span className="text-muted">{p.via === "admin" ? "toi (admin)" : "variable d'environnement"}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-muted">
        Tant que l&apos;application Google est en mode Test, ajoute aussi l&apos;adresse dans les utilisateurs test de Google Cloud.
      </p>
      {dialog}
    </div>
  );
}
