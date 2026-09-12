import { addDays, isISODate, todayISO } from "@/lib/dates";
import { handle, json } from "@/lib/http";
import { streakStats } from "@/lib/nudge";
import { getGoals, getPlan, getTrends } from "@/lib/queries";

export const GET = handle((req: Request) => {
  const params = new URL(req.url).searchParams;
  const to = isISODate(params.get("to")) ? params.get("to")! : todayISO();
  const days = Math.min(365, Math.max(7, Number(params.get("days")) || 30));
  const from = addDays(to, -(days - 1));
  return json({ from, to, goals: getGoals(), plan: getPlan(), streaks: streakStats(to), ...getTrends(from, to) });
});
