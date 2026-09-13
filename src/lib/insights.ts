import "server-only";
import { z } from "zod";
import { askJSON } from "./ai";
import { db } from "./db";
import { getGoals, getPlan } from "./queries";

type Cached<T> = { payload: T; model: string; created_at: string };

function readCache<T>(kind: string, subject: string, maxAgeDays?: number): Cached<T> | null {
  const row = db
    .prepare("SELECT payload, model, created_at FROM insights WHERE kind = ? AND subject = ?")
    .get(kind, subject.toLowerCase()) as { payload: string; model: string; created_at: string } | undefined;
  if (!row) return null;
  if (maxAgeDays !== undefined) {
    const age = (Date.now() - Date.parse(row.created_at + "Z")) / 86_400_000;
    if (age > maxAgeDays) return null;
  }
  try {
    return { payload: JSON.parse(row.payload) as T, model: row.model, created_at: row.created_at };
  } catch {
    return null;
  }
}

function writeCache(kind: string, subject: string, payload: unknown, model: string) {
  db.prepare(
    `INSERT INTO insights (kind, subject, payload, model, created_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(kind, subject) DO UPDATE SET payload = excluded.payload, model = excluded.model, created_at = excluded.created_at`,
  ).run(kind, subject.toLowerCase(), JSON.stringify(payload), model);
}

const list = (max: number) => z.array(z.string()).catch([]).transform((a) => a.slice(0, max));

// ---------------------------------------------------------------- exercises

const ExerciseInsightSchema = z.object({
  primary: list(3),
  secondary: list(4),
  summary: z.string().catch(""),
  cues: list(3),
  alternatives: z
    .array(z.object({ name: z.string(), why: z.string().catch("") }))
    .catch([])
    .transform((a) => a.slice(0, 4)),
});
export type ExerciseInsight = z.infer<typeof ExerciseInsightSchema>;

const EXERCISE_SYSTEM = `You are a strength coach writing reference notes for a lifter's training app. Be specific and practical, never generic.

Rules:
- primary: the 1-3 muscles doing most of the work. Use plain names ("upper chest", "lats", "long head of triceps").
- secondary: muscles meaningfully assisting.
- summary: one or two sentences on what this lift is actually good for and where it sits in a session.
- cues: 2-3 short form cues that change the outcome, not platitudes. No "keep good form".
- alternatives: 3-4 genuine swaps that train the same thing, each with one clause on how it differs (more stretch, easier on shoulders, more stable, better for overload).

Respond with JSON only:
{"primary":["..."],"secondary":["..."],"summary":"...","cues":["..."],"alternatives":[{"name":"...","why":"..."}]}`;

export async function exerciseInsight(exerciseId: number) {
  const ex = db.prepare("SELECT id, name, muscle FROM exercises WHERE id = ?").get(exerciseId) as
    | { id: number; name: string; muscle: string }
    | undefined;
  if (!ex) return null;

  const key = `${ex.id}`;
  const hit = readCache<ExerciseInsight>("exercise", key);
  if (hit) return { exercise: ex, ...hit };

  const { data, model } = await askJSON({
    system: EXERCISE_SYSTEM,
    user: `Exercise: ${ex.name}\nLogged muscle group: ${ex.muscle}\nThe lifter trains six days a week on this split: ${getPlan().days.join(", ")}. Suggest alternatives that fit those days.`,
    schema: ExerciseInsightSchema,
  });
  writeCache("exercise", key, data, model);
  return { exercise: ex, payload: data, model, created_at: new Date().toISOString() };
}

// ---------------------------------------------------------------- foods

const FoodInsightSchema = z.object({
  verdict: z.enum(["great", "solid", "okay", "occasional"]).catch("okay"),
  headline: z.string().catch(""),
  why: z.string().catch(""),
  swap: z.string().nullish().transform((v) => v ?? null),
});
export type FoodInsight = z.infer<typeof FoodInsightSchema>;

const FOOD_SYSTEM = `You are a sports dietitian reviewing one food a strength athlete just logged. They lift six days a week and are eating in a slight deficit with a high protein target.

Rules:
- verdict: "great" (hits protein or fibre hard for the calories), "solid" (useful, no issue), "okay" (fine in context, nothing special), "occasional" (calorie dense or low nutrition for the cost).
- headline: at most 6 words, concrete. e.g. "Cheap protein, almost no fat".
- why: one or two sentences tied to the actual numbers given. Mention protein per calorie or fibre when that is the story.
- swap: only when a genuinely better option exists for the same role, phrased as one short sentence. Otherwise null.
- Never moralise about food. No "clean" or "bad" framing.

Respond with JSON only:
{"verdict":"...","headline":"...","why":"...","swap":null}`;

export async function foodInsight(name: string, macros: { calories: number; protein: number; carbs: number; fat: number; fiber: number; grams?: number | null }) {
  const hit = readCache<FoodInsight>("food", name);
  if (hit) return { name, ...hit };

  const per = macros.grams ? ` for ${Math.round(macros.grams)} g` : "";
  const { data, model } = await askJSON({
    system: FOOD_SYSTEM,
    user: `Food: ${name}${per}\nCalories ${Math.round(macros.calories)}, protein ${Math.round(macros.protein)} g, carbs ${Math.round(macros.carbs)} g, fat ${Math.round(macros.fat)} g, fibre ${Math.round(macros.fiber)} g.`,
    schema: FoodInsightSchema,
    maxTokens: 600,
  });
  writeCache("food", name, data, model);
  return { name, payload: data, model, created_at: new Date().toISOString() };
}

// ---------------------------------------------------------------- taste

/** What they actually eat, most repeated first — the raw material for taste and planning. */
export function foodHistory(limit = 50) {
  return db
    .prepare(
      `SELECT name, COUNT(*) AS times,
         ROUND(AVG(calories)) AS calories, ROUND(AVG(protein)) AS protein,
         ROUND(AVG(carbs)) AS carbs, ROUND(AVG(fat)) AS fat, ROUND(AVG(fiber)) AS fiber,
         MAX(date) AS last_eaten
       FROM food_entries
       GROUP BY lower(name)
       ORDER BY times DESC, MAX(id) DESC
       LIMIT ?`,
    )
    .all(limit) as {
    name: string;
    times: number;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    last_eaten: string;
  }[];
}

export function loggingDays() {
  const row = db.prepare("SELECT COUNT(DISTINCT date) AS n FROM food_entries").get() as { n: number };
  return row.n;
}

const TasteSchema = z.object({
  summary: z.string().catch(""),
  likes: list(5),
  strengths: list(4),
  gaps: list(4),
  suggestions: z
    .array(
      z.object({
        name: z.string(),
        why: z.string().catch(""),
        calories: z.coerce.number().catch(0),
        protein: z.coerce.number().catch(0),
      }),
    )
    .catch([])
    .transform((a) => a.slice(0, 6)),
});
export type TasteProfile = z.infer<typeof TasteSchema>;

const TASTE_SYSTEM = `You are a sports dietitian who has been handed one athlete's real food log. Read what they actually eat and describe their taste honestly, then suggest new foods they would plausibly enjoy.

Rules:
- summary: two sentences on the shape of their diet — cuisine, protein sources, how they seem to eat across the day.
- likes: concrete patterns you can see in the log, not guesses. Name actual foods.
- strengths: what their diet already does well against a high-protein lifting goal.
- gaps: what is genuinely missing or short. Be direct but not preachy.
- suggestions: 4-6 NEW foods they have not logged, each close enough to what they already eat that they would actually like it. "why" must reference their existing habits. Give realistic calories and protein for one normal portion.
- Respect the cuisine they clearly eat. Do not push unfamiliar Western staples at someone eating Indian food, or vice versa.

Respond with JSON only:
{"summary":"...","likes":["..."],"strengths":["..."],"gaps":["..."],"suggestions":[{"name":"...","why":"...","calories":0,"protein":0}]}`;

export async function tasteProfile(force = false) {
  const history = foodHistory();
  const days = loggingDays();
  if (history.length < 5) {
    return { ready: false as const, days, needed: 5, entries: history.length };
  }

  if (!force) {
    const hit = readCache<TasteProfile>("taste", "me", 7);
    if (hit) return { ready: true as const, days, ...hit };
  }

  const goals = getGoals();
  const lines = history
    .map((f) => `${f.name} — eaten ${f.times}x, ${f.calories} kcal, ${f.protein} g protein, ${f.carbs} g carbs, ${f.fat} g fat, ${f.fiber} g fibre`)
    .join("\n");

  const { data, model } = await askJSON({
    system: TASTE_SYSTEM,
    user: `Daily targets: ${goals.calories} kcal, ${goals.protein} g protein, ${goals.carbs} g carbs, ${goals.fat} g fat.\nThey have logged food on ${days} days. Their log, most repeated first:\n\n${lines}`,
    schema: TasteSchema,
    maxTokens: 1600,
  });
  writeCache("taste", "me", data, model);
  return { ready: true as const, days, payload: data, model, created_at: new Date().toISOString() };
}

// ---------------------------------------------------------------- day plan

const PlanItemSchema = z.object({
  name: z.string(),
  portion: z.string().catch(""),
  calories: z.coerce.number().catch(0),
  protein: z.coerce.number().catch(0),
  carbs: z.coerce.number().catch(0),
  fat: z.coerce.number().catch(0),
});

const DayPlanSchema = z.object({
  summary: z.string().catch(""),
  meals: z
    .array(z.object({ meal: z.string(), items: z.array(PlanItemSchema).catch([]) }))
    .catch([])
    .transform((a) => a.slice(0, 5)),
  totals: z
    .object({
      calories: z.coerce.number().catch(0),
      protein: z.coerce.number().catch(0),
      carbs: z.coerce.number().catch(0),
      fat: z.coerce.number().catch(0),
    })
    .catch({ calories: 0, protein: 0, carbs: 0, fat: 0 }),
});
export type DayPlan = z.infer<typeof DayPlanSchema>;

/** Models reliably miscount their own plans, so totals are always summed from the items. */
function sumPlan(plan: DayPlan) {
  return plan.meals
    .flatMap((m) => m.items)
    .reduce(
      (a, i) => ({
        calories: Math.round(a.calories + i.calories),
        protein: Math.round(a.protein + i.protein),
        carbs: Math.round(a.carbs + i.carbs),
        fat: Math.round(a.fat + i.fat),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
}

const offTarget = (t: { calories: number; protein: number }, goal: { calories: number; protein: number }) =>
  Math.abs(t.calories - goal.calories) > goal.calories * 0.05 || t.protein < goal.protein * 0.95;

const PLAN_SYSTEM = `You are a sports dietitian building one day of eating for a strength athlete, using foods they already eat and enjoy.

Rules:
- Build breakfast, lunch, dinner and one snack block. Use their logged foods wherever possible; at most two new items, and only ones that match their cuisine.
- The day's totals must land within 3% of the calorie target and at or above the protein target. Do the arithmetic and make it add up.
- Give each item a realistic household portion ("2 rotis", "1 katori", "200 g").
- summary: one or two sentences on how the day is built and where the protein comes from.
- totals must be the actual sum of the items you listed.

Respond with JSON only:
{"summary":"...","meals":[{"meal":"Breakfast","items":[{"name":"...","portion":"...","calories":0,"protein":0,"carbs":0,"fat":0}]}],"totals":{"calories":0,"protein":0,"carbs":0,"fat":0}}`;

export async function dayPlan(force = false) {
  const history = foodHistory(40);
  if (history.length < 5) return { ready: false as const, entries: history.length, needed: 5 };

  if (!force) {
    const hit = readCache<DayPlan>("dayplan", "me", 3);
    if (hit) return { ready: true as const, ...hit };
  }

  const goals = getGoals();
  const lines = history.map((f) => `${f.name} (${f.times}x) — ${f.calories} kcal, ${f.protein}P ${f.carbs}C ${f.fat}F`).join("\n");
  const brief = `Targets for the day: ${goals.calories} kcal, ${goals.protein} g protein, ${goals.carbs} g carbs, ${goals.fat} g fat.\nFoods they actually eat:\n\n${lines}`;

  const ask = (user: string) =>
    askJSON({ system: PLAN_SYSTEM, user, schema: DayPlanSchema, maxTokens: 2500 });

  let { data, model } = await ask(brief);
  let totals = sumPlan(data);

  // One corrective pass with the real arithmetic fed back, which is what actually lands it.
  if (offTarget(totals, goals)) {
    const retry = await ask(
      `${brief}\n\nYour previous plan summed to ${totals.calories} kcal and ${totals.protein} g protein, which misses the target. Rebuild it so the items themselves add up to ${goals.calories} kcal (within 3%) and at least ${goals.protein} g protein. Adjust portions rather than adding many new foods.`,
    );
    const retryTotals = sumPlan(retry.data);
    // Keep whichever attempt actually lands closer on calories.
    if (Math.abs(retryTotals.calories - goals.calories) < Math.abs(totals.calories - goals.calories)) {
      data = retry.data;
      model = retry.model;
      totals = retryTotals;
    }
  }

  const payload: DayPlan = { ...data, totals };
  writeCache("dayplan", "me", payload, model);
  return { ready: true as const, payload, model, created_at: new Date().toISOString() };
}
