// Runs the real connectors and the scoring gates in memory, without a database.
// Usage: npx tsx scripts/dry-run.ts   (prints aggregate counts and a few sample decisions)
import { SEED_BOARDS, fetchBoard } from "@/lib/collect/connectors/ats";
import { prefilter } from "@/lib/scoring/prefilter";
import { relevance } from "@/lib/scoring/relevance";
import { PROFILE } from "../tests/fixtures/regression.ts";

const results = await Promise.allSettled(SEED_BOARDS.map(fetchBoard));
const offers = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
const failed = SEED_BOARDS.filter((_, i) => results[i].status === "rejected").map((b) => b.token);

const reasons = new Map<string, number>();
const kept: { title: string; company: string; loc: string; rel: number }[] = [];
for (const o of offers) {
  const gate = prefilter(
    { title: o.title, companyName: o.company.name, places: o.places, remote: o.remote, remote_scope: o.remoteScope, contract: o.contract, experience_min_years: o.experienceMinYears },
    PROFILE,
    PROFILE.experienceYears,
  );
  if (!gate.pass) {
    const key = gate.reason.replace(/\d+/g, "N");
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
    continue;
  }
  const rel = relevance(o.title, o.description, PROFILE);
  if (rel > 0) kept.push({ title: o.title, company: o.company.name, loc: o.locationRaw ?? "?", rel });
}

console.log(`${offers.length} offres collectées sur ${SEED_BOARDS.length - failed.length}/${SEED_BOARDS.length} pages carrière${failed.length ? ` (échecs : ${failed.join(", ")})` : ""}`);
console.log("\nÉcartées par les portes :");
for (const [r, n] of [...reasons.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(4)}  ${r}`);
console.log(`\nCandidates envoyées au LLM : ${kept.length}`);
for (const k of kept.sort((a, b) => b.rel - a.rel).slice(0, 25)) console.log(`  ${k.rel.toFixed(1).padStart(5)}  ${k.title} · ${k.company} · ${k.loc}`);
const suspicious = kept.filter((k) => /senior|lead|head|staff|principal|director/i.test(k.title) || /new york|boston|usa|united states|london|berlin/i.test(k.loc));
console.log(`\nCandidates suspectes (senior ou hors zone qui auraient passé) : ${suspicious.length}`);
for (const s of suspicious) console.log(`  ${s.title} · ${s.company} · ${s.loc}`);
