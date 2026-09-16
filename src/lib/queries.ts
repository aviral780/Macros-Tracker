import "server-only";
import { all, get, getSetting } from "./db";
import { DEFAULT_GOALS, DEFAULT_PROFILE } from "./nutrition";
import { e1rm, setVolume } from "./strength";
import { DEFAULT_PLAN } from "./types";
import type { CardioEntry, Exercise, FoodEntry, Goals, Profile, TrainingPlan, Workout, WorkoutExercise } from "./types";

export const getGoals = () => getSetting<Goals>("goals", DEFAULT_GOALS);
export const getProfile = () => getSetting<Profile>("profile", DEFAULT_PROFILE);
export const getPlan = () => getSetting<TrainingPlan>("plan", DEFAULT_PLAN);
export const hasGoals = async () => !!(await get("SELECT 1 FROM settings WHERE key = 'goals'"));

export function getEntries(date: string) {
  return all<FoodEntry>("SELECT * FROM food_entries WHERE date = ? ORDER BY id", [date]);
}

export function getRecentFoods(limit = 40) {
  // The latest version of each distinct food name, most recently logged first.
  return all<FoodEntry>(
    `SELECT f.* FROM food_entries f
     JOIN (SELECT lower(name) AS k, MAX(id) AS id, COUNT(*) AS uses FROM food_entries GROUP BY lower(name)) r ON r.id = f.id
     ORDER BY f.id DESC LIMIT ?`,
    [limit],
  );
}

type SetRow = { id: number; position: number; weight: number; reps: number; warmup: number };

async function bestE1rmBefore(exerciseId: number, workoutId: number, date: string) {
  const rows = await all<{ weight: number; reps: number }>(
    `SELECT s.weight, s.reps FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND s.warmup = 0 AND (w.date < ? OR (w.date = ? AND w.id < ?))`,
    [exerciseId, date, date, workoutId],
  );
  return rows.reduce((best, s) => Math.max(best, e1rm(s.weight, s.reps)), 0);
}

async function lastSession(exerciseId: number, workoutId: number, date: string) {
  const prev = await get<{ id: number; date: string }>(
    `SELECT we.id, w.date FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND (w.date < ? OR (w.date = ? AND w.id < ?))
       AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = we.id)
     ORDER BY w.date DESC, w.id DESC LIMIT 1`,
    [exerciseId, date, date, workoutId],
  );
  if (!prev) return null;
  const sets = await all<{ weight: number; reps: number }>(
    "SELECT weight, reps FROM sets WHERE workout_exercise_id = ? AND warmup = 0 ORDER BY position, id",
    [prev.id],
  );
  return { date: prev.date, sets };
}

export async function getWorkout(id: number): Promise<Workout | null> {
  const w = await get<Omit<Workout, "exercises">>("SELECT * FROM workouts WHERE id = ?", [id]);
  if (!w) return null;
  const wes = await all<Omit<WorkoutExercise, "sets" | "previousBest" | "last">>(
    `SELECT we.id, we.exercise_id, e.name, e.muscle FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id WHERE we.workout_id = ? ORDER BY we.position, we.id`,
    [id],
  );
  const exercises = await Promise.all(
    wes.map(async (we) => {
      const [sets, previousBest, last] = await Promise.all([
        all<SetRow>("SELECT id, position, weight, reps, warmup FROM sets WHERE workout_exercise_id = ? ORDER BY position, id", [we.id]),
        bestE1rmBefore(we.exercise_id, id, w.date),
        lastSession(we.exercise_id, id, w.date),
      ]);
      return { ...we, sets: sets.map((s) => ({ ...s, warmup: !!s.warmup })), previousBest, last };
    }),
  );
  return { ...w, exercises };
}

export async function getWorkoutsForDate(date: string): Promise<Workout[]> {
  const ids = await all<{ id: number }>("SELECT id FROM workouts WHERE date = ? ORDER BY id", [date]);
  const workouts = await Promise.all(ids.map((r) => getWorkout(r.id)));
  return workouts.filter((w): w is Workout => w !== null);
}

export function getWorkoutHistory(limit = 30) {
  return all<{
    id: number;
    date: string;
    name: string;
    duration_min: number | null;
    exercises: number;
    sets: number;
    volume: number;
  }>(
    `SELECT w.id, w.date, w.name, w.duration_min,
       COUNT(DISTINCT we.id) AS exercises,
       COUNT(s.id) FILTER (WHERE s.warmup = 0) AS sets,
       COALESCE(SUM(s.weight * s.reps) FILTER (WHERE s.warmup = 0), 0) AS volume
     FROM workouts w
     LEFT JOIN workout_exercises we ON we.workout_id = w.id
     LEFT JOIN sets s ON s.workout_exercise_id = we.id
     GROUP BY w.id ORDER BY w.date DESC, w.id DESC LIMIT ?`,
    [limit],
  );
}

const CARDIO_COLUMNS = "id, date, kind, minutes, incline, speed, distance_km, calories, avg_hr, source";

export function getCardio(date: string) {
  return all<CardioEntry>(`SELECT ${CARDIO_COLUMNS} FROM cardio WHERE date = ? ORDER BY id`, [date]);
}

/** Distinct days rather than rows: two treadmill blocks in one day are still one cardio day. */
export async function getCardioSummary(from: string, to: string) {
  const row = await get<{ days: number; minutes: number }>(
    `SELECT COUNT(DISTINCT date) AS days, COALESCE(SUM(minutes), 0) AS minutes
     FROM cardio WHERE date BETWEEN ? AND ?`,
    [from, to],
  );
  return row ?? { days: 0, minutes: 0 };
}

/** The next session in the rotation, based on where the last logged workout sits in it. */
export async function nextSplitDay(plan: TrainingPlan) {
  if (plan.days.length === 0) return "Workout";
  const last = await get<{ name: string }>("SELECT name FROM workouts ORDER BY date DESC, id DESC LIMIT 1");
  if (!last) return plan.days[0];
  const i = plan.days.findIndex((d) => d.toLowerCase() === last.name.toLowerCase());
  return i === -1 ? plan.days[0] : plan.days[(i + 1) % plan.days.length];
}

/** Most-used first, so the picker can offer regulars without any manual curation. */
export async function listExercises(): Promise<Exercise[]> {
  const rows = await all<Omit<Exercise, "custom"> & { custom: number; last_used: string | null }>(
    `SELECT e.id, e.name, e.muscle, e.custom,
       COUNT(we.id) AS uses,
       MAX(w.date) AS last_used
     FROM exercises e
     LEFT JOIN workout_exercises we ON we.exercise_id = e.id
     LEFT JOIN workouts w ON w.id = we.workout_id
     GROUP BY e.id
     ORDER BY uses DESC, last_used IS NULL, last_used DESC, e.muscle, e.name`,
  );
  return rows.map((r) => ({ ...r, custom: !!r.custom }));
}

export async function getExerciseProgress(exerciseId: number) {
  const exercise = await get<{ id: number; name: string; muscle: string }>(
    "SELECT id, name, muscle FROM exercises WHERE id = ?",
    [exerciseId],
  );
  if (!exercise) return null;
  const rows = await all<{ workout_id: number; date: string; weight: number; reps: number }>(
    `SELECT w.id AS workout_id, w.date, s.weight, s.reps FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND s.warmup = 0 AND s.reps > 0
     ORDER BY w.date, w.id, s.position, s.id`,
    [exerciseId],
  );

  const sessions = new Map<number, { date: string; sets: { weight: number; reps: number }[] }>();
  for (const r of rows) {
    const s = sessions.get(r.workout_id) ?? { date: r.date, sets: [] };
    s.sets.push({ weight: r.weight, reps: r.reps });
    sessions.set(r.workout_id, s);
  }
  const history = [...sessions.values()].map((s) => {
    const best = s.sets.reduce((b, x) => (e1rm(x.weight, x.reps) > e1rm(b.weight, b.reps) ? x : b), s.sets[0]);
    return {
      date: s.date,
      sets: s.sets,
      e1rm: Math.round(e1rm(best.weight, best.reps) * 10) / 10,
      bestSet: best,
      volume: setVolume(s.sets),
      topWeight: Math.max(...s.sets.map((x) => x.weight)),
    };
  });
  const pr = history.reduce<(typeof history)[number] | null>((b, h) => (!b || h.e1rm > b.e1rm ? h : b), null);
  return { exercise, history, pr };
}

export async function getTrends(from: string, to: string) {
  const [days, weights, training, cardio] = await Promise.all([
    all<{ date: string; calories: number; protein: number; carbs: number; fat: number }>(
      `SELECT date, SUM(calories) AS calories, SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat
       FROM food_entries WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
      [from, to],
    ),
    all<{ date: string; kg: number }>("SELECT date, kg FROM body_weight WHERE date BETWEEN ? AND ? ORDER BY date", [from, to]),
    all<{ date: string; workouts: number; volume: number; sets: number }>(
      `SELECT w.date, COUNT(DISTINCT w.id) AS workouts,
         COALESCE(SUM(s.weight * s.reps) FILTER (WHERE s.warmup = 0), 0) AS volume,
         COUNT(s.id) FILTER (WHERE s.warmup = 0) AS sets
       FROM workouts w
       LEFT JOIN workout_exercises we ON we.workout_id = w.id
       LEFT JOIN sets s ON s.workout_exercise_id = we.id
       WHERE w.date BETWEEN ? AND ? GROUP BY w.date ORDER BY w.date`,
      [from, to],
    ),
    all<{ date: string; minutes: number; sessions: number }>(
      `SELECT date, COALESCE(SUM(minutes), 0) AS minutes, COUNT(*) AS sessions
       FROM cardio WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
      [from, to],
    ),
  ]);
  return { days, weights, training, cardio };
}

export type RoutineExercise = { id: number; exercise_id: number; name: string; muscle: string };

export function getRoutine(day: string) {
  return all<RoutineExercise>(
    `SELECT r.id, r.exercise_id, e.name, e.muscle FROM routine_exercises r
     JOIN exercises e ON e.id = r.exercise_id
     WHERE r.day = ? COLLATE NOCASE ORDER BY r.position, r.id`,
    [day],
  );
}

export async function getRoutines(plan: TrainingPlan) {
  return Promise.all(plan.days.map(async (day) => ({ day, exercises: await getRoutine(day) })));
}
