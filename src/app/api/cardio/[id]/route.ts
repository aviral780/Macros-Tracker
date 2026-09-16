import { z } from "zod";
import { get, run } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getCardio } from "@/lib/queries";

const dateForCardio = async (id: number) =>
  (await get<{ date: string }>("SELECT date FROM cardio WHERE id = ?", [id]))?.date;

const Patch = z.object({
  minutes: z.coerce.number().min(0).max(600).optional(),
  incline: z.coerce.number().min(0).max(50).nullable().optional(),
  speed: z.coerce.number().min(0).max(60).nullable().optional(),
});

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/cardio/[id]">) => {
  const id = Number((await ctx.params).id);
  const date = await dateForCardio(id);
  if (!date) return fail("Cardio entry not found", 404);
  const p = Patch.parse(await req.json());
  if (p.minutes !== undefined) await run("UPDATE cardio SET minutes = ? WHERE id = ?", [p.minutes, id]);
  if (p.incline !== undefined) await run("UPDATE cardio SET incline = ? WHERE id = ?", [p.incline, id]);
  if (p.speed !== undefined) await run("UPDATE cardio SET speed = ? WHERE id = ?", [p.speed, id]);
  return json({ date, cardio: await getCardio(date) });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/cardio/[id]">) => {
  const id = Number((await ctx.params).id);
  const date = await dateForCardio(id);
  if (!date) return fail("Cardio entry not found", 404);
  await run("DELETE FROM cardio WHERE id = ?", [id]);
  return json({ date, cardio: await getCardio(date) });
});
