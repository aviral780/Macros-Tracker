import { get, run } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getWorkout } from "@/lib/queries";

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/workout-exercises/[id]">) => {
  const id = Number((await ctx.params).id);
  const row = await get<{ workout_id: number }>("SELECT workout_id FROM workout_exercises WHERE id = ?", [id]);
  if (!row) return fail("Exercise not found", 404);
  await run("DELETE FROM workout_exercises WHERE id = ?", [id]);
  return json({ workout: await getWorkout(row.workout_id) });
});
