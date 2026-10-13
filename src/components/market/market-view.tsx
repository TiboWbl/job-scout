import type { SupabaseClient } from "@supabase/supabase-js";
import { marketPage } from "@/lib/market/view";
import { CompaniesBlock, ExperienceBlock, RemoteBlock, SalaryBlock } from "./blocks";
import { MarketSkills } from "./skills";
import { ShareMarket } from "./share";

const TONES: Record<string, string> = {
  ajouter: "bg-peach-soft text-peach-ink",
  valoriser: "bg-mint-soft text-mint-ink",
  relativiser: "bg-violet-soft text-violet-ink",
  cibler: "bg-sky-soft text-sky-ink",
};
const LABELS: Record<string, string> = { ajouter: "À ajouter", valoriser: "À valoriser", relativiser: "À relativiser", cibler: "À cibler" };
const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" });

// The market of the role sought: what the offers really ask for, how it moves, what it means for the
// person this week. Counted in the offers themselves, every figure can be checked.
export async function MarketView({ db, userId, base = "" }: { db: SupabaseClient; userId: string; base?: string }) {
  const page = await marketPage(db, userId);
  if (!page) {
    return (
      <div className="px-1 pb-16 pt-3 md:px-2">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">Ton marché</h1>
        <p className="mt-4 rounded-2xl bg-surface p-6 text-muted">Dis à Scout quel métier tu cherches, et il te montre ce que ses offres demandent vraiment.</p>
      </div>
    );
  }
  const { today: m, trend, since, actions } = page;
  const demoCard = base ? ((await db.from("market_cards").select("id").eq("profile_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.id as string | undefined) : undefined;
  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight">Ton marché</h1>
          <p className="mt-2 text-[15px] text-muted">
            {m.role} · {m.total.toLocaleString("fr-FR")} offres en ligne · {m.newThisWeek} cette semaine
          </p>
        </div>
        {base ? demoCard && <ShareMarket demoCard={demoCard} /> : <ShareMarket />}
      </div>

      {actions.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-2xl font-bold">Cette semaine, pour toi</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            {actions.map((a) => (
              <li key={a.titre} className="flex flex-col rounded-[22px] border border-line bg-surface p-5">
                <span className={`self-start rounded-full px-2.5 py-1 text-[12px] font-semibold ${TONES[a.kind]}`}>{LABELS[a.kind]}</span>
                <h3 className="mt-3 font-display text-lg font-bold leading-snug">{a.titre}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{a.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 rounded-[22px] border border-line bg-surface p-5 md:p-7">
        <h2 className="font-display text-2xl font-bold">Ce que demandent les offres</h2>
        <p className="mb-5 mt-1 text-sm text-muted">
          La part des offres qui citent chaque compétence.{since ? ` Évolution depuis le ${day(since)}.` : ""}
        </p>
        <MarketSkills skills={m.skills} trend={trend} mine={m.mine} personal since={since ? day(since) : null} />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ExperienceBlock m={m} />
        <SalaryBlock m={m} />
        <RemoteBlock m={m} />
      </div>

      <div className="mt-10">
        <CompaniesBlock m={m} base={base} />
      </div>
    </div>
  );
}
