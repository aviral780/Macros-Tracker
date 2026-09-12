import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getWorkout } from "@/lib/queries";

function workoutIdForSet(id: number) {
  const row = db
    .prepare("SELECT we.workout_id FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE s.id = ?")
    .get(id) as { workout_id: number } | undefined;
  return row?.workout_id;
}

const Patch = z.object({
  weight: z.coerce.number().min(0).max(1000).optional(),
  reps: z.coerce.number().int().min(0).max(200).optional(),
  warmup: z.boolean().optional(),
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/sets/[id]">) => {
  const id = Number((await ctx.params).id);
  const wid = workoutIdForSet(id);
  if (!wid) return fail("Set not found", 404);
  const p = Patch.parse(await req.json());
  if (p.weight !== undefined) db.prepare("UPDATE sets SET weight = ? WHERE id = ?").run(p.weight, id);
  if (p.reps !== undefined) db.prepare("UPDATE sets SET reps = ? WHERE id = ?").run(p.reps, id);
  if (p.warmup !== undefined) db.prepare("UPDATE sets SET warmup = ? WHERE id = ?").run(p.warmup ? 1 : 0, id);
  return json({ workout: getWorkout(wid) });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/sets/[id]">) => {
  const id = Number((await ctx.params).id);
  const wid = workoutIdForSet(id);
  if (!wid) return fail("Set not found", 404);
  db.prepare("DELETE FROM sets WHERE id = ?").run(id);
  return json({ workout: getWorkout(wid) });
});
