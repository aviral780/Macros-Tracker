import { handle, json } from "@/lib/http";
import { tasteProfile } from "@/lib/insights";

export const GET = handle(async (req: Request) =>
  json(await tasteProfile(new URL(req.url).searchParams.get("refresh") === "1")),
);
