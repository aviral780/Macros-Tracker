import { z } from "zod";
import { all, run } from "@/lib/db";
import { handle, json } from "@/lib/http";
import { getPlan, getWorkout, getWorkoutHistory, nextSplitDay } from "@/lib/queries";
import { ISODate } from "@/lib/schemas";

export const GET = handle(async () => {
  const plan = await getPlan();
  const [templates, history, nextDay] = await Promise.all([
    all<{ name: string; id: number }>(
      `SELECT w.name, MAX(w.id) AS id FROM workouts w
       WHERE EXISTS (SELECT 1 FROM workout_exercises we WHERE we.workout_id = w.id)
       GROUP BY lower(w.name) ORDER BY MAX(w.date) DESC LIMIT 8`,
    ),
    getWorkoutHistory(40),
    nextSplitDay(plan),
  ]);
  return json({ history, templates, plan, nextDay });
});

const Body = z.object({
  date: ISODate,
  name: z.string().trim().min(1).max(60).default("Workout"),
  copyFrom: z.number().int().optional(),
  /** Seed the session from a split day's saved exercise list. */
  routineDay: z.string().trim().max(60).optional(),
});

export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  const created = await run("INSERT INTO workouts (date, name) VALUES (?, ?)", [body.date, body.name]);
  const wid = created.lastInsertRowid;

  if (body.copyFrom) {
    await run(
      `INSERT INTO workout_exercises (workout_id, exercise_id, position)
       SELECT ?, exercise_id, position FROM workout_exercises WHERE workout_id = ? ORDER BY position, id`,
      [wid, body.copyFrom],
    );
  } else if (body.routineDay) {
    await run(
      `INSERT INTO workout_exercises (workout_id, exercise_id, position)
       SELECT ?, exercise_id, position FROM routine_exercises WHERE day = ? COLLATE NOCASE ORDER BY position, id`,
      [wid, body.routineDay],
    );
  }
  return json({ workout: await getWorkout(wid) }, 201);
});
