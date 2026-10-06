import Link from "next/link";
import { Rail } from "@/components/rail";

export const dynamic = "force-dynamic";

const ITEMS = [
  { href: "/demo", label: "Aujourd'hui" },
  { href: "/demo/offres", label: "Offres" },
  { href: "/demo/suivi", label: "Suivi" },
  { href: "/demo/recherche", label: "Ma recherche" },
];

// The public demo: the real product on real offers, for a fictional persona, without an account.
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const footer = (
    <div className="flex items-center gap-2.5 px-2 py-2">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-violet-soft text-sm font-semibold text-violet-ink">C</span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-medium text-rail-text">Camille</span>
        <span className="block text-xs text-muted">profil fictif</span>
      </span>
    </div>
  );
  return (
    <div className="flex min-h-screen flex-col gap-4 p-4 md:flex-row">
      <Rail items={ITEMS} firstName="Camille" avatarUrl={null} isAdmin={false} home="/demo" footer={footer} />
      <main className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-soft px-4 py-2.5 text-sm text-violet-ink">
          <span>
            <span className="font-semibold">Démo avec un profil fictif</span> · Offres réelles · Tout est modifiable, rien n&apos;est enregistré
          </span>
          <Link href="/" className="btn-soft py-1.5">
            Quitter la démo
          </Link>
        </div>
        {children}
      </main>
    </div>
  );
}
