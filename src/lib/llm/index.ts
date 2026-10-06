// Provider-agnostic LLM access. Switching provider = changing LLM_PROVIDER.
// Callers only ever send redacted content: no name, email, phone or address reaches a provider.

export type Tier = "fast" | "strong";

export interface LlmProvider {
  readonly name: string;
  /** Returns the parsed JSON object produced by the model. */
  json(input: { system: string; user: string; tier: Tier }): Promise<unknown>;
}

// Free plan: ministral-14b allows 30 requests/minute. Overridable when the plan or model changes.
export const MIN_INTERVAL_MS = Number(process.env.LLM_MIN_INTERVAL_MS) || 2100;
const MAX_RETRIES = 5;
// The free plan currently rate-limits mistral-small/medium to zero; ministral-14b is the most capable model it serves.
const DEFAULT_MODEL = "ministral-14b-2512";

let queue: Promise<void> = Promise.resolve();
let lastCallAt = 0;

// Spaces request starts inside this process to respect the per-minute limit. Requests then run
// side by side: one answer takes ~20 s, waiting for it before the next start would waste the quota.
function throttled<T>(task: () => Promise<T>): Promise<T> {
  const slot = queue.then(async () => {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  queue = slot;
  return slot.then(task);
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
        if (attempt >= MAX_RETRIES) throw new LlmUnavailableError(`Mistral HTTP ${res.status} after ${MAX_RETRIES} retries`);
        const retryAfter = Number(res.headers.get("retry-after"));
        await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new LlmUnavailableError(`Mistral HTTP ${res.status}`);
      const body = (await res.json()) as { choices: { message: { content: string } }[] };
      return JSON.parse(body.choices[0].message.content);
    }
  }
}

// Raised when no model can answer: callers surface a clear message and retry, never an approximate result.
export class LlmUnavailableError extends Error {
  constructor(cause?: unknown) {
    // The cause is a provider name or an HTTP status, never user content: safe to log.
    super(`LLM unavailable: ${String(cause ?? "unknown")}`, { cause });
    this.name = "LlmUnavailableError";
  }
}

export function getLlm(): LlmProvider {
  const provider = (process.env.LLM_PROVIDER || "mistral").toLowerCase();
  if (provider === "mistral" && process.env.MISTRAL_API_KEY) return new MistralProvider(process.env.MISTRAL_API_KEY);
  throw new LlmUnavailableError(`provider "${provider}" is not configured`);
}

export const LLM_UNAVAILABLE_MESSAGE = "Scout n'arrive pas à joindre l'IA pour le moment. Réessaie dans un instant.";
