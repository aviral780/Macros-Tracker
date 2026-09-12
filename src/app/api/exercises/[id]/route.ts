import { fail, handle, json } from "@/lib/http";
import { getExerciseProgress } from "@/lib/queries";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/exercises/[id]">) => {
  const data = getExerciseProgress(Number((await ctx.params).id));
  return data ? json(data) : fail("Exercise not found", 404);
});
