import { isISODate, todayISO, weekRange } from "@/lib/dates";
import { handle, json } from "@/lib/http";
import {
  getCardio,
  getCardioSummary,
  getEntries,
  getGoals,
  getPlan,
  getWorkoutsForDate,
  hasGoals,
  nextSplitDay,
} from "@/lib/queries";

export const GET = handle(async (req: Request) => {
  const param = new URL(req.url).searchParams.get("date");
  const date = isISODate(param) ? param : todayISO();
  const week = weekRange(date);
  const plan = await getPlan();
  const [goals, goalsSet, entries, workouts, cardio, cardioWeek, nextDay] = await Promise.all([
    getGoals(),
    hasGoals(),
    getEntries(date),
    getWorkoutsForDate(date),
    getCardio(date),
    getCardioSummary(week.from, week.to),
    nextSplitDay(plan),
  ]);
  return json({ date, goals, goalsSet, entries, workouts, cardio, cardioWeek, plan, nextDay });
});
