import { handle, json } from "@/lib/http";
import { trainingInsight } from "@/lib/insights";

export const GET = handle(async (req: Request) =>
  json(await trainingInsight(new URL(req.url).searchParams.get("refresh") === "1")),
);
