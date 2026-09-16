import { z } from "zod";
import { get, run } from "@/lib/db";
import { handle, json } from "@/lib/http";
import { MEALS } from "@/lib/types";
import { FoodInput, ISODate } from "@/lib/schemas";

const Body = z.object({
  date: ISODate,
  meal: z.enum(MEALS),
  source: z.enum(["photo", "text", "manual", "recent"]),
  photoId: z.string().nullable().optional(),
  items: z.array(FoodInput).min(1, "Add at least one food"),
});

export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  const known = body.photoId ? await get("SELECT 1 FROM photos WHERE id = ?", [body.photoId]) : null;
  const photoId = known ? body.photoId! : null;

  const ids: number[] = [];
  for (const item of body.items) {
    const result = await run(
      `INSERT INTO food_entries (date, meal, name, portion, grams, calories, protein, carbs, fat, fiber, source, confidence, photo_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.date,
        body.meal,
        item.name,
        item.portion,
        item.grams,
        item.calories,
        item.protein,
        item.carbs,
        item.fat,
        item.fiber,
        body.source,
        item.confidence,
        photoId,
      ],
    );
    ids.push(result.lastInsertRowid);
  }
  return json({ ids }, 201);
});
