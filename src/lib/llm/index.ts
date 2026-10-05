// Provider-agnostic LLM access. Switching provider = changing LLM_PROVIDER.
// Callers only ever send redacted content: no name, email, phone or address reaches a provider.

export type Tier = "fast" | "strong";

export interface LlmProvider {
  readonly name: string;
  /** Returns the parsed JSON object produced by the model. */
  json(input: { system: string; user: string; tier: Tier }): Promise<unknown>;
}

// Free plan: ministral-14b allows 30 requests/minute. Overridable when the plan or model changes.
const MIN_INTERVAL_MS = Number(process.env.LLM_MIN_INTERVAL_MS) || 2100;
const MAX_RETRIES = 5;
// The free plan currently rate-limits mistral-small/medium to zero; ministral-14b is the most capable model it serves.
const DEFAULT_MODEL = "ministral-14b-2512";

let queue: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;

// Serialises calls inside this process so the rate limit holds even when batches run concurrently.
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

class MistralProvider implements LlmProvider {
  readonly name = "mistral";
  constructor(private apiKey: string) {}

  async json({ system, user, tier }: { system: string; user: string; tier: Tier }) {
    const model = tier === "fast" ? process.env.LLM_MODEL_FAST || DEFAULT_MODEL : process.env.LLM_MODEL_STRONG || DEFAULT_MODEL;
    for (let attempt = 0; ; attempt++) {
      const res = await throttled(() =>
        fetch("https://api.mistral.ai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
          }),
          signal: AbortSignal.timeout(45_000),
        }),
      );
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= MAX_RETRIES) throw new Error(`Mistral HTTP ${res.status} after ${MAX_RETRIES} retries`);
        const retryAfter = Number(res.headers.get("retry-after"));
        await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`Mistral HTTP ${res.status}`);
      const body = (await res.json()) as { choices: { message: { content: string } }[] };
      return JSON.parse(body.choices[0].message.content);
    }
  }
}

export function getLlm(): LlmProvider | null {
  const provider = (process.env.LLM_PROVIDER || "mistral").toLowerCase();
  if (provider === "mock") return null;
  if (provider === "mistral" && process.env.MISTRAL_API_KEY) return new MistralProvider(process.env.MISTRAL_API_KEY);
  // No usable provider configured: callers fall back to their deterministic heuristics.
  return null;
}
