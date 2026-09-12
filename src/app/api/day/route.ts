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

export const GET = handle((req: Request) => {
  const param = new URL(req.url).searchParams.get("date");
  const date = isISODate(param) ? param : todayISO();
  const week = weekRange(date);
  const plan = getPlan();
  return json({
    date,
    goals: getGoals(),
    goalsSet: hasGoals(),
    entries: getEntries(date),
    workouts: getWorkoutsForDate(date),
    cardio: getCardio(date),
    cardioWeek: getCardioSummary(week.from, week.to),
    plan,
    nextDay: nextSplitDay(plan),
  });
});
