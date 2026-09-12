import { db } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getRoutine } from "@/lib/queries";

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/routines/[id]">) => {
  const id = Number((await ctx.params).id);
  const row = db.prepare("SELECT day FROM routine_exercises WHERE id = ?").get(id) as { day: string } | undefined;
  if (!row) return fail("Not in the routine", 404);
  db.prepare("DELETE FROM routine_exercises WHERE id = ?").run(id);
  return json({ day: row.day, exercises: getRoutine(row.day) });
});
