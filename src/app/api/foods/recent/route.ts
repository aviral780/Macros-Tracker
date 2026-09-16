import { handle, json } from "@/lib/http";
import { getRecentFoods } from "@/lib/queries";

export const GET = handle(async () => json({ foods: await getRecentFoods(60) }));
