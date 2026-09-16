import { z } from "zod";
import { get, run } from "@/lib/db";
import { handle, json } from "@/lib/http";
import { getPlan, getRoutine, getRoutines } from "@/lib/queries";

export const GET = handle(async () => json({ routines: await getRoutines(await getPlan()) }));

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
    const existing = await get<{ id: number }>("SELECT id FROM exercises WHERE name = ? COLLATE NOCASE", [body.name]);
    exerciseId =
      existing?.id ??
      (await run("INSERT INTO exercises (name, muscle, custom) VALUES (?, ?, 1)", [body.name, body.muscle]))
        .lastInsertRowid;
  }
  const pos = await get<{ p: number }>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM routine_exercises WHERE day = ? COLLATE NOCASE",
    [body.day],
  );
  await run("INSERT OR IGNORE INTO routine_exercises (day, exercise_id, position) VALUES (?, ?, ?)", [
    body.day,
    exerciseId,
    pos?.p ?? 0,
  ]);
  return json({ day: body.day, exercises: await getRoutine(body.day) }, 201);
});
