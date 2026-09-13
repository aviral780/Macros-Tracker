import type { Macros } from "./types";

export type FoodTag = { label: string; tone: "good" | "neutral" | "warn" };

/**
 * Everything here is arithmetic on the macros, so it renders instantly on every row
 * with no model call. AI is reserved for judgment the numbers can't give.
 */
export function foodTags(item: Macros & { fiber?: number; grams?: number | null }): FoodTag[] {
  const kcal = item.calories;
  if (kcal <= 0) return [];

  const tags: FoodTag[] = [];
  const fromProtein = (item.protein * 4) / kcal;
  const fromCarbs = (item.carbs * 4) / kcal;
  const fromFat = (item.fat * 9) / kcal;
  const fibre = item.fiber ?? 0;

  if (fromProtein >= 0.35) tags.push({ label: "High protein", tone: "good" });
  else if (fromProtein >= 0.22) tags.push({ label: "Good protein", tone: "good" });

  if (fibre >= 6) tags.push({ label: "High fibre", tone: "good" });
  else if (fibre >= 3) tags.push({ label: "Some fibre", tone: "good" });

  if (fromFat >= 0.5) tags.push({ label: "Fat heavy", tone: "warn" });
  if (fromCarbs >= 0.65 && fromProtein < 0.15) tags.push({ label: "Mostly carbs", tone: "neutral" });

  if (item.grams && item.grams > 0) {
    const per100g = (kcal / item.grams) * 100;
    if (per100g >= 400) tags.push({ label: "Calorie dense", tone: "warn" });
    else if (per100g <= 80) tags.push({ label: "Light", tone: "good" });
  }

  return tags;
}

/** Grams of protein per 100 kcal — the number that matters most when cutting. */
export const proteinDensity = (m: Macros) => (m.calories > 0 ? (m.protein / m.calories) * 100 : 0);
