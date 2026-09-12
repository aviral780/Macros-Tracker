import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json } from "@/lib/http";
import { getPlan, getRoutine, getRoutines } from "@/lib/queries";

export const GET = handle(() => json({ routines: getRoutines(getPlan()) }));

const Body = z.intersection(
  z.object({ day: z.string().trim().min(1).max(60) }),
  z.union([
    z.object({ exerciseId: z.number().int() }),
    z.object({ name: z.string().trim().min(1, "Name the exercise").max(80), muscle: z.string().max(30).default("Other") }),
  ]),
);

export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  let exerciseId: number;
  if ("exerciseId" in body) {
    exerciseId = body.exerciseId;
  } else {
    const existing = db.prepare("SELECT id FROM exercises WHERE name = ? COLLATE NOCASE").get(body.name) as
      | { id: number }
      | undefined;
    exerciseId =
      existing?.id ??
      Number(
        db.prepare("INSERT INTO exercises (name, muscle, custom) VALUES (?, ?, 1)").run(body.name, body.muscle)
          .lastInsertRowid,
      );
  }
  const pos = db
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM routine_exercises WHERE day = ? COLLATE NOCASE")
    .get(body.day) as { p: number };
  db.prepare("INSERT OR IGNORE INTO routine_exercises (day, exercise_id, position) VALUES (?, ?, ?)").run(
    body.day,
    exerciseId,
    pos.p,
  );
  return json({ day: body.day, exercises: getRoutine(body.day) }, 201);
});
