import { LoginButton } from "./login-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md animate-rise">
        <h1 className="font-display text-6xl font-extrabold tracking-tight">
          Scout<span className="text-brand">.</span>
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Toutes les offres qui te correspondent, expliquées, et le suivi de tes candidatures. Dans un seul onglet.
        </p>
        <div className="mt-10">
          <LoginButton />
        </div>
        {erreur && (
          <p className="mt-4 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">La connexion n&apos;a pas abouti. Tu peux réessayer.</p>
        )}
        <p className="mt-8 text-sm leading-relaxed text-muted">
          Scout est en accès sur invitation. Ton profil et ton suivi sont privés : personne d&apos;autre ne peut les voir.
        </p>
      </div>
    </main>
  );
}
