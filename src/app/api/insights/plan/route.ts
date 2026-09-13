import { handle, json } from "@/lib/http";
import { dayPlan } from "@/lib/insights";

export const GET = handle(async (req: Request) =>
  json(await dayPlan(new URL(req.url).searchParams.get("refresh") === "1")),
);
