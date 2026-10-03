/**
 * OPTIONAL server-side OpenRouter fallback (deployer's own key).
 *
 * The primary LLM path is the z-ai sdk; when it is unavailable (e.g. on a
 * deployment where its credentials are not configured), the copilot and the
 * /api/v1/chat surface may fall back to OpenRouter using this module.
 *
 * Security posture:
 * - The key is read from SATHI_OPENROUTER_API_KEY (Vercel/env config only,
 *   never committed) and NEVER leaves the server for the client.
 * - This is the deployer's choice, separate from the end-user's device-local
 *   key in Settings (which talks to openrouter.ai directly from the browser).
 * - Every generated draft still passes the existing fail-closed validators
 *   (slot protocol / numbersAreGrounded) before it can reach a user.
 * - Respects the same kill switch (SATHI_LLM_ENABLED) and daily budget that
 *   gate the primary path (checked by the routes before calling in).
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 20_000;

export function serverOpenRouterKey(): string {
  return (process.env.SATHI_OPENROUTER_API_KEY ?? "").trim();
}

export function serverOpenRouterModel(): string {
  return (process.env.SATHI_OPENROUTER_MODEL ?? "openrouter/auto").trim() || "openrouter/auto";
}

/**
 * Generate a chat completion. Returns the message content, or null on ANY
 * failure (bad key, no credits, empty content, timeout, network) — callers
 * fail closed to deterministic text.
 *
 * max_tokens defaults to 900: `openrouter/auto` frequently routes to reasoning
 * models (e.g. deepseek-v4-flash) whose hidden chain-of-thought consumed the
 * previous 250-token ceiling entirely (finish_reason "length", content null).
 */
export async function generateViaOpenRouterServer(
  system: string,
  user: string,
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string | null> {
  const key = serverOpenRouterKey();
  if (!key) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const resp = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": process.env.SATHI_PUBLIC_URL ?? "https://sathi-pied.vercel.app",
        "X-Title": "Sathi Copilot",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverOpenRouterModel(),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: opts?.temperature ?? 0.2,
        max_tokens: opts?.maxTokens ?? 900,
      }),
    });
    clearTimeout(timer);
    if (!resp.ok) {
      console.warn("[openrouter-server] HTTP", resp.status);
      return null;
    }
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length < 5) return null;
    return content.trim();
  } catch (err) {
    console.warn("[openrouter-server] unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}
