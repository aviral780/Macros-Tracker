import "server-only";
import { db, getSetting } from "./db";
import { DEFAULT_GOALS, DEFAULT_PROFILE } from "./nutrition";
import { e1rm, setVolume } from "./strength";
import { DEFAULT_PLAN } from "./types";
import type { CardioEntry, Exercise, FoodEntry, Goals, Profile, TrainingPlan, Workout, WorkoutExercise } from "./types";

export const getGoals = () => getSetting<Goals>("goals", DEFAULT_GOALS);
export const getProfile = () => getSetting<Profile>("profile", DEFAULT_PROFILE);
export const getPlan = () => getSetting<TrainingPlan>("plan", DEFAULT_PLAN);
export const hasGoals = () => !!db.prepare("SELECT 1 FROM settings WHERE key = 'goals'").get();

export function getEntries(date: string): FoodEntry[] {
  return db.prepare("SELECT * FROM food_entries WHERE date = ? ORDER BY id").all(date) as FoodEntry[];
}

export function getRecentFoods(limit = 40) {
  // The latest version of each distinct food name, most recently logged first.
  return db
    .prepare(
      `SELECT f.* FROM food_entries f
       JOIN (SELECT lower(name) AS k, MAX(id) AS id, COUNT(*) AS uses FROM food_entries GROUP BY lower(name)) r ON r.id = f.id
       ORDER BY f.id DESC LIMIT ?`,
    )
    .all(limit) as FoodEntry[];
}

type SetRow = { id: number; position: number; weight: number; reps: number; warmup: number };

function bestE1rmBefore(exerciseId: number, workoutId: number, date: string) {
  const rows = db
    .prepare(
      `SELECT s.weight, s.reps FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id
       WHERE we.exercise_id = ? AND s.warmup = 0 AND (w.date < ? OR (w.date = ? AND w.id < ?))`,
    )
    .all(exerciseId, date, date, workoutId) as { weight: number; reps: number }[];
  return rows.reduce((best, s) => Math.max(best, e1rm(s.weight, s.reps)), 0);
}

function lastSession(exerciseId: number, workoutId: number, date: string) {
  const prev = db
    .prepare(
      `SELECT we.id, w.date FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
       WHERE we.exercise_id = ? AND (w.date < ? OR (w.date = ? AND w.id < ?))
         AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = we.id)
       ORDER BY w.date DESC, w.id DESC LIMIT 1`,
    )
    .get(exerciseId, date, date, workoutId) as { id: number; date: string } | undefined;
  if (!prev) return null;
  const sets = db
    .prepare("SELECT weight, reps FROM sets WHERE workout_exercise_id = ? AND warmup = 0 ORDER BY position, id")
    .all(prev.id) as { weight: number; reps: number }[];
  return { date: prev.date, sets };
}

export function getWorkout(id: number): Workout | null {
  const w = db.prepare("SELECT * FROM workouts WHERE id = ?").get(id) as Omit<Workout, "exercises"> | undefined;
  if (!w) return null;
  const wes = db
    .prepare(
      `SELECT we.id, we.exercise_id, e.name, e.muscle FROM workout_exercises we
       JOIN exercises e ON e.id = we.exercise_id WHERE we.workout_id = ? ORDER BY we.position, we.id`,
    )
    .all(id) as Omit<WorkoutExercise, "sets" | "previousBest" | "last">[];
  const setStmt = db.prepare("SELECT id, position, weight, reps, warmup FROM sets WHERE workout_exercise_id = ? ORDER BY position, id");
  return {
    ...w,
    exercises: wes.map((we) => ({
      ...we,
      sets: (setStmt.all(we.id) as SetRow[]).map((s) => ({ ...s, warmup: !!s.warmup })),
      previousBest: bestE1rmBefore(we.exercise_id, id, w.date),
      last: lastSession(we.exercise_id, id, w.date),
    })),
  };
}

export function getWorkoutsForDate(date: string): Workout[] {
  const ids = db.prepare("SELECT id FROM workouts WHERE date = ? ORDER BY id").all(date) as { id: number }[];
  return ids.map((r) => getWorkout(r.id)!).filter(Boolean);
}

export function getWorkoutHistory(limit = 30) {
  const rows = db
    .prepare(
      `SELECT w.id, w.date, w.name, w.duration_min,
         COUNT(DISTINCT we.id) AS exercises,
         COUNT(s.id) FILTER (WHERE s.warmup = 0) AS sets,
         COALESCE(SUM(s.weight * s.reps) FILTER (WHERE s.warmup = 0), 0) AS volume
       FROM workouts w
       LEFT JOIN workout_exercises we ON we.workout_id = w.id
       LEFT JOIN sets s ON s.workout_exercise_id = we.id
       GROUP BY w.id ORDER BY w.date DESC, w.id DESC LIMIT ?`,
    )
    .all(limit) as {
    id: number;
    date: string;
    name: string;
    duration_min: number | null;
    exercises: number;
    sets: number;
    volume: number;
  }[];
  return rows;
}

const CARDIO_COLUMNS = "id, date, kind, minutes, incline, speed, distance_km, calories, avg_hr, source";

export function getCardio(date: string): CardioEntry[] {
  return db.prepare(`SELECT ${CARDIO_COLUMNS} FROM cardio WHERE date = ? ORDER BY id`).all(date) as CardioEntry[];
}

/** Distinct days rather than rows: two treadmill blocks in one day are still one cardio day. */
export function getCardioSummary(from: string, to: string) {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT date) AS days, COALESCE(SUM(minutes), 0) AS minutes
       FROM cardio WHERE date BETWEEN ? AND ?`,
    )
    .get(from, to) as { days: number; minutes: number };
  return row;
}

/** The next session in the rotation, based on where the last logged workout sits in it. */
export function nextSplitDay(plan: TrainingPlan) {
  if (plan.days.length === 0) return "Workout";
  const last = db.prepare("SELECT name FROM workouts ORDER BY date DESC, id DESC LIMIT 1").get() as
    | { name: string }
    | undefined;
  if (!last) return plan.days[0];
  const i = plan.days.findIndex((d) => d.toLowerCase() === last.name.toLowerCase());
  return i === -1 ? plan.days[0] : plan.days[(i + 1) % plan.days.length];
}

/** Most-used first, so the picker can offer regulars without any manual curation. */
export function listExercises(): Exercise[] {
  const rows = db
    .prepare(
      `SELECT e.id, e.name, e.muscle, e.custom,
         COUNT(we.id) AS uses,
         MAX(w.date) AS last_used
       FROM exercises e
       LEFT JOIN workout_exercises we ON we.exercise_id = e.id
       LEFT JOIN workouts w ON w.id = we.workout_id
       GROUP BY e.id
       ORDER BY uses DESC, last_used IS NULL, last_used DESC, e.muscle, e.name`,
    )
    .all() as (Omit<Exercise, "custom"> & { custom: number; last_used: string | null })[];
  return rows.map((r) => ({ ...r, custom: !!r.custom }));
}

export function getExerciseProgress(exerciseId: number) {
  const exercise = db.prepare("SELECT id, name, muscle FROM exercises WHERE id = ?").get(exerciseId) as
    | { id: number; name: string; muscle: string }
    | undefined;
  if (!exercise) return null;
  const rows = db
    .prepare(
      `SELECT w.id AS workout_id, w.date, s.weight, s.reps FROM sets s
       JOIN workout_exercises we ON we.id = s.workout_exercise_id
       JOIN workouts w ON w.id = we.workout_id
       WHERE we.exercise_id = ? AND s.warmup = 0 AND s.reps > 0
       ORDER BY w.date, w.id, s.position, s.id`,
    )
    .all(exerciseId) as { workout_id: number; date: string; weight: number; reps: number }[];

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

export function getTrends(from: string, to: string) {
  const days = db
    .prepare(
      `SELECT date, SUM(calories) AS calories, SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat
       FROM food_entries WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
    )
    .all(from, to) as { date: string; calories: number; protein: number; carbs: number; fat: number }[];
  const weights = db
    .prepare("SELECT date, kg FROM body_weight WHERE date BETWEEN ? AND ? ORDER BY date")
    .all(from, to) as { date: string; kg: number }[];
  const training = db
    .prepare(
      `SELECT w.date, COUNT(DISTINCT w.id) AS workouts,
         COALESCE(SUM(s.weight * s.reps) FILTER (WHERE s.warmup = 0), 0) AS volume,
         COUNT(s.id) FILTER (WHERE s.warmup = 0) AS sets
       FROM workouts w
       LEFT JOIN workout_exercises we ON we.workout_id = w.id
       LEFT JOIN sets s ON s.workout_exercise_id = we.id
       WHERE w.date BETWEEN ? AND ? GROUP BY w.date ORDER BY w.date`,
    )
    .all(from, to) as { date: string; workouts: number; volume: number; sets: number }[];
  const cardio = db
    .prepare(
      `SELECT date, COALESCE(SUM(minutes), 0) AS minutes, COUNT(*) AS sessions
       FROM cardio WHERE date BETWEEN ? AND ? GROUP BY date ORDER BY date`,
    )
    .all(from, to) as { date: string; minutes: number; sessions: number }[];
  return { days, weights, training, cardio };
}
