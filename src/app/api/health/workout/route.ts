import { z } from "zod";
import { run } from "@/lib/db";
import { isISODate, todayISO } from "@/lib/dates";
import { handle, json } from "@/lib/http";
import { getCardio, getPlan, getWorkoutsForDate, nextSplitDay } from "@/lib/queries";

/** Shortcuts sends everything as text, and sends "" for a sample it couldn't read. */
const numOrNull = (max: number) =>
  z
    .preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().min(0).max(max).nullable())
    .default(null);

const Body = z.object({
  type: z.string().default(""),
  date: z.string().optional(),
  start: z.string().optional(),
  durationMin: numOrNull(1440),
  calories: numOrNull(20000),
  avgHeartRate: numOrNull(250),
  distanceKm: numOrNull(500),
  externalId: z.string().max(200).nullish(),
});

const CARDIO = /walk|run|tread|ellipt|cycl|bike|spin|stair|row|hiit|cardio|hike|swim|dance/i;
const STRENGTH = /strength|lift|weight|resist/i;

/** Apple sends a full timestamp; its first 10 characters are the local calendar day. */
function dayFrom(b: z.infer<typeof Body>) {
  if (b.date && isISODate(b.date)) return b.date;
  const head = (b.start ?? "").slice(0, 10);
  return isISODate(head) ? head : todayISO();
}

export const POST = handle(async (req: Request) => {
  const b = Body.parse(await req.json());
  const date = dayFrom(b);
  const isCardio = STRENGTH.test(b.type) ? false : CARDIO.test(b.type) || (b.distanceKm ?? 0) > 0;

  if (isCardio) {
    const plan = await getPlan();
    await run(
      `INSERT INTO cardio (date, kind, minutes, distance_km, calories, avg_hr, source, external_id)
       VALUES (?, ?, ?, ?, ?, ?, 'health', ?)
       ON CONFLICT(external_id) DO UPDATE SET
         minutes = excluded.minutes,
         distance_km = excluded.distance_km,
         calories = excluded.calories,
         avg_hr = excluded.avg_hr`,
      [
      date,
      b.type.trim() || plan.cardioKind,
      b.durationMin ?? 0,
      b.distanceKm,
      b.calories,
      b.avgHeartRate,
      b.externalId || null,
      ],
    );
    return json({ ok: true, kind: "cardio", date, cardio: await getCardio(date) }, 201);
  }

  // Strength: top up the session already logged for that day, or open one named from the rotation.
  const existing = await getWorkoutsForDate(date);
  const target = existing.at(-1);
  const id = target
    ? target.id
    : (
        await run("INSERT INTO workouts (date, name, external_id) VALUES (?, ?, ?)", [
          date,
          await nextSplitDay(await getPlan()),
          b.externalId || null,
        ])
      ).lastInsertRowid;
  await run("UPDATE workouts SET duration_min = ?, calories = ?, avg_hr = ? WHERE id = ?", [
    b.durationMin,
    b.calories,
    b.avgHeartRate,
    id,
  ]);
  return json({ ok: true, kind: "strength", date, workoutId: id, created: !target }, 201);
});
