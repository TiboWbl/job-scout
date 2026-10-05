// Applies supabase/migrations/*.sql in order, once each. Usage: npm run db:migrate
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local" });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL is missing from .env.local");
  process.exit(1);
}

const dir = join(process.cwd(), "supabase/migrations");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

await client.connect();
await client.query("create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())");
const applied = new Set((await client.query("select name from public._migrations")).rows.map((r) => r.name));

for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  if (applied.has(file)) continue;
  const sql = readFileSync(join(dir, file), "utf8");
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("insert into public._migrations (name) values ($1)", [file]);
    await client.query("commit");
    console.log(`applied ${file}`);
  } catch (error) {
    await client.query("rollback");
    console.error(`failed ${file}:`, (error as Error).message);
    process.exit(1);
  }
}

await client.query("alter table public._migrations enable row level security");
await client.end();
console.log("database up to date");
