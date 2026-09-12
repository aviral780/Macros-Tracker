export const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export type Macros = { calories: number; protein: number; carbs: number; fat: number };

export type FoodEntry = Macros & {
  id: number;
  date: string;
  meal: Meal;
  name: string;
  portion: string;
  grams: number | null;
  fiber: number;
  source: "photo" | "text" | "manual" | "recent";
  confidence: number | null;
  photo_id: string | null;
};

/** A food line before it is saved: what the AI returns and the review form edits. */
export type DraftItem = Macros & {
  key: string;
  name: string;
  portion: string;
  grams: number | null;
  fiber: number;
  confidence: number | null;
  include: boolean;
};

export type Sex = "male" | "female";
export type GoalType = "cut" | "maintain" | "bulk";

export type Profile = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number;
  goal: GoalType;
  /** Calorie adjustment for cut/bulk, as a fraction of TDEE (e.g. 0.2 = 20%). */
  rate: number;
  proteinPerKg: number;
  fatPct: number;
};

export type Goals = Macros & { source: "calculated" | "manual" };

export type WorkoutSet = { id: number; position: number; weight: number; reps: number; warmup: boolean };

export type WorkoutExercise = {
  id: number;
  exercise_id: number;
  name: string;
  muscle: string;
  sets: WorkoutSet[];
  /** Best estimated 1RM for this exercise from workouts before this one. */
  previousBest: number;
  last: { date: string; sets: { weight: number; reps: number }[] } | null;
};

export type Workout = {
  id: number;
  date: string;
  name: string;
  notes: string;
  exercises: WorkoutExercise[];
};

export type Exercise = { id: number; name: string; muscle: string; custom: boolean };

export type AIProvider = "gemini" | "groq" | "ollama" | "anthropic";
