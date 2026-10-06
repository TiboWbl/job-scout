// Prepares the public demo: Camille's profile, her sorted offers, a few favourites and a fictional
// tracking with dates relative to today. Usage: npm run demo:seed (run daily by the scheduled job).
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { createAdminClient } = await import("@/lib/supabase/admin");
const { ensureDemoProfile, seedDemoApplications } = await import("@/lib/demo");
const { runScoring } = await import("@/lib/scoring/engine");

const db = createAdminClient();
const id = await ensureDemoProfile(db);

for (let call = 0; call < 40; call++) {
  const progress = await runScoring(db, id, 50_000, db);
  if (progress.remaining === 0) break;
}

// Favourites: well-known companies of the shared directory whose career page Scout reads.
const { data: companies } = await db.from("companies").select("id, name").not("ats", "is", null).in("name", ["Doctolib", "Alan", "BlaBlaCar", "Qonto", "Pennylane"]);
await db.from("favorite_companies").delete().eq("user_id", id);
if (companies?.length) await db.from("favorite_companies").insert(companies.map((c) => ({ user_id: id, company_id: c.id, input: c.name })));

const applications = await seedDemoApplications(db, id);
console.log(`démo prête : ${companies?.length ?? 0} favorites, ${applications} candidatures fictives`);
