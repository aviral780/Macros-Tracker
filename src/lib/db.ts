import { createClient, type Client, type InArgs, type InStatement } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "data");
export const PHOTO_DIR = path.join(DATA_DIR, "photos");

/** Absolute path for a locally stored food photo; basename() keeps lookups inside the folder. */
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

CREATE TABLE IF NOT EXISTS cardio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'Incline treadmill',
  minutes REAL NOT NULL DEFAULT 0,
  incline REAL,
  speed REAL,
  distance_km REAL,
  calories REAL,
  avg_hr REAL,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cardio_date ON cardio(date);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE (day, exercise_id)
);
CREATE INDEX IF NOT EXISTS idx_routine_day ON routine_exercises(day);

CREATE TABLE IF NOT EXISTS daily_metrics (
  date TEXT PRIMARY KEY,
  steps REAL,
  active_energy REAL,
  resting_energy REAL,
  exercise_minutes REAL,
  stand_hours REAL,
  resting_hr REAL,
  hrv REAL,
  sleep_hours REAL,
  weight_kg REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS insights (
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (kind, subject)
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
  ["Pec deck", "Chest"],
  ["Cable crossover", "Chest"],
  ["Decline barbell bench press", "Chest"],
  ["Straight-arm pulldown", "Back"],
  ["Chest-supported row", "Back"],
  ["Machine shoulder press", "Shoulders"],
  ["Cable lateral raise", "Shoulders"],
  ["Barbell shrug", "Shoulders"],
  ["Upright row", "Shoulders"],
  ["Concentration curl", "Arms"],
  ["Cable curl", "Arms"],
  ["Rope triceps pushdown", "Arms"],
  ["Wrist curl", "Arms"],
  ["Reverse wrist curl", "Arms"],
  ["Reverse curl", "Arms"],
  ["Farmer's carry", "Arms"],
  ["Hack squat", "Legs"],
  ["Goblet squat", "Legs"],
];

/** Starting point for each split day, in the order the exercises are normally done. */
const SEED_ROUTINE: Record<string, string[]> = {
  "Chest & Triceps": [
    "Barbell bench press",
    "Incline dumbbell press",
    "Machine chest press",
    "Cable fly",
    "Triceps pushdown",
    "Overhead triceps extension",
    "Dips",
  ],
  "Back & Biceps": [
    "Lat pulldown",
    "Barbell row",
    "Seated cable row",
    "Dumbbell row",
    "Barbell curl",
    "Hammer curl",
    "Preacher curl",
  ],
  "Legs & Shoulders": [
    "Back squat",
    "Leg press",
    "Romanian deadlift",
    "Leg extension",
    "Lying leg curl",
    "Overhead press",
    "Lateral raise",
  ],
  Arms: [
    "Barbell curl",
    "Preacher curl",
    "Hammer curl",
    "Triceps pushdown",
    "Skull crusher",
    "Overhead triceps extension",
    "Wrist curl",
    "Reverse wrist curl",
  ],
  "Back & Chest": [
    "Pull-up",
    "Lat pulldown",
    "Seated cable row",
    "Barbell bench press",
    "Incline dumbbell press",
    "Cable fly",
  ],
  Shoulders: [
    "Overhead press",
    "Seated dumbbell press",
    "Lateral raise",
    "Rear delt fly",
    "Face pull",
    "Barbell shrug",
  ],
};

/** Columns added after the first release; existing databases get them on open. */
const ADDED_COLUMNS: [table: string, column: string, ddl: string][] = [
  ["workouts", "duration_min", "REAL"],
  ["workouts", "calories", "REAL"],
  ["workouts", "avg_hr", "REAL"],
  ["workouts", "max_hr", "REAL"],
  ["workouts", "external_id", "TEXT"],
  ["cardio", "max_hr", "REAL"],
];

async function migrate(c: Client) {
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    const info = await c.execute(`PRAGMA table_info(${table})`);
    if (!info.rows.some((r) => (r as unknown as { name: string }).name === column)) {
      await c.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  }
}

async function seedData(c: Client) {
  // Idempotent, so exercises added in a later release land in databases that already exist.
  await c.batch(
    SEED_EXERCISES.map(([name, muscle]) => ({
      sql: "INSERT OR IGNORE INTO exercises (name, muscle) VALUES (?, ?)",
      args: [name, muscle] as InArgs,
    })),
    "write",
  );

  const count = await c.execute("SELECT COUNT(*) AS n FROM routine_exercises");
  if (Number((count.rows[0] as unknown as { n: number }).n) > 0) return;

  const statements: InStatement[] = [];
  for (const [day, names] of Object.entries(SEED_ROUTINE)) {
    for (const [i, name] of names.entries()) {
      const found = await c.execute({ sql: "SELECT id FROM exercises WHERE name = ? COLLATE NOCASE", args: [name] });
      const row = found.rows[0] as unknown as { id: number } | undefined;
      if (row) {
        statements.push({
          sql: "INSERT OR IGNORE INTO routine_exercises (day, exercise_id, position) VALUES (?, ?, ?)",
          args: [day, row.id, i],
        });
      }
    }
  }
  if (statements.length > 0) await c.batch(statements, "write");
}

/**
 * One client for the process, reused across hot reloads. With TURSO_DATABASE_URL set it
 * talks to Turso; without it, to the same local SQLite file as before, so development and
 * production run identical code.
 */
function createDbClient(): Client {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  return createClient({ url: `file:${path.join(DATA_DIR, "macros.db")}` });
}

const globalForDb = globalThis as unknown as { __macrosClient?: Client; __macrosReady?: Promise<void> };
const client = () => (globalForDb.__macrosClient ??= createDbClient());

/** Schema work runs once per process; every helper waits on it before its first query. */
const ready = () => (globalForDb.__macrosReady ??= (async () => {
  const c = client();
  await c.executeMultiple(SCHEMA);
  await migrate(c);
  await seedData(c);
})());

export async function all<T>(sql: string, args: InArgs = []): Promise<T[]> {
  await ready();
  const result = await client().execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function get<T>(sql: string, args: InArgs = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export async function run(sql: string, args: InArgs = []) {
  await ready();
  const result = await client().execute({ sql, args });
  return {
    lastInsertRowid: result.lastInsertRowid === undefined ? 0 : Number(result.lastInsertRowid),
    rowsAffected: result.rowsAffected,
  };
}

/** Statements that must land together, in order. */
export async function batch(statements: InStatement[]) {
  if (statements.length === 0) return;
  await ready();
  await client().batch(statements, "write");
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = ?", [key]);
  if (!row) return fallback;
  try {
    return { ...fallback, ...JSON.parse(row.value) };
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown) {
  await run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
    key,
    JSON.stringify(value),
  ]);
}
