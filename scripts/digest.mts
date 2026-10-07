// Sends each person who asked for it an email with their new crushes, after the morning sort.
// Usage: npm run digest. Logs aggregated counts only (CI logs are public): no email, no offer.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const { createAdminClient } = await import("@/lib/supabase/admin");
const { sendDigests } = await import("@/lib/digest");

const result = await sendDigests(createAdminClient());
console.log(`${result.people} personne(s) abonnée(s), ${result.sent} email(s) envoyé(s), ${result.offers} coup(s) de cœur`);
