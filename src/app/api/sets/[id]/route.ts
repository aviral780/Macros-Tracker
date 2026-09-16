import { z } from "zod";
import { get, run } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getWorkout } from "@/lib/queries";

async function workoutIdForSet(id: number) {
  const row = await get<{ workout_id: number }>(
    "SELECT we.workout_id FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id WHERE s.id = ?",
    [id],
  );
  return row?.workout_id;
}

const Patch = z.object({
  weight: z.coerce.number().min(0).max(1000).optional(),
  reps: z.coerce.number().int().min(0).max(200).optional(),
  warmup: z.boolean().optional(),
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/sets/[id]">) => {
  const id = Number((await ctx.params).id);
  const wid = await workoutIdForSet(id);
  if (!wid) return fail("Set not found", 404);
  const p = Patch.parse(await req.json());
  if (p.weight !== undefined) await run("UPDATE sets SET weight = ? WHERE id = ?", [p.weight, id]);
  if (p.reps !== undefined) await run("UPDATE sets SET reps = ? WHERE id = ?", [p.reps, id]);
  if (p.warmup !== undefined) await run("UPDATE sets SET warmup = ? WHERE id = ?", [p.warmup ? 1 : 0, id]);
  return json({ workout: await getWorkout(wid) });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/sets/[id]">) => {
  const id = Number((await ctx.params).id);
  const wid = await workoutIdForSet(id);
  if (!wid) return fail("Set not found", 404);
  await run("DELETE FROM sets WHERE id = ?", [id]);
  return json({ workout: await getWorkout(wid) });
});
