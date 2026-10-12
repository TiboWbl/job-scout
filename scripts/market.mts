// Today's market for every person (what the offers of their role ask for), after each sort.
// Usage: npm run market. Logs aggregated counts only (CI logs are public).
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { createAdminClient } = await import("@/lib/supabase/admin");
const { loadMarketDataset } = await import("@/lib/market/compute");
const { refreshMarket } = await import("@/lib/market/store");

const db = createAdminClient();
const started = Date.now();
const set = await loadMarketDataset(db);
const { data: profiles } = await db.from("profiles").select("id").not("onboarded_at", "is", null);
let done = 0;
let failed = 0;
for (const { id } of profiles ?? []) {
  const ok = await refreshMarket(db, set, id).catch(() => null);
  if (ok) done++;
  else failed++;
}
console.log(`Marchés : ${done} à jour, ${failed} en échec, ${set.rows.length} offres lues, ${Math.round((Date.now() - started) / 1000)} s`);
