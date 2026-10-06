// Scores what is new for every person, after each collection. Usage: npm run score:all
// Logs aggregated counts only: these logs are public in CI (no email, no profile, no per-person score).
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { createAdminClient } = await import("@/lib/supabase/admin");
const { runScoring } = await import("@/lib/scoring/engine");

const db = createAdminClient();
const started = Date.now();
const { data: profiles } = await db.from("profiles").select("id").not("onboarded_at", "is", null);

let judged = 0;
let unfinished = 0;
for (const { id } of profiles ?? []) {
  // Same engine as the site, without the serverless time limit: calls until nothing is left.
  for (let call = 0; call < 40; call++) {
    const progress = await runScoring(db, id, 50_000);
    judged += progress.scoredNow;
    if (progress.remaining === 0) break;
    if (call === 39) unfinished++;
  }
}
console.log(`${profiles?.length ?? 0} profil(s), ${judged} offre(s) triée(s), ${unfinished} profil(s) à terminer au prochain passage, ${Math.round((Date.now() - started) / 1000)} s`);
