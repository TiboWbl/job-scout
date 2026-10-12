"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/browser";

// Sign-in with an email code: no password, no Google account needed. The code works on any device,
// unlike a link that must be opened in the same browser.
export function EmailLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"closed" | "email" | "code">("closed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback` } });
    setBusy(false);
    if (error) return setError("L'email n'a pas pu être envoyé. Vérifie l'adresse, ou réessaie dans une minute.");
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setError("Ce code ne fonctionne pas, ou il a expiré. Demande-en un nouveau.");
    router.push("/");
    router.refresh();
  }

  if (step === "closed")
    return (
      <button type="button" onClick={() => setStep("email")} className="flex w-full items-center justify-center rounded-2xl border border-line bg-surface px-5 py-4 text-[15px] font-semibold hover:bg-pill">
        Continuer avec mon email
      </button>
    );

  return (
    <form onSubmit={step === "email" ? send : verify} className="rounded-2xl border border-line bg-surface p-4">
      {step === "email" ? (
        <>
          <label htmlFor="login-email" className="text-sm font-semibold">
            Ton email
          </label>
          <input id="login-email" type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom@exemple.fr" className="mt-2 w-full rounded-xl bg-pill-solid px-3.5 py-3 text-[15px] focus:outline-none" />
          <button type="submit" disabled={busy} className="mt-3 w-full rounded-xl bg-button px-4 py-3 text-sm font-semibold text-button-ink disabled:opacity-60">
            {busy ? "Envoi…" : "Recevoir un code"}
          </button>
        </>
      ) : (
        <>
          <label htmlFor="login-code" className="text-sm font-semibold">
            Le code reçu à {email}
          </label>
          <input id="login-code" inputMode="numeric" autoComplete="one-time-code" required autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="123456" className="mt-2 w-full rounded-xl bg-pill-solid px-3.5 py-3 text-center font-display text-2xl tracking-[0.3em] focus:outline-none" />
          <button type="submit" disabled={busy || code.length < 6} className="mt-3 w-full rounded-xl bg-button px-4 py-3 text-sm font-semibold text-button-ink disabled:opacity-60">
            {busy ? "Vérification…" : "Me connecter"}
          </button>
          <button type="button" onClick={() => setStep("email")} className="mt-2 w-full text-[13px] text-muted underline underline-offset-2">
            Changer d&apos;email ou renvoyer un code
          </button>
        </>
      )}
      {error && <p className="mt-3 text-[13px] text-warn">{error}</p>}
    </form>
  );
}
