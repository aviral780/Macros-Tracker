import { isISODate, todayISO } from "@/lib/dates";
import { handle, json } from "@/lib/http";
import { getEntries, getGoals, getWorkoutsForDate, hasGoals } from "@/lib/queries";

export const GET = handle((req: Request) => {
  const param = new URL(req.url).searchParams.get("date");
  const date = isISODate(param) ? param : todayISO();
  return json({
    date,
    goals: getGoals(),
    goalsSet: hasGoals(),
    entries: getEntries(date),
    workouts: getWorkoutsForDate(date),
  });
});
