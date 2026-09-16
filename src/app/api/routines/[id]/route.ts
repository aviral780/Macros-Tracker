import { get, run } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { getRoutine } from "@/lib/queries";

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/routines/[id]">) => {
  const id = Number((await ctx.params).id);
  const row = await get<{ day: string }>("SELECT day FROM routine_exercises WHERE id = ?", [id]);
  if (!row) return fail("Not in the routine", 404);
  await run("DELETE FROM routine_exercises WHERE id = ?", [id]);
  return json({ day: row.day, exercises: await getRoutine(row.day) });
});
