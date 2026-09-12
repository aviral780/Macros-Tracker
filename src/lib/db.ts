import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
export const PHOTO_DIR = path.join(DATA_DIR, "photos");

/** Absolute path for a stored food photo; basename() keeps lookups inside the photo folder. */
export const photoPath = (filename: string) =>
  path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "photos", path.basename(filename));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS food_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  meal TEXT NOT NULL CHECK (meal IN ('breakfast','lunch','dinner','snack')),
  name TEXT NOT NULL,
  portion TEXT NOT NULL DEFAULT '',
  grams REAL,
  calories REAL NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  fiber REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  confidence REAL,
  photo_id TEXT REFERENCES photos(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_food_date ON food_entries(date);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  muscle TEXT NOT NULL DEFAULT 'Other',
  custom INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Workout',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workout_date ON workouts(date);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  warmup INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS body_weight (
  date TEXT PRIMARY KEY,
  kg REAL NOT NULL
);
`;

const SEED_EXERCISES: [string, string][] = [
  ["Barbell bench press", "Chest"],
  ["Incline barbell bench press", "Chest"],
  ["Dumbbell bench press", "Chest"],
  ["Incline dumbbell press", "Chest"],
  ["Machine chest press", "Chest"],
  ["Cable fly", "Chest"],
  ["Dips", "Chest"],
  ["Push-up", "Chest"],
  ["Deadlift", "Back"],
  ["Pull-up", "Back"],
  ["Chin-up", "Back"],
  ["Lat pulldown", "Back"],
  ["Barbell row", "Back"],
  ["Dumbbell row", "Back"],
  ["Seated cable row", "Back"],
  ["T-bar row", "Back"],
  ["Face pull", "Shoulders"],
  ["Overhead press", "Shoulders"],
  ["Seated dumbbell press", "Shoulders"],
  ["Lateral raise", "Shoulders"],
  ["Rear delt fly", "Shoulders"],
  ["Barbell curl", "Arms"],
  ["Dumbbell curl", "Arms"],
  ["Hammer curl", "Arms"],
  ["Preacher curl", "Arms"],
  ["Triceps pushdown", "Arms"],
  ["Overhead triceps extension", "Arms"],
  ["Skull crusher", "Arms"],
  ["Close-grip bench press", "Arms"],
  ["Back squat", "Legs"],
  ["Front squat", "Legs"],
  ["Leg press", "Legs"],
  ["Romanian deadlift", "Legs"],
  ["Bulgarian split squat", "Legs"],
  ["Walking lunge", "Legs"],
  ["Leg extension", "Legs"],
  ["Lying leg curl", "Legs"],
  ["Seated leg curl", "Legs"],
  ["Hip thrust", "Legs"],
  ["Standing calf raise", "Legs"],
  ["Seated calf raise", "Legs"],
  ["Hanging leg raise", "Core"],
  ["Cable crunch", "Core"],
  ["Plank", "Core"],
];

function open() {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "macros.db"));
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  const count = db.prepare("SELECT COUNT(*) AS n FROM exercises").get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare("INSERT INTO exercises (name, muscle) VALUES (?, ?)");
    db.transaction(() => SEED_EXERCISES.forEach(([n, m]) => insert.run(n, m)))();
  }
  return db;
}

// One connection, opened on first use (not at import, so builds don't touch the file)
// and reused across hot reloads in dev.
const globalForDb = globalThis as unknown as { __macrosDb?: Database.Database };
const instance = () => (globalForDb.__macrosDb ??= open());

export const db = new Proxy({} as Database.Database, {
  get(_, prop) {
    const real = instance();
    const value = Reflect.get(real, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export function getSetting<T>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (!row) return fallback;
  try {
    return { ...fallback, ...JSON.parse(row.value) };
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, JSON.stringify(value));
}
