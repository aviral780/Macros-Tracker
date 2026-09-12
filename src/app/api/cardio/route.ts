import { db } from "@/lib/db";
import { isISODate, todayISO } from "@/lib/dates";
import { handle, json } from "@/lib/http";
import { getCardio } from "@/lib/queries";
import { CardioInput } from "@/lib/schemas";

export const GET = handle((req: Request) => {
  const param = new URL(req.url).searchParams.get("date");
  const date = isISODate(param) ? param : todayISO();
  return json({ date, cardio: getCardio(date) });
});

export const POST = handle(async (req: Request) => {
  const b = CardioInput.parse(await req.json());
  db.prepare(
    `INSERT INTO cardio (date, kind, minutes, incline, speed, distance_km, calories, avg_hr, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
  ).run(b.date, b.kind, b.minutes, b.incline, b.speed, b.distance_km, b.calories, b.avg_hr);
  return json({ date: b.date, cardio: getCardio(b.date) }, 201);
});
