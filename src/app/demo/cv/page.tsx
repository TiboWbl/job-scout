import Link from "next/link";
import { Results, type HistoryRow } from "@/app/(app)/cv/cv-check";
import { demoContext } from "@/lib/demo-page";

export const metadata = { title: "Mon CV (démo)" };

// The demo's CV page: the analysis of Camille's fictional CV, as Scout makes it for anyone.
export default async function DemoCvPage() {
  const { db, userId } = await demoContext();
  const { data } = await db.from("cv_analyses").select("id, created_at, filename, total, result, suggestions, comparison, recruiter").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const h = data as HistoryRow | null;
  return (
    <div className="px-1 pb-16 pt-3 md:px-2">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Mon CV</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-muted">Le test ATS vérifie qu&apos;un logiciel de recrutement lit bien ton CV. La lecture recruteur dit ce qui convainc et ce qui manque. Ici, l&apos;analyse du CV fictif de Camille.</p>
      {h?.result ? (
        <Results analysis={{ id: h.id, createdAt: h.created_at, filename: h.filename, result: h.result, suggestions: h.suggestions ?? [], comparison: h.comparison, recruiter: h.recruiter ?? null, text: null }} pdfUrl={null} />
      ) : (
        <p className="mt-6 rounded-2xl bg-surface p-6 text-muted">L&apos;exemple d&apos;analyse arrive avec la prochaine mise à jour de la démo.</p>
      )}
      <Link href="/demo/marche" className="mt-10 flex items-center justify-between gap-4 rounded-[22px] bg-violet-soft p-5 text-violet-ink transition-shadow hover:shadow-md md:p-6">
        <span>
          <span className="block font-display text-xl font-bold">Ce que demandent les offres de son métier</span>
          <span className="mt-1 block text-[14px] opacity-80">Les compétences les plus citées, face à son CV.</span>
        </span>
        <span aria-hidden className="text-2xl">→</span>
      </Link>
    </div>
  );
}
