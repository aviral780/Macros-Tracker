import { z } from "zod";
import { getAIConfig, listModels } from "@/lib/ai";
import { handle, json } from "@/lib/http";

const Body = z.object({
  provider: z.enum(["gemini", "groq", "ollama", "anthropic"]),
  apiKey: z.string().trim().optional(),
  baseUrl: z.string().trim().default(""),
});

/** Lists models using the key typed in the form, or the saved key for the same provider. */
export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  const saved = getAIConfig();
  const apiKey = body.apiKey || (saved.provider === body.provider ? saved.apiKey : "");
  const models = await listModels({ provider: body.provider, apiKey, model: "", baseUrl: body.baseUrl });
  return json({ models });
});
