import "server-only";
import { z } from "zod";
import { getSetting, setSetting } from "./db";
import { rankModels } from "./models";
import type { AIProvider } from "./types";

type ProviderInfo = {
  label: string;
  baseUrl: string;
  needsKey: boolean;
  keyUrl?: string;
  fallbackModel: string;
  note: string;
};

export const PROVIDERS: Record<AIProvider, ProviderInfo> = {
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    needsKey: true,
    keyUrl: "https://aistudio.google.com/apikey",
    fallbackModel: "gemini-2.5-flash",
    note: "Free tier. Best free accuracy for mixed plates and regional dishes.",
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1/",
    needsKey: true,
    keyUrl: "https://console.groq.com/keys",
    fallbackModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    note: "Free tier. Very fast, less precise on portion sizes.",
  },
  ollama: {
    label: "Ollama (on this Mac)",
    baseUrl: "http://localhost:11434/v1/",
    needsKey: false,
    fallbackModel: "qwen2.5vl:7b",
    note: "Free and offline. Needs Ollama running with a vision model pulled.",
  },
  anthropic: {
    label: "Anthropic Claude",
    baseUrl: "https://api.anthropic.com/v1/",
    needsKey: true,
    keyUrl: "https://console.anthropic.com/settings/keys",
    fallbackModel: "claude-sonnet-5",
    note: "Paid, roughly a cent per photo. Highest accuracy.",
  },
};

export type AIConfig = { provider: AIProvider; apiKey: string; model: string; baseUrl: string };

const DEFAULT_CONFIG: AIConfig = { provider: "gemini", apiKey: "", model: "", baseUrl: "" };

export function getAIConfig(): AIConfig {
  const cfg = getSetting<AIConfig>("ai", DEFAULT_CONFIG);
  // Environment variables work as a fallback so the key can live in .env.local instead.
  if (!cfg.apiKey) {
    const env: Partial<Record<AIProvider, string | undefined>> = {
      gemini: process.env.GEMINI_API_KEY,
      groq: process.env.GROQ_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
    };
    cfg.apiKey = env[cfg.provider] ?? "";
  }
  return cfg;
}

export function saveAIConfig(cfg: AIConfig) {
  setSetting("ai", cfg);
}

function endpoint(cfg: AIConfig) {
  const base = cfg.baseUrl || PROVIDERS[cfg.provider].baseUrl;
  return base.endsWith("/") ? base : base + "/";
}

function unreachable(cfg: AIConfig) {
  if (cfg.provider === "ollama") {
    const host = new URL(endpoint(cfg)).host;
    return new AIError(`Couldn't reach Ollama at ${host}. Start the Ollama app, then try again.`);
  }
  return new AIError(`Couldn't reach ${PROVIDERS[cfg.provider].label}. Check your internet connection.`);
}

function headers(cfg: AIConfig) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey) h.Authorization = `Bearer ${cfg.apiKey}`;
  if (cfg.provider === "anthropic") {
    h["x-api-key"] = cfg.apiKey;
    h["anthropic-version"] = "2023-06-01";
  }
  return h;
}

export class AIError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

async function describeFailure(res: Response, cfg: AIConfig, body?: string) {
  const text = body ?? (await res.text().catch(() => ""));
  let detail = text.slice(0, 300);
  try {
    const j = JSON.parse(text);
    const e = Array.isArray(j) ? j[0]?.error : j.error;
    detail = e?.message ?? detail;
  } catch {}
  const who = PROVIDERS[cfg.provider].label;
  // Gemini reports a bad key as 400 INVALID_ARGUMENT rather than 401.
  if (res.status === 401 || res.status === 403 || /api[ _-]?key/i.test(detail))
    return new AIError(`${who} rejected the API key. Check it in Settings.`, 401);
  if (res.status === 429)
    return new AIError(`${who} rate limit reached. Wait a minute and try again, or switch provider in Settings.`, 429);
  if (res.status === 404)
    return new AIError(`${who} doesn't have the model "${cfg.model}". Open Settings and choose Detect models.`, 404);
  return new AIError(`${who} returned an error (${res.status}): ${detail}`);
}

/** Lists models the configured provider offers, most suitable for food photos first. */
export async function listModels(cfg: AIConfig): Promise<string[]> {
  let res: Response;
  try {
    res = await fetch(endpoint(cfg) + "models", { headers: headers(cfg), cache: "no-store" });
  } catch {
    throw unreachable(cfg);
  }
  if (!res.ok) throw await describeFailure(res, cfg);
  const json = (await res.json()) as { data?: { id: string }[] };
  const ids = (json.data ?? []).map((m) => m.id.replace(/^models\//, ""));
  return rankModels(cfg.provider, ids);
}

async function resolveModel(cfg: AIConfig) {
  if (cfg.model) return cfg.model;
  try {
    const [best] = await listModels(cfg);
    if (best) {
      saveAIConfig({ ...getSetting<AIConfig>("ai", DEFAULT_CONFIG), model: best });
      return best;
    }
  } catch {}
  return PROVIDERS[cfg.provider].fallbackModel;
}

const num = z.coerce.number().catch(0).transform((n) => (Number.isFinite(n) && n > 0 ? n : 0));

const AnalysisSchema = z.object({
  title: z.string().catch(""),
  items: z
    .array(
      z.object({
        name: z.string(),
        portion: z.string().catch(""),
        grams: num,
        calories: num,
        protein_g: num,
        carbs_g: num,
        fat_g: num,
        fiber_g: num,
        confidence: z.coerce.number().min(0).max(1).catch(0.6),
      }),
    )
    .catch([]),
  notes: z.string().catch(""),
});

export type Analysis = z.infer<typeof AnalysisSchema>;

const SYSTEM_PROMPT = `You are a registered dietitian who logs meals for a strength athlete. You estimate the nutrition of food from photos and descriptions as accurately as a careful human expert would.

How to work:
- Identify every distinct food and drink. List components separately when they are separable (e.g. rice, dal, sabzi, roti, raita, salad). Keep a dish as one item when it is inseparable (a burger, a sandwich, a bowl of curry).
- Estimate the portion actually present, not a standard serving. Use visual scale cues: a dinner plate is about 26 cm, a katori/small bowl holds about 150 ml, a spoon, hands, cans and packaging. For packaged foods, read labels if visible.
- Give weight in grams (ml for drinks) and a household measure ("2 medium rotis", "1 katori", "1 cup").
- Account for hidden calories: cooking oil, ghee, butter, cream, dressings, sauces and sugar in drinks. Fold them into the dish unless they are visibly separate.
- Base values on standard references (USDA FoodData Central, Indian Food Composition Tables for Indian dishes, restaurant data for chain items). Values are for the portion, not per 100 g.
- Keep numbers consistent: calories ≈ 4×protein + 4×carbs + 9×fat (+7×alcohol).
- If the user adds a note (e.g. "2 rotis, cooked in ghee", "only ate half"), it overrides what the image suggests.
- If you cannot see any food, return an empty items list and say so in notes.
- confidence is 0–1 and reflects how sure you are of both the identification and the portion.

Respond with JSON only, no markdown, matching exactly:
{"title": "short meal name", "items": [{"name": "food", "portion": "household measure", "grams": 0, "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0, "confidence": 0.0}], "notes": "one or two sentences on key assumptions"}`;

function extractJSON(text: string) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new AIError("The model didn't return any food data. Try again or add a short description.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

export async function analyzeFood(input: { imageDataUrl?: string; text?: string }): Promise<Analysis & { model: string }> {
  const cfg = getAIConfig();
  if (PROVIDERS[cfg.provider].needsKey && !cfg.apiKey) {
    throw new AIError("Add an API key in Settings to analyze food.", 400);
  }
  const model = await resolveModel(cfg);

  const userText = input.imageDataUrl
    ? `Log the food in this photo.${input.text ? `\nMy note: ${input.text}` : ""}`
    : `Log this meal: ${input.text}`;
  const content: unknown[] = [{ type: "text", text: userText }];
  if (input.imageDataUrl) content.push({ type: "image_url", image_url: { url: input.imageDataUrl } });

  const body: Record<string, unknown> = {
    model,
    temperature: 0.2,
    max_tokens: 8000,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content },
    ],
  };
  // JSON mode where the provider supports it; the prompt and parser cover the rest.
  if (cfg.provider !== "anthropic") body.response_format = { type: "json_object" };

  const call = (b: Record<string, unknown>) =>
    fetch(endpoint(cfg) + "chat/completions", {
      method: "POST",
      headers: headers(cfg),
      body: JSON.stringify(b),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });

  let res: Response;
  let errorBody: string | undefined;
  try {
    res = await call(body);
    if (res.status === 400 && body.response_format) {
      errorBody = await res.text();
      // Some models reject JSON mode; retry without it and rely on the prompt.
      if (/response_format|json/i.test(errorBody)) {
        const { response_format: _drop, ...rest } = body;
        void _drop;
        res = await call(rest);
        errorBody = undefined;
      }
    }
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") throw new AIError("The model took too long to answer. Try again.", 504);
    throw unreachable(cfg);
  }
  if (!res.ok) throw await describeFailure(res, cfg, errorBody);

  const json = (await res.json()) as { choices?: { message?: { content?: string | { text?: string }[] } }[] };
  const raw = json.choices?.[0]?.message?.content;
  const text = Array.isArray(raw) ? raw.map((p) => p.text ?? "").join("") : raw ?? "";
  let parsed: unknown;
  try {
    parsed = extractJSON(text);
  } catch (e) {
    if (e instanceof AIError) throw e;
    throw new AIError("The model's answer wasn't valid food data. Try again.");
  }
  return { ...AnalysisSchema.parse(parsed), model };
}
