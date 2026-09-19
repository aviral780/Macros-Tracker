import { isISODate, todayISO, weekRange } from "@/lib/dates";
import { handle, json } from "@/lib/http";
import { measuredBudget } from "@/lib/nutrition";
import {
  getCardio,
  getCardioSummary,
  getDailyMetrics,
  getEntries,
  getGoals,
  getPlan,
  getProfile,
  getWorkoutsForDate,
  hasGoals,
  nextSplitDay,
} from "@/lib/queries";

export const GET = handle(async (req: Request) => {
  const param = new URL(req.url).searchParams.get("date");
  const date = isISODate(param) ? param : todayISO();
  const week = weekRange(date);
  const plan = await getPlan();
  const [goals, goalsSet, entries, workouts, cardio, cardioWeek, nextDay, metrics, profile] = await Promise.all([
    getGoals(),
    hasGoals(),
    getEntries(date),
    getWorkoutsForDate(date),
    getCardio(date),
    getCardioSummary(week.from, week.to),
    nextSplitDay(plan),
    getDailyMetrics(date),
    getProfile(),
  ]);

  const budget = metrics
    ? measuredBudget(profile, { restingEnergy: metrics.resting_energy, activeEnergy: metrics.active_energy })
    : null;

  return json({ date, goals, goalsSet, entries, workouts, cardio, cardioWeek, plan, nextDay, metrics: metrics ?? null, budget });
});
