import { z } from "zod";
import { handle, json } from "@/lib/http";
import { foodInsight } from "@/lib/insights";

const n = z.coerce.number().min(0).max(100000).catch(0);

const Body = z.object({
  name: z.string().trim().min(1).max(120),
  calories: n,
  protein: n,
  carbs: n,
  fat: n,
  fiber: n,
  grams: z.coerce.number().min(0).nullish().transform((v) => v ?? null),
});

export const POST = handle(async (req: Request) => {
  const b = Body.parse(await req.json());
  return json(await foodInsight(b.name, b));
});
