import { env } from "./env.ts";
import { generateSummary as run, mockProvider, type AiInput, type AiProvider } from "./ai-core.ts";
export { PROMPT_VERSION } from "./ai-core.ts";

const anthropic = (): AiProvider => ({
  name: "anthropic", model: env().ANTHROPIC_MODEL,
  async complete(system, user) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: AbortSignal.timeout(45_000),
      headers: { "content-type": "application/json", "x-api-key": env().ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: env().ANTHROPIC_MODEL, max_tokens: 700, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) throw new Error(`AI provider HTTP ${res.status}`);
    return ((await res.json()) as any).content?.map((c: any) => c.text ?? "").join("") ?? "";
  },
});

export const getAiProvider = (): AiProvider => (env().AI_PROVIDER === "anthropic" ? anthropic() : mockProvider());
export const generateSummary = (input: AiInput) => run(input, getAiProvider());
