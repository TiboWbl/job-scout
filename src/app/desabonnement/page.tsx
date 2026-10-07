import Image from "next/image";
import Link from "next/link";

export const metadata = { title: "Email des coups de cœur" };

// Reached from the email's link: one button to confirm, nothing to sign in to.
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ u?: string; t?: string; fait?: string }> }) {
  const { u = "", t = "", fait } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-page px-4">
      <div className="w-full max-w-md rounded-[22px] bg-surface p-7 text-center">
        <Image src="/brand/scout-logo-120.png" width={48} height={48} alt="Scout" className="mx-auto rounded-xl" />
        {fait ? (
          <>
            <h1 className="mt-5 font-display text-2xl font-bold">C&apos;est fait</h1>
            <p className="mt-2 text-[15px] text-muted">Tu ne recevras plus l&apos;email des coups de cœur. Tu peux le réactiver quand tu veux dans les Paramètres de Scout.</p>
            <Link href="/" className="btn-soft mt-6 inline-block">
              Ouvrir Scout
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-5 font-display text-2xl font-bold">Ne plus recevoir l&apos;email des coups de cœur ?</h1>
            <p className="mt-2 text-[15px] text-muted">Tes offres et ta recherche ne changent pas : seul l&apos;email s&apos;arrête.</p>
            <form method="post" action={`/api/digest/unsubscribe?u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`} className="mt-6">
              <button type="submit" className="rounded-xl bg-button px-5 py-2.5 text-sm font-semibold text-button-ink">
                Me désabonner
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
