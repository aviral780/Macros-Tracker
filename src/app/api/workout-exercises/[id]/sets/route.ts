import { z } from "zod";
import { get, run } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getWorkout } from "@/lib/queries";

const Body = z.object({
  weight: z.coerce.number().min(0).max(1000).default(0),
  reps: z.coerce.number().int().min(0).max(200).default(0),
  warmup: z.boolean().default(false),
});

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/workout-exercises/[id]/sets">) => {
  const weId = Number((await ctx.params).id);
  const we = await get<{ workout_id: number }>("SELECT workout_id FROM workout_exercises WHERE id = ?", [weId]);
  if (!we) return fail("Exercise not found", 404);
  const s = Body.parse(await req.json());
  const pos = await get<{ p: number }>("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM sets WHERE workout_exercise_id = ?", [weId]);
  await run("INSERT INTO sets (workout_exercise_id, position, weight, reps, warmup) VALUES (?, ?, ?, ?, ?)", [
    weId,
    pos?.p ?? 0,
    s.weight,
    s.reps,
    s.warmup ? 1 : 0,
  ]);
  return json({ workout: await getWorkout(we.workout_id) }, 201);
});
