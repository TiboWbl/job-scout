"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Invitee } from "@/lib/admin/stats";
import { useConfirm } from "@/components/confirm";

const seen = (iso: string | null) =>
  iso ? `Connecté·e le ${new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}` : "Pas encore connecté·e";

export function Invitations({ people, openLimit }: { people: Invitee[]; openLimit: number }) {
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

  const accounts = people.filter((p) => p.account);
  const openUsed = accounts.filter((p) => p.via === "open").length;
  const LABEL: Record<Invitee["via"], string> = { admin: "toi (admin)", "admin page": "invitée", env: "invitée (variable)", open: "inscription libre" };
  return (
    <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
      <p className="text-sm text-muted">
        {openLimit > 0
          ? `Inscription libre : ${openUsed} place${openUsed > 1 ? "s" : ""} utilisée${openUsed > 1 ? "s" : ""} sur ${openLimit}. Au-delà, ou pour être sûr qu'une personne entre, invite son adresse.`
          : "Inscription fermée : seules les adresses invitées entrent."}
      </p>
      <ul className="mt-3 divide-y divide-line text-sm">
        {people.map((p) => (
          <li key={p.email} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
            <span className="min-w-0 flex-1 truncate font-medium">{p.email}</span>
            <span className="rounded-full bg-pill-solid px-2.5 py-0.5 text-[12.5px] text-muted">{p.account ? LABEL[p.via] : "invitée, pas encore venue"}</span>
            <span className={p.lastSignIn ? "text-ink" : "text-muted"}>{p.account ? seen(p.lastSignIn) : ""}</span>
            {p.via === "admin page" && (
              <button type="button" disabled={busy} onClick={() => call("DELETE", p.email)} className="btn-soft py-1.5">
                Retirer l&apos;invitation
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) call("POST", email);
        }}
        className="mt-4 flex flex-wrap gap-2"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Adresse email de la personne"
          aria-label="Email à inviter"
          className="min-w-0 flex-1 rounded-xl border border-line bg-page px-3.5 py-2.5 text-sm"
        />
        <button type="submit" disabled={busy} className="rounded-xl bg-button px-5 py-2.5 text-sm font-semibold text-button-ink disabled:opacity-50">
          Inviter
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-warn">{error}</p>}
      <p className="mt-3 text-[13px] text-muted">La connexion par email marche pour tout le monde. Avec Google, tant que l&apos;application est en mode Test, l&apos;adresse doit aussi être dans les utilisateurs test de Google Cloud.</p>
      {dialog}
    </div>
  );
}
