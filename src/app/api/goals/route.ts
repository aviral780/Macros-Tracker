import { z } from "zod";
import { run, setSetting } from "@/lib/db";
import { todayISO } from "@/lib/dates";
import { handle, json } from "@/lib/http";
import { getGoals, getProfile, hasGoals } from "@/lib/queries";

const Profile = z.object({
  sex: z.enum(["male", "female"]),
  age: z.coerce.number().int().min(13, "Age must be 13 or older").max(100),
  heightCm: z.coerce.number().min(100, "Height looks off — use centimetres").max(250),
  weightKg: z.coerce.number().min(30, "Weight looks off — use kilograms").max(300),
  activity: z.coerce.number().min(1.1).max(2.1),
  goal: z.enum(["cut", "maintain", "bulk"]),
  rate: z.coerce.number().min(0).max(0.3),
  proteinPerKg: z.coerce.number().min(0.8).max(3.5),
  fatPct: z.coerce.number().min(0.15).max(0.45),
});

const Goals = z.object({
  calories: z.coerce.number().int().min(800, "Calories must be at least 800").max(8000),
  protein: z.coerce.number().min(0).max(600),
  carbs: z.coerce.number().min(0).max(1200),
  fat: z.coerce.number().min(0).max(400),
  source: z.enum(["calculated", "manual"]),
});

export const GET = handle(async () => {
  const [profile, goals, goalsSet] = await Promise.all([getProfile(), getGoals(), hasGoals()]);
  return json({ profile, goals, goalsSet });
});

export const PUT = handle(async (req: Request) => {
  const body = z.object({ profile: Profile, goals: Goals }).parse(await req.json());
  await setSetting("profile", body.profile);
  await setSetting("goals", body.goals);
  // Keep the body-weight log in step with the profile.
  await run("INSERT INTO body_weight (date, kg) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET kg = excluded.kg", [
    todayISO(),
    body.profile.weightKg,
  ]);
  return json({ ok: true });
});
