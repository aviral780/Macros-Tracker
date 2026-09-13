import type { AIProvider } from "./types";

function versionOf(id: string) {
  const m = id.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

/** Vision-capable local models, best first. */
const OLLAMA_PREFERENCE = [/qwen[\d.]*-?vl/, /llama4/, /mistral-small3/, /gemma3(?!.*:1b)/, /llama3\.2-vision/, /minicpm-v/, /llava/, /moondream/];

/** Orders a provider's model list so the best choice for food photos comes first; drops unsuitable models. */
export function rankModels(provider: AIProvider, ids: string[]) {
  const score = (id: string) => {
    const s = id.toLowerCase();
    if (provider === "gemini") {
      if (!s.startsWith("gemini")) return -1;
      if (/(embedding|image|tts|audio|live|aqa|robotics|computer|native)/.test(s)) return -1;
      let v = versionOf(s) * 10;
      if (s.includes("flash")) v += 100; // generous free-tier limits and fast
      if (s.includes("lite")) v -= 60;
      if (/(preview|exp)/.test(s)) v -= 30;
      if (s.includes("latest")) v -= 5;
      return v;
    }
    if (provider === "groq") {
      if (/(llama-4|vision|vl)/.test(s)) return 100 + (s.includes("maverick") ? 5 : 0);
      return -1;
    }
    if (provider === "ollama") {
      const rank = OLLAMA_PREFERENCE.findIndex((re) => re.test(s));
      return rank === -1 ? 0 : 100 - rank * 10;
    }
    if (provider === "anthropic") {
      if (!s.startsWith("claude")) return -1;
      return versionOf(s.replace(/^claude-\D+/, "")) * 10 + (s.includes("sonnet") ? 5 : 0) - (s.includes("haiku") ? 3 : 0);
    }
    return 0;
  };
  return ids
    .map((id) => ({ id, s: score(id) }))
    .filter((m) => m.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((m) => m.id);
}

/**
 * Free-tier request caps are per model, and the newest model has the smallest one
 * (20/day on gemini-3.8-flash). Text insights don't need that model, so they get
 * ranked toward the lite tiers, which carry far larger allowances.
 */
export function rankInsightModels(provider: AIProvider, ids: string[]) {
  if (provider !== "gemini") return rankModels(provider, ids);
  const score = (id: string) => {
    const s = id.toLowerCase();
    if (!s.startsWith("gemini")) return -1;
    if (/(embedding|image|tts|audio|live|aqa|robotics|computer|native|transcribe|omni)/.test(s)) return -1;
    if (s.includes("pro")) return -1; // smallest free allowance of the lot
    let v = versionOf(s) * 10;
    if (s.includes("lite")) v += 200;
    else if (s.includes("flash")) v += 100;
    if (/(preview|exp)/.test(s)) v -= 50;
    if (s.includes("latest")) v -= 5;
    return v;
  };
  return ids
    .map((id) => ({ id, s: score(id) }))
    .filter((m) => m.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map((m) => m.id);
}
