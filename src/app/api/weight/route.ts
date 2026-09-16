import { z } from "zod";
import { get, getSetting, run, setSetting } from "@/lib/db";
import { handle, json } from "@/lib/http";
import { DEFAULT_PROFILE } from "@/lib/nutrition";

const Body = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kg: z.coerce.number().min(30, "Weight looks off — use kilograms").max(300),
});

export const POST = handle(async (req: Request) => {
  const { date, kg } = Body.parse(await req.json());
  await run("INSERT INTO body_weight (date, kg) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET kg = excluded.kg", [date, kg]);
  const latest = await get<{ kg: number }>("SELECT kg FROM body_weight ORDER BY date DESC LIMIT 1");
  await setSetting("profile", { ...(await getSetting("profile", DEFAULT_PROFILE)), weightKg: latest?.kg ?? kg });
  return json({ ok: true });
});
