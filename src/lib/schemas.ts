import { z } from "zod";

const n = z.coerce.number().min(0).max(100000);

export const FoodInput = z.object({
  name: z.string().trim().min(1, "Give each food a name").max(120),
  portion: z.string().max(120).default(""),
  grams: z.coerce.number().min(0).nullable().default(null),
  calories: n,
  protein: n,
  carbs: n,
  fat: n,
  fiber: n.default(0),
  confidence: z.coerce.number().min(0).max(1).nullable().default(null),
});

export const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

const optional = (max: number) => z.coerce.number().min(0).max(max).nullable().default(null);

export const CardioInput = z.object({
  date: ISODate,
  kind: z.string().trim().min(1).max(60).default("Incline treadmill"),
  minutes: z.coerce.number().min(0).max(600),
  incline: optional(50),
  speed: optional(60),
  distance_km: optional(500),
  calories: optional(10000),
  avg_hr: optional(250),
});
