import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/http";
import { getWorkout, getWorkoutHistory } from "@/lib/queries";
import { ISODate } from "@/lib/schemas";

export const GET = handle(() => {
  const templates = db
    .prepare(
      `SELECT w.name, MAX(w.id) AS id FROM workouts w
       WHERE EXISTS (SELECT 1 FROM workout_exercises we WHERE we.workout_id = w.id)
       GROUP BY lower(w.name) ORDER BY MAX(w.date) DESC LIMIT 8`,
    )
    .all() as { name: string; id: number }[];
  return json({ history: getWorkoutHistory(40), templates });
});

const Body = z.object({
  date: ISODate,
  name: z.string().trim().min(1).max(60).default("Workout"),
  copyFrom: z.number().int().optional(),
});

export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  const id = db.transaction(() => {
    const wid = Number(
      db.prepare("INSERT INTO workouts (date, name) VALUES (?, ?)").run(body.date, body.name).lastInsertRowid,
    );
    if (body.copyFrom) {
      db.prepare(
        `INSERT INTO workout_exercises (workout_id, exercise_id, position)
         SELECT ?, exercise_id, position FROM workout_exercises WHERE workout_id = ? ORDER BY position, id`,
      ).run(wid, body.copyFrom);
    }
    return wid;
  })();
  return json({ workout: getWorkout(id) }, 201);
});
