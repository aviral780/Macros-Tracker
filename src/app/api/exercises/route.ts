import { handle, json } from "@/lib/http";
import { listExercises } from "@/lib/queries";

export const GET = handle(async () => json({ exercises: await listExercises() }));
