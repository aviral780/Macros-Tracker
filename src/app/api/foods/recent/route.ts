import { handle, json } from "@/lib/http";
import { getRecentFoods } from "@/lib/queries";

export const GET = handle(() => json({ foods: getRecentFoods(60) }));
