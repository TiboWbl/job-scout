// The 11 non-regression cases. Gate cases always run; LLM cases need RUN_LLM_TESTS=1 and a Mistral key,
// since they check the prompt itself: `RUN_LLM_TESTS=1 npm test`.
import { config } from "dotenv";
import { describe, expect, it } from "vitest";
import { CASES, CV, PROFILE, gateInput } from "./fixtures/regression";
import { prefilter } from "@/lib/scoring/prefilter";
import { judgeBatch } from "@/lib/scoring/judge";
import { CvSummary } from "@/lib/domain/criteria";

config({ path: ".env.local" });
const LLM_ENABLED = process.env.RUN_LLM_TESTS === "1" && Boolean(process.env.MISTRAL_API_KEY);

describe("préfiltre", () => {
  for (const c of CASES) {
    const shouldExclude = c.expect.stage === "prefilter";
    it(`${c.name} · ${shouldExclude ? "exclue" : "passe la porte"}`, () => {
      const result = prefilter(gateInput(c), PROFILE, PROFILE.experienceYears);
      expect(result.pass).toBe(!shouldExclude);
    });
  }
});

describe.skipIf(!LLM_ENABLED)("jugement LLM", () => {
  const llmCases = CASES.filter((c) => c.expect.stage === "llm");

  it("classe chaque offre au niveau attendu", async () => {
    const inputs = llmCases.map((c, i) => ({
      id: `case-${i}`,
      title: c.title,
      company: c.company,
      location: c.location,
      contract: gateInput(c).contract,
      experienceRequired: gateInput(c).experience_min_years,
      description: c.description,
    }));
    const results = new Map();
    for (let i = 0; i < inputs.length; i += 5) {
      const batch = await judgeBatch(inputs.slice(i, i + 5), PROFILE, CvSummary.parse(CV), PROFILE.experienceYears);
      for (const [k, v] of batch) results.set(k, v);
    }

    const failures: string[] = [];
    llmCases.forEach((c, i) => {
      const j = results.get(`case-${i}`);
      const e = c.expect;
      if (e.stage !== "llm") return;
      if (!j) return failures.push(`${c.name} : pas de résultat`);
      if (!e.levels.includes(j.level)) failures.push(`${c.name} : niveau ${j.level}, attendu ${e.levels.join(" ou ")}`);
      if (e.interetBelow !== undefined && j.score_interet >= e.interetBelow) failures.push(`${c.name} : intérêt ${j.score_interet} ≥ ${e.interetBelow}`);
      if (e.chancesBelow !== undefined && j.score_chances >= e.chancesBelow) failures.push(`${c.name} : chances ${j.score_chances} ≥ ${e.chancesBelow}`);
      if (e.hasWatch && j.watch.length === 0) failures.push(`${c.name} : aucun point d'attention`);
    });
    expect(failures).toEqual([]);
  });
});
