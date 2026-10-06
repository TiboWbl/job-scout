import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const { CASES, CV, PROFILE, gateInput } = await import("../tests/fixtures/regression.ts");
const { getLlm } = await import("../src/lib/llm/index.ts");
const mod = await import("../src/lib/scoring/judge.ts");
const c: any = CASES.find((x: any) => x.name.startsWith("6."));
const orig = getLlm().json.bind(getLlm());
for (let i = 0; i < 4; i++) {
  const r = await mod.judgeBatch([{ id: "x", title: c.title, company: c.company, location: c.location, contract: "cdi", experienceRequired: 3, description: c.description }], PROFILE, (await import("../src/lib/domain/criteria.ts")).CvSummary.parse(CV), 1);
  const j = r.get("x"); console.log(j?.level, j?.score_interet, j?.excluded_reason, "| watch:", j?.watch.join(" / "));
}
