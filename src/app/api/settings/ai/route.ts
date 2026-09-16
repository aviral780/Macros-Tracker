import { z } from "zod";
import { getAIConfig, PROVIDERS, saveAIConfig } from "@/lib/ai";
import { getSetting } from "@/lib/db";
import { handle, json } from "@/lib/http";

const mask = (k: string) => (k ? `••••${k.slice(-4)}` : "");

export const GET = handle(async () => {
  const cfg = await getAIConfig();
  const stored = (await getSetting("ai", { apiKey: "" })).apiKey;
  return json({
    provider: cfg.provider,
    model: cfg.model,
    insightModel: cfg.insightModel,
    baseUrl: cfg.baseUrl,
    keyHint: mask(cfg.apiKey),
    keyFromEnv: !stored && !!cfg.apiKey,
    providers: PROVIDERS,
  });
});

const Body = z.object({
  provider: z.enum(["gemini", "groq", "ollama", "anthropic"]),
  apiKey: z.string().trim().optional(),
  model: z.string().trim().max(120).default(""),
  insightModel: z.string().trim().max(120).default(""),
  baseUrl: z.string().trim().max(300).default(""),
});

export const PUT = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  const current = await getSetting("ai", { provider: "gemini", apiKey: "", model: "", baseUrl: "", insightModel: "" });
  // Keys are per-provider; switching provider without a new key clears the old one.
  const apiKey = body.apiKey !== undefined ? body.apiKey : current.provider === body.provider ? current.apiKey : "";
  await saveAIConfig({
    provider: body.provider,
    apiKey,
    model: body.model,
    insightModel: body.insightModel,
    baseUrl: body.baseUrl,
  });
  return json({ ok: true, keyHint: mask(apiKey) });
});
