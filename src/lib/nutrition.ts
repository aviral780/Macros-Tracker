import type { Goals, Macros, Profile } from "./types";

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: "Sedentary", hint: "Desk job, little walking" },
  { value: 1.375, label: "Light", hint: "Training 1–3 days a week" },
  { value: 1.55, label: "Moderate", hint: "Training 3–5 days a week" },
  { value: 1.725, label: "Very active", hint: "Hard training 6–7 days a week" },
  { value: 1.9, label: "Athlete", hint: "Twice-a-day training or physical job" },
];

export const DEFAULT_PROFILE: Profile = {
  sex: "male",
  age: 25,
  heightCm: 175,
  weightKg: 75,
  activity: 1.55,
  goal: "maintain",
  rate: 0.15,
  proteinPerKg: 2,
  fatPct: 0.25,
};

export const DEFAULT_GOALS: Goals = {
  calories: 2400,
  protein: 150,
  carbs: 280,
  fat: 70,
  source: "calculated",
};

/** Mifflin–St Jeor resting energy expenditure. */
export function bmr(p: Profile) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === "male" ? base + 5 : base - 161;
}

export function tdee(p: Profile) {
  return bmr(p) * p.activity;
}

export function calculateGoals(p: Profile): Macros & { bmr: number; tdee: number } {
  const maintenance = tdee(p);
  const factor = p.goal === "cut" ? 1 - p.rate : p.goal === "bulk" ? 1 + p.rate : 1;
  const calories = Math.round((maintenance * factor) / 10) * 10;
  const protein = Math.round(p.proteinPerKg * p.weightKg);
  const fat = Math.round((calories * p.fatPct) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat, bmr: Math.round(bmr(p)), tdee: Math.round(maintenance) };
}

/**
 * The day's real budget, from what the watch actually measured.
 *
 * Apple splits a day into resting and active burn, and the two together are the
 * measured TDEE. The profile's activity multiplier is a different thing entirely:
 * an estimate that already assumes a week of training. Adding active energy on top
 * of it would count every session twice, so this replaces that estimate rather than
 * adjusting it.
 */
export function measuredBudget(
  p: Profile,
  measured: { restingEnergy: number | null; activeEnergy: number | null },
) {
  if (measured.activeEnergy === null) return null;
  const resting = measured.restingEnergy ?? bmr(p);
  const total = resting + measured.activeEnergy;
  const factor = p.goal === "cut" ? 1 - p.rate : p.goal === "bulk" ? 1 + p.rate : 1;
  return {
    calories: Math.round((total * factor) / 10) * 10,
    tdee: Math.round(total),
    resting: Math.round(resting),
    active: Math.round(measured.activeEnergy),
    estimatedResting: measured.restingEnergy === null,
  };
}

export function sumMacros<T extends Macros>(rows: T[]): Macros {
  return rows.reduce(
    (acc, r) => ({
      calories: acc.calories + r.calories,
      protein: acc.protein + r.protein,
      carbs: acc.carbs + r.carbs,
      fat: acc.fat + r.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export const round = (n: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export const fmt = (n: number, dp = 0) =>
  round(n, dp).toLocaleString("en-US", { maximumFractionDigits: dp });
