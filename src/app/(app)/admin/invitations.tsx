"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = { invited: string[]; fromEnv: string[] };

export function Invitations({ invited, fromEnv }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(method: "POST" | "DELETE", target: string) {
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
        {fromEnv.map((e) => (
          <li key={`env-${e}`} className="flex items-center justify-between py-2">
            <span>{e}</span>
            <span className="text-muted">variable d&apos;environnement</span>
          </li>
        ))}
        {invited.map((e) => (
          <li key={e} className="flex items-center justify-between py-2">
            <span>{e}</span>
            <button type="button" disabled={busy} onClick={() => call("DELETE", e)} className="text-muted underline-offset-4 hover:text-ink hover:underline">
              Retirer
            </button>
          </li>
        ))}
        {fromEnv.length + invited.length === 0 && <li className="py-2 text-muted">Personne d&apos;autre que toi pour l&apos;instant.</li>}
      </ul>
      <p className="mt-3 text-[13px] text-muted">
        Tant que l&apos;application Google est en mode Test, ajoute aussi l&apos;adresse dans les utilisateurs test de Google Cloud.
      </p>
    </div>
  );
}
