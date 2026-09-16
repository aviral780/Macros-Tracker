import "server-only";
import { all, get } from "./db";
import { todayISO, weekRange } from "./dates";
import { getCardioSummary, getPlan, nextSplitDay } from "./queries";

export type Snapshot = {
  today: string;
  nextDay: string;
  trainedToday: boolean;
  loggedToday: boolean;
  cardioToday: boolean;
  daysSinceLast: number | null;
  streak: number;
  weekWorkouts: number;
  weekTarget: number;
  weekCardio: number;
  cardioTarget: number;
};

const dayHasWorkout = async (date: string) => !!(await get("SELECT 1 FROM workouts WHERE date = ? LIMIT 1", [date]));

const diffDays = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/**
 * Unbroken runs of training days. A single rest day is part of the pattern on a six-day
 * split, so a run only ends once two days pass with nothing logged.
 */
function trainingRuns(dates: string[]) {
  const runs: { length: number; from: string; to: string }[] = [];
  let start = 0;
  for (let i = 1; i <= dates.length; i++) {
    if (i === dates.length || diffDays(dates[i - 1], dates[i]) > 2) {
      runs.push({ length: i - start, from: dates[start], to: dates[i - 1] });
      start = i;
    }
  }
  return runs;
}

export async function streakStats(today = todayISO()) {
  const dates = (await all<{ date: string }>("SELECT DISTINCT date FROM workouts ORDER BY date")).map((r) => r.date);
  const runs = trainingRuns(dates);
  const latest = runs.at(-1);
  return {
    current: latest && diffDays(latest.to, today) <= 2 ? latest.length : 0,
    longest: runs.reduce((best, r) => Math.max(best, r.length), 0),
    totalDays: dates.length,
  };
}

export async function snapshot(): Promise<Snapshot> {
  const today = todayISO();
  const plan = await getPlan();
  const week = weekRange(today);

  const [lastWorkout, weekWorkouts, trainedToday, loggedToday, cardioToday, streak, cardioWeek, nextDay] =
    await Promise.all([
      get<{ date: string }>("SELECT date FROM workouts ORDER BY date DESC LIMIT 1"),
      get<{ n: number }>("SELECT COUNT(DISTINCT date) AS n FROM workouts WHERE date BETWEEN ? AND ?", [week.from, week.to]),
      dayHasWorkout(today),
      get("SELECT 1 FROM food_entries WHERE date = ? LIMIT 1", [today]),
      get("SELECT 1 FROM cardio WHERE date = ? LIMIT 1", [today]),
      streakStats(today),
      getCardioSummary(week.from, week.to),
      nextSplitDay(plan),
    ]);

  return {
    today,
    nextDay,
    trainedToday,
    loggedToday: !!loggedToday,
    cardioToday: !!cardioToday,
    daysSinceLast: lastWorkout ? Math.round((Date.parse(today) - Date.parse(lastWorkout.date)) / 86_400_000) : null,
    streak: streak.current,
    weekWorkouts: weekWorkouts?.n ?? 0,
    weekTarget: plan.days.length,
    weekCardio: cardioWeek.days,
    cardioTarget: plan.cardioPerWeek,
  };
}

export type Nudge = {
  kind: "train" | "cardio" | "log" | "done";
  urgency: "normal" | "high";
  title: string;
  body: string;
};

/** One message for the moment it is asked for — hour drives whether logging or training leads. */
export function nudge(s: Snapshot, hour = new Date().getHours()): Nudge {
  const left = Math.max(0, s.weekTarget - s.weekWorkouts);

  if (!s.trainedToday && s.daysSinceLast !== null && s.daysSinceLast >= 2) {
    return {
      kind: "train",
      urgency: "high",
      title: `${s.daysSinceLast} days off`,
      body: `${s.nextDay} is next. Turning up beats the perfect session — go put one on the board.`,
    };
  }

  if (!s.trainedToday && hour < 21) {
    return {
      kind: "train",
      urgency: left <= 1 ? "high" : "normal",
      title: `${s.nextDay} today`,
      body:
        left <= 1
          ? `${s.weekWorkouts} of ${s.weekTarget} done. This is the one that closes the week.`
          : `${s.weekWorkouts} of ${s.weekTarget} done this week. ${left} to go.`,
    };
  }

  if (s.trainedToday && !s.cardioToday && s.weekCardio < s.cardioTarget) {
    return {
      kind: "cardio",
      urgency: "normal",
      title: "Cardio still open",
      body: `${s.weekCardio} of ${s.cardioTarget} this week. Twenty minutes on the incline and it's done.`,
    };
  }

  if (!s.loggedToday) {
    return {
      kind: "log",
      urgency: hour >= 20 ? "high" : "normal",
      title: "Nothing logged today",
      body: "Snap the plate or describe it in a line — takes about ten seconds.",
    };
  }

  return {
    kind: "done",
    urgency: "normal",
    title: s.streak > 1 ? `${s.streak} days running` : "Today is done",
    body:
      s.weekWorkouts >= s.weekTarget
        ? "Full week hit, food logged. This is the part most people never get to."
        : `Trained and logged. ${left} session${left === 1 ? "" : "s"} left this week.`,
  };
}

/** Receipts for the days motivation is missing: what has already been earned. */
export async function pepTalk(s: Snapshot) {
  const [totalsRow, best] = await Promise.all([
    get<{ sessions: number; volume: number }>(
      `SELECT COUNT(DISTINCT w.id) AS sessions,
         COALESCE(SUM(s.weight * s.reps) FILTER (WHERE s.warmup = 0), 0) AS volume
       FROM workouts w
       LEFT JOIN workout_exercises we ON we.workout_id = w.id
       LEFT JOIN sets s ON s.workout_exercise_id = we.id`,
    ),
    get<{ name: string; weight: number; reps: number; date: string }>(
      `SELECT e.name, s.weight, s.reps, w.date FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN exercises e ON e.id = we.exercise_id
       JOIN workouts w ON w.id = we.workout_id
       WHERE s.warmup = 0 AND s.reps > 0
       ORDER BY s.weight DESC, s.reps DESC LIMIT 1`,
    ),
  ]);
  const totals = totalsRow ?? { sessions: 0, volume: 0 };

  const lines = [
    totals.sessions > 0 ? `You have logged ${totals.sessions} sessions. None of them felt convenient either.` : null,
    totals.volume > 0
      ? `That is ${Math.round(totals.volume).toLocaleString("en-US")} kg moved. The work is already banked — today just adds to it.`
      : null,
    best ? `Your best set on record is ${best.name} at ${best.weight} kg × ${best.reps}. You were not motivated that day either.` : null,
    s.streak > 1 ? `${s.streak} days in a row right now. Momentum is the hardest thing to buy back once you drop it.` : null,
    `Lower the bar instead of skipping: show up, do the first exercise, leave if it is still bad. It almost never is.`,
  ].filter((l): l is string => l !== null);

  return { lines, totals, best: best ?? null };
}
