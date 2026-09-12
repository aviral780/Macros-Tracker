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
`;

/** Columns added after the first release; existing databases get them on open. */
const ADDED_COLUMNS: [table: string, column: string, ddl: string][] = [
  ["workouts", "duration_min", "REAL"],
  ["workouts", "calories", "REAL"],
  ["workouts", "avg_hr", "REAL"],
  ["workouts", "external_id", "TEXT"],
];

function migrate(database: Database.Database) {
  for (const [table, column, ddl] of ADDED_COLUMNS) {
    const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
    }
  }
}

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

function open() {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "macros.db"));
  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);
  seed(db);
  return db;
}

function seed(database: Database.Database) {
  // Idempotent, so exercises added in a later release land in databases that already exist.
  const insertExercise = database.prepare("INSERT OR IGNORE INTO exercises (name, muscle) VALUES (?, ?)");
  database.transaction(() => SEED_EXERCISES.forEach(([n, m]) => insertExercise.run(n, m)))();

  const routineCount = database.prepare("SELECT COUNT(*) AS n FROM routine_exercises").get() as { n: number };
  if (routineCount.n > 0) return;
  const findExercise = database.prepare("SELECT id FROM exercises WHERE name = ? COLLATE NOCASE");
  const insertRoutine = database.prepare(
    "INSERT OR IGNORE INTO routine_exercises (day, exercise_id, position) VALUES (?, ?, ?)",
  );
  database.transaction(() => {
    for (const [day, names] of Object.entries(SEED_ROUTINE)) {
      names.forEach((name, i) => {
        const row = findExercise.get(name) as { id: number } | undefined;
        if (row) insertRoutine.run(day, row.id, i);
      });
    }
  })();
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
