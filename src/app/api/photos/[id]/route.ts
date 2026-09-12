import fs from "node:fs";
import path from "node:path";
import { db, photoPath } from "@/lib/db";
import { fail, handle } from "@/lib/http";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/photos/[id]">) => {
  const { id } = await ctx.params;
  const row = db.prepare("SELECT filename FROM photos WHERE id = ?").get(id) as { filename: string } | undefined;
  if (!row) return fail("Photo not found", 404);
  const file = photoPath(row.filename);
  if (!fs.existsSync(file)) return fail("Photo not found", 404);
  return new Response(fs.readFileSync(file), {
    headers: {
      "Content-Type": TYPES[path.extname(file).slice(1)] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});
