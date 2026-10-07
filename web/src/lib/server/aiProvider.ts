import type { AIStatus, AIState } from "@/lib/engine/aiStatus";

// Fixed destinations prevent sending credentials to a user-supplied URL.
const PROVIDERS = {
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", key: "SATHI_GROQ_API_KEY", modelEnv: "SATHI_GROQ_MODEL", model: "llama-3.3-70b-versatile" },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", key: "SATHI_OPENROUTER_API_KEY", modelEnv: "SATHI_OPENROUTER_MODEL", model: "openrouter/free" },
  openai: { url: "https://api.openai.com/v1/chat/completions", key: "SATHI_OPENAI_API_KEY", modelEnv: "SATHI_OPENAI_MODEL", model: "gpt-4.1-mini" },
} as const;
type Provider = keyof typeof PROVIDERS;

function selectedProvider(): Provider | null {
  const explicit = process.env.SATHI_AI_PROVIDER?.trim().toLowerCase();
  if (explicit) return Object.hasOwn(PROVIDERS, explicit) ? explicit as Provider : null;
  return (Object.keys(PROVIDERS) as Provider[]).find(p => process.env[PROVIDERS[p].key]?.trim()) ?? null;
}

/** Only public metadata; keys stay inside generateServerAI. */
export function serverAIStatus(): AIStatus {
  const provider = selectedProvider();
  const model = provider ? process.env[PROVIDERS[provider].modelEnv]?.trim() || PROVIDERS[provider].model : null;
  const state = process.env.SATHI_LLM_ENABLED === "false" ? "disabled"
    : process.env.SATHI_AI_PROVIDER?.trim() && !provider ? "invalid_provider"
    : !provider || !process.env[PROVIDERS[provider].key]?.trim() ? "not_configured" : "ready";
  return { state, provider, model };
}

/** Explicit configuration skips the legacy SDK, even for a missing/invalid key. */
export function hasServerAISelection(): boolean {
  return Boolean(process.env.SATHI_AI_PROVIDER?.trim() || selectedProvider());
}

export interface AIGeneration extends AIStatus { content: string | null }

export async function generateServerAI(
  system: string, user: string, opts?: { maxTokens?: number; temperature?: number },
): Promise<AIGeneration> {
  const status = serverAIStatus();
  const result = (state: AIState, content: string | null = null): AIGeneration => ({ ...status, state, content });
  if (status.state !== "ready" || !status.provider || status.provider === "z-ai") return result(status.state);
  const config = PROVIDERS[status.provider];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const resp = await fetch(config.url, {
      method: "POST", signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env[config.key]!.trim()}`,
        "Content-Type": "application/json",
        ...(status.provider === "openrouter" ? {
          "HTTP-Referer": process.env.SATHI_PUBLIC_URL ?? "https://sathi-pied.vercel.app",
          "X-Title": "Sathi Copilot",
        } : {}),
      },
      body: JSON.stringify({
        model: status.model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: opts?.temperature ?? 0.2, max_tokens: opts?.maxTokens ?? 900,
      }),
    });
    // Never return or log provider error bodies: they may contain sensitive data.
    if (!resp.ok) return result(
      resp.status === 401 || resp.status === 403 ? "invalid_key"
      : resp.status === 402 ? "no_credits" : resp.status === 429 ? "rate_limited"
      : resp.status === 404 ? "model_unavailable" : "unavailable",
    );
    const data = await resp.json() as { choices?: { message?: { content?: unknown } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length < 5 || content.trim().length > 4000) return result("empty_response");
    return result("ready", content.trim());
  } catch {
    return result("unavailable");
  } finally {
    clearTimeout(timer);
  }
}
