import { z } from "zod";
import { db } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { MEALS } from "@/lib/types";
import { FoodInput } from "@/lib/schemas";

const Patch = FoodInput.partial().extend({ meal: z.enum(MEALS).optional() });

export const PATCH = handle(async (req: Request, ctx: RouteContext<"/api/foods/[id]">) => {
  const { id } = await ctx.params;
  const patch = Patch.parse(await req.json());
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length === 0) return fail("Nothing to update");
  const res = db
    .prepare(`UPDATE food_entries SET ${keys.map((k) => `${k} = @${k}`).join(", ")} WHERE id = @id`)
    .run({ ...patch, id: Number(id) });
  if (res.changes === 0) return fail("That entry no longer exists", 404);
  return json({ ok: true });
});

export const DELETE = handle(async (_req: Request, ctx: RouteContext<"/api/foods/[id]">) => {
  const { id } = await ctx.params;
  db.prepare("DELETE FROM food_entries WHERE id = ?").run(Number(id));
  return json({ ok: true });
});
