import { fail, handle, json } from "@/lib/http";
import { exerciseInsight } from "@/lib/insights";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/insights/exercise/[id]">) => {
  const result = await exerciseInsight(Number((await ctx.params).id));
  return result ? json(result) : fail("Exercise not found", 404);
});
