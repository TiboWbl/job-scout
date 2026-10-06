import { CompanyLogo } from "@/components/company-logo";
import { DemoSearch } from "@/components/demo-search";
import { Criteria, CvSummary } from "@/lib/domain/criteria";
import { demoContext } from "@/lib/demo-page";

export default async function DemoRecherchePage() {
  const { db, userId } = await demoContext();
  const [{ data: profile }, { data: favorites }] = await Promise.all([
    db.from("profiles").select("criteria, search_text, cv_summary").eq("id", userId).single(),
    db.from("favorite_companies").select("company:companies(id, name, domain, brand)").eq("user_id", userId),
  ]);
  const criteria = Criteria.parse(profile?.criteria ?? {});
  const cv = CvSummary.safeParse(profile?.cv_summary);
  type Company = { id: string; name: string; domain: string | null; brand: string | null };

  return (
    <div className="max-w-5xl px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Ma recherche</h1>
      <section className="mt-6 rounded-[22px] border border-line bg-surface p-5 md:p-6">
        <h2 className="font-display text-xl font-bold tracking-tight">Ce que Camille a écrit</h2>
        <p className="mt-2 text-[15px] leading-relaxed">« {profile?.search_text} »</p>
        {cv.success && (
          <p className="mt-3 rounded-xl bg-pill-solid px-4 py-3 text-[14px]">
            <span className="font-semibold">Depuis son CV : </span>
            {[cv.data.education[0], cv.data.roles.slice(0, 2).join(", "), cv.data.skills.slice(0, 5).join(", ")].filter(Boolean).join(" · ")}
          </p>
        )}
      </section>

      <h2 className="mt-8 font-display text-2xl font-bold tracking-tight">Ce que Scout a compris</h2>
      <p className="mb-3 mt-1 text-sm text-muted">Tu peux tout modifier pour voir comment ça marche. En démo, rien n&apos;est enregistré.</p>
      <DemoSearch initial={criteria} />

      <section className="mt-8 rounded-[22px] border border-line bg-surface p-5 md:p-6">
        <h2 className="font-display text-xl font-bold tracking-tight">Ses entreprises favorites</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {((favorites ?? []) as unknown as { company: Company | null }[])
            .map((f) => f.company)
            .filter((c): c is Company => Boolean(c))
            .map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-full bg-pill-solid py-1.5 pl-1.5 pr-3.5 text-sm font-medium">
                <CompanyLogo name={c.name} domain={c.domain} brand={c.brand} size={24} />
                {c.name}
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
