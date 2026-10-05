// Shown when the deployment is missing configuration. Lists variable names, never values.
const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_EMAIL"];
const OPTIONAL = ["MISTRAL_API_KEY", "NEXT_PUBLIC_LOGO_DEV_TOKEN"];

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  const optionalMissing = OPTIONAL.filter((k) => !process.env[k]);
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Configuration incomplète</h1>
      <p className="mt-4 leading-relaxed text-muted">Scout a besoin de ces variables d&apos;environnement pour démarrer (voir README).</p>
      <ul className="mt-6 space-y-2 font-mono text-sm">
        {missing.map((k) => (
          <li key={k} className="rounded-lg bg-warn-soft px-3 py-2 text-warn">{k}</li>
        ))}
        {missing.length === 0 && <li className="rounded-lg bg-success-soft px-3 py-2 text-success">Variables obligatoires présentes</li>}
      </ul>
      {optionalMissing.length > 0 && (
        <p className="mt-6 text-sm text-muted">
          Facultatives, absentes : {optionalMissing.join(", ")}. Sans clé Mistral, le classement utilise une évaluation automatique simplifiée.
        </p>
      )}
    </main>
  );
}
