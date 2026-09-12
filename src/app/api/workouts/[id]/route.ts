import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getWorkout } from "@/lib/queries";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/workouts/[id]">) => {
  const w = getWorkout(Number((await ctx.params).id));
  return w ? json({ workout: w }) : fail("Workout not found", 404);
});

const Patch = z.object({ name: z.string().trim().min(1).max(60).optional(), notes: z.string().max(2000).optional() });

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/workouts/[id]">) => {
  const id = Number((await ctx.params).id);
  const p = Patch.parse(await req.json());
  if (p.name !== undefined) db.prepare("UPDATE workouts SET name = ? WHERE id = ?").run(p.name, id);
  if (p.notes !== undefined) db.prepare("UPDATE workouts SET notes = ? WHERE id = ?").run(p.notes, id);
  return json({ workout: getWorkout(id) });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/workouts/[id]">) => {
  db.prepare("DELETE FROM workouts WHERE id = ?").run(Number((await ctx.params).id));
  return json({ ok: true });
});
