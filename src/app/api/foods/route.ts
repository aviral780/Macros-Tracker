import { z } from "zod";
import { db } from "@/lib/db";
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
  const insert = db.prepare(
    `INSERT INTO food_entries (date, meal, name, portion, grams, calories, protein, carbs, fat, fiber, source, confidence, photo_id)
     VALUES (@date, @meal, @name, @portion, @grams, @calories, @protein, @carbs, @fat, @fiber, @source, @confidence, @photo_id)`,
  );
  const photo_id = body.photoId && db.prepare("SELECT 1 FROM photos WHERE id = ?").get(body.photoId) ? body.photoId : null;
  const ids = db.transaction(() =>
    body.items.map(
      (item) =>
        insert.run({ ...item, date: body.date, meal: body.meal, source: body.source, photo_id }).lastInsertRowid,
    ),
  )();
  return json({ ids }, 201);
});
