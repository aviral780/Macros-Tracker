import { z } from "zod";
import { get, run } from "@/lib/db";
import { isISODate, todayISO } from "@/lib/dates";
import { handle, json } from "@/lib/http";

/** Both bridges send text, and both send "" for a sample they couldn't read. */
const num = (max: number) =>
  z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : v),
      z.coerce.number().min(0).max(max).nullable(),
    )
    .default(null);

/** What an iOS Shortcut posts: one flat object for one day. */
const Flat = z.object({
  date: z.string().optional(),
  steps: num(200000),
  activeEnergy: num(20000),
  restingEnergy: num(10000),
  exerciseMinutes: num(1440),
  standHours: num(24),
  restingHeartRate: num(250),
  hrv: num(500),
  sleepHours: num(24),
  weightKg: num(400),
});

type Row = {
  steps: number | null;
  active_energy: number | null;
  resting_energy: number | null;
  exercise_minutes: number | null;
  stand_hours: number | null;
  resting_hr: number | null;
  hrv: number | null;
  sleep_hours: number | null;
  weight_kg: number | null;
};

const EMPTY: Row = {
  steps: null,
  active_energy: null,
  resting_energy: null,
  exercise_minutes: null,
  stand_hours: null,
  resting_hr: null,
  hrv: null,
  sleep_hours: null,
  weight_kg: null,
};

/** Health Auto Export metric names → our columns. */
const METRIC_COLUMN: Record<string, keyof Row> = {
  step_count: "steps",
  active_energy: "active_energy",
  basal_energy_burned: "resting_energy",
  apple_exercise_time: "exercise_minutes",
  apple_stand_hour: "stand_hours",
  resting_heart_rate: "resting_hr",
  heart_rate_variability: "hrv",
  sleep_analysis: "sleep_hours",
  weight_body_mass: "weight_kg",
};

const KJ_PER_KCAL = 4.184;
const KG_PER_LB = 0.45359237;

/** Auto Export honours the phone's units, so kJ and pounds both turn up. */
function convert(column: keyof Row, value: number, units: string) {
  const u = units.toLowerCase();
  if ((column === "active_energy" || column === "resting_energy") && u.includes("kj")) return value / KJ_PER_KCAL;
  if (column === "weight_kg" && (u.includes("lb") || u.includes("pound"))) return value * KG_PER_LB;
  if (column === "sleep_hours" && u.includes("min")) return value / 60;
  return value;
}

type Sample = Record<string, unknown>;

/** Sleep arrives as a breakdown; everything else is a plain qty. */
function sampleValue(column: keyof Row, sample: Sample) {
  if (column === "sleep_hours") {
    for (const key of ["totalSleep", "asleep", "value", "qty"]) {
      const v = Number(sample[key]);
      if (Number.isFinite(v) && v > 0) return v;
    }
    const deep = ["deep", "core", "rem"].reduce((sum, k) => sum + (Number(sample[k]) || 0), 0);
    return deep > 0 ? deep : null;
  }
  const v = Number(sample.qty ?? sample.value);
  return Number.isFinite(v) ? v : null;
}

const dayOf = (raw: unknown) => {
  const head = String(raw ?? "").slice(0, 10);
  return isISODate(head) ? head : null;
};

/** Auto Export posts every metric for a range at once, so fold it into one row per day. */
function foldAutoExport(payload: unknown) {
  const metrics = (payload as { data?: { metrics?: unknown[] } })?.data?.metrics;
  if (!Array.isArray(metrics)) return null;

  const days = new Map<string, Row>();
  for (const entry of metrics) {
    const metric = entry as { name?: string; units?: string; data?: Sample[] };
    const column = METRIC_COLUMN[String(metric.name ?? "").toLowerCase()];
    if (!column || !Array.isArray(metric.data)) continue;

    for (const sample of metric.data) {
      const date = dayOf(sample.date);
      if (!date) continue;
      const value = sampleValue(column, sample);
      if (value === null) continue;

      const row = days.get(date) ?? { ...EMPTY };
      const converted = convert(column, value, String(metric.units ?? ""));
      // Several samples can land on one day; counts add up, readings do not.
      row[column] =
        column === "resting_hr" || column === "hrv" || column === "weight_kg"
          ? converted
          : (row[column] ?? 0) + converted;
      days.set(date, row);
    }
  }
  return days.size > 0 ? days : null;
}

async function save(date: string, row: Row) {
  await run(
    `INSERT INTO daily_metrics (date, steps, active_energy, resting_energy, exercise_minutes, stand_hours, resting_hr, hrv, sleep_hours, weight_kg, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(date) DO UPDATE SET
       steps = COALESCE(excluded.steps, daily_metrics.steps),
       active_energy = COALESCE(excluded.active_energy, daily_metrics.active_energy),
       resting_energy = COALESCE(excluded.resting_energy, daily_metrics.resting_energy),
       exercise_minutes = COALESCE(excluded.exercise_minutes, daily_metrics.exercise_minutes),
       stand_hours = COALESCE(excluded.stand_hours, daily_metrics.stand_hours),
       resting_hr = COALESCE(excluded.resting_hr, daily_metrics.resting_hr),
       hrv = COALESCE(excluded.hrv, daily_metrics.hrv),
       sleep_hours = COALESCE(excluded.sleep_hours, daily_metrics.sleep_hours),
       weight_kg = COALESCE(excluded.weight_kg, daily_metrics.weight_kg),
       updated_at = datetime('now')`,
    [
      date,
      round(row.steps),
      round(row.active_energy),
      round(row.resting_energy),
      round(row.exercise_minutes),
      round(row.stand_hours),
      round(row.resting_hr),
      round(row.hrv),
      row.sleep_hours === null ? null : Math.round(row.sleep_hours * 100) / 100,
      row.weight_kg === null ? null : Math.round(row.weight_kg * 10) / 10,
    ],
  );

  // The weigh-in log and the Trends chart already read body_weight, so mirror it there.
  if (row.weight_kg !== null) {
    await run("INSERT INTO body_weight (date, kg) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET kg = excluded.kg", [
      date,
      Math.round(row.weight_kg * 10) / 10,
    ]);
  }
}

const round = (v: number | null) => (v === null ? null : Math.round(v));

export const GET = handle(async (req: Request) => {
  const param = new URL(req.url).searchParams.get("date");
  const date = isISODate(param) ? param : todayISO();
  const row = await get<Row & { date: string }>("SELECT * FROM daily_metrics WHERE date = ?", [date]);
  return json({ date, metrics: row ?? null });
});

export const POST = handle(async (req: Request) => {
  const payload = await req.json();

  const folded = foldAutoExport(payload);
  if (folded) {
    for (const [date, row] of folded) await save(date, row);
    return json({ ok: true, source: "auto-export", days: [...folded.keys()].sort() }, 201);
  }

  const b = Flat.parse(payload);
  const date = dayOf(b.date) ?? todayISO();
  await save(date, {
    steps: b.steps,
    active_energy: b.activeEnergy,
    resting_energy: b.restingEnergy,
    exercise_minutes: b.exerciseMinutes,
    stand_hours: b.standHours,
    resting_hr: b.restingHeartRate,
    hrv: b.hrv,
    sleep_hours: b.sleepHours,
    weight_kg: b.weightKg,
  });
  return json({ ok: true, source: "shortcut", date }, 201);
});
