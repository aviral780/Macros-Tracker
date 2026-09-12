import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getCardio } from "@/lib/queries";

const dateForCardio = (id: number) =>
  (db.prepare("SELECT date FROM cardio WHERE id = ?").get(id) as { date: string } | undefined)?.date;

const Patch = z.object({
  minutes: z.coerce.number().min(0).max(600).optional(),
  incline: z.coerce.number().min(0).max(50).nullable().optional(),
  speed: z.coerce.number().min(0).max(60).nullable().optional(),
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/cardio/[id]">) => {
  const id = Number((await ctx.params).id);
  const date = dateForCardio(id);
  if (!date) return fail("Cardio entry not found", 404);
  const p = Patch.parse(await req.json());
  if (p.minutes !== undefined) db.prepare("UPDATE cardio SET minutes = ? WHERE id = ?").run(p.minutes, id);
  if (p.incline !== undefined) db.prepare("UPDATE cardio SET incline = ? WHERE id = ?").run(p.incline, id);
  if (p.speed !== undefined) db.prepare("UPDATE cardio SET speed = ? WHERE id = ?").run(p.speed, id);
  return json({ date, cardio: getCardio(date) });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/cardio/[id]">) => {
  const id = Number((await ctx.params).id);
  const date = dateForCardio(id);
  if (!date) return fail("Cardio entry not found", 404);
  db.prepare("DELETE FROM cardio WHERE id = ?").run(id);
  return json({ date, cardio: getCardio(date) });
});
