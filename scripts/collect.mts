// Runs one collection pass from the command line. Usage: npm run collect
// Prints aggregated counts per source only (these logs may end up public in CI).
import { config } from "dotenv";

config({ path: ".env.local" });

const { createAdminClient } = await import("@/lib/supabase/admin");
const { runCollection } = await import("@/lib/collect/run");

const started = Date.now();
const reports = await runCollection(createAdminClient(), { log: (line: string) => console.log(line) });
const total = reports.reduce((n, r) => n + r.seen, 0);
const created = reports.reduce((n, r) => n + r.created, 0);
const failed = reports.filter((r) => r.error).length;
console.log(`\n${reports.length} sources, ${total} offres vues, ${created} nouvelles, ${failed} source(s) en erreur, ${Math.round((Date.now() - started) / 1000)} s`);
