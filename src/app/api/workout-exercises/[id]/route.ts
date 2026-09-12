import { db } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getWorkout } from "@/lib/queries";

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/workout-exercises/[id]">) => {
  const id = Number((await ctx.params).id);
  const row = db.prepare("SELECT workout_id FROM workout_exercises WHERE id = ?").get(id) as { workout_id: number } | undefined;
  if (!row) return fail("Exercise not found", 404);
  db.prepare("DELETE FROM workout_exercises WHERE id = ?").run(id);
  return json({ workout: getWorkout(row.workout_id) });
});
