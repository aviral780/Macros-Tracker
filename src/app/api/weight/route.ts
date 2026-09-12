import { z } from "zod";
import { db, getSetting, setSetting } from "@/lib/db";
import { handle, json } from "@/lib/http";
import { DEFAULT_PROFILE } from "@/lib/nutrition";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kg: z.coerce.number().min(30, "Weight looks off — use kilograms").max(300),
});

export const POST = handle(async (req: Request) => {
  const { date, kg } = Body.parse(await req.json());
  db.prepare("INSERT INTO body_weight (date, kg) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET kg = excluded.kg").run(date, kg);
  const latest = db.prepare("SELECT kg FROM body_weight ORDER BY date DESC LIMIT 1").get() as { kg: number };
  setSetting("profile", { ...getSetting("profile", DEFAULT_PROFILE), weightKg: latest.kg });
  return json({ ok: true });
});
