import { z } from "zod";
import { get, run } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getWorkout } from "@/lib/queries";

const Body = z.union([
  z.object({ exerciseId: z.number().int() }),
  z.object({ name: z.string().trim().min(1, "Name the exercise").max(80), muscle: z.string().max(30).default("Other") }),
]);

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/workouts/[id]/exercises">) => {
  const workoutId = Number((await ctx.params).id);
  if (!(await get("SELECT 1 FROM workouts WHERE id = ?", [workoutId]))) return fail("Workout not found", 404);
  const body = Body.parse(await req.json());
  let exerciseId: number;
  if ("exerciseId" in body) {
    exerciseId = body.exerciseId;
  } else {
    const existing = await get<{ id: number }>("SELECT id FROM exercises WHERE name = ?", [body.name]);
    exerciseId =
      existing?.id ??
      (await run("INSERT INTO exercises (name, muscle, custom) VALUES (?, ?, 1)", [body.name, body.muscle])).lastInsertRowid;
  }
  const pos = await get<{ p: number }>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM workout_exercises WHERE workout_id = ?",
    [workoutId],
  );
  await run("INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, ?)", [
    workoutId,
    exerciseId,
    pos?.p ?? 0,
  ]);
  return json({ workout: await getWorkout(workoutId) }, 201);
});
