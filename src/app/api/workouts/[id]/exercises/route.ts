import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getWorkout } from "@/lib/queries";

const Body = z.union([
  z.object({ exerciseId: z.number().int() }),
  z.object({ name: z.string().trim().min(1, "Name the exercise").max(80), muscle: z.string().max(30).default("Other") }),
]);

export const POST = handle(async (req: Request, ctx: RouteContext<"/api/workouts/[id]/exercises">) => {
  const workoutId = Number((await ctx.params).id);
  if (!db.prepare("SELECT 1 FROM workouts WHERE id = ?").get(workoutId)) return fail("Workout not found", 404);
  const body = Body.parse(await req.json());
  let exerciseId: number;
  if ("exerciseId" in body) {
    exerciseId = body.exerciseId;
  } else {
    const existing = db.prepare("SELECT id FROM exercises WHERE name = ?").get(body.name) as { id: number } | undefined;
    exerciseId =
      existing?.id ??
      Number(db.prepare("INSERT INTO exercises (name, muscle, custom) VALUES (?, ?, 1)").run(body.name, body.muscle).lastInsertRowid);
  }
  const pos = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM workout_exercises WHERE workout_id = ?").get(workoutId) as {
    p: number;
  };
  db.prepare("INSERT INTO workout_exercises (workout_id, exercise_id, position) VALUES (?, ?, ?)").run(workoutId, exerciseId, pos.p);
  return json({ workout: getWorkout(workoutId) }, 201);
});
