import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { analyzeFood } from "@/lib/ai";
import { db, photoPath } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";

const Body = z.object({
  image: z.string().startsWith("data:image/").optional(),
  text: z.string().max(1000).optional(),
  /** Re-analyze a photo that was already uploaded, e.g. after adding a correction. */
  photoId: z.string().uuid().optional(),
});

export const POST = handle(async (req: Request) => {
  const body = Body.parse(await req.json());
  const text = body.text?.trim();
  if (!body.image && !body.photoId && !text) return fail("Add a photo or describe what you ate");

  let photoId: string | null = null;
  let image = body.image;
  if (!image && body.photoId) {
    const row = db.prepare("SELECT filename FROM photos WHERE id = ?").get(body.photoId) as { filename: string } | undefined;
    if (!row) return fail("That photo is no longer available. Add it again.", 404);
    const ext = path.extname(row.filename).slice(1);
    const buf = fs.readFileSync(photoPath(row.filename));
    image = `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${buf.toString("base64")}`;
    photoId = body.photoId;
  } else if (body.image) {
    const m = body.image.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
    if (!m) return fail("Use a JPEG, PNG or WebP photo");
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 8 * 1024 * 1024) return fail("Photo is larger than 8 MB");
    photoId = randomUUID();
    const filename = `${photoId}.${m[1] === "jpeg" ? "jpg" : m[1]}`;
    fs.writeFileSync(photoPath(filename), buf);
    db.prepare("INSERT INTO photos (id, filename) VALUES (?, ?)").run(photoId, filename);
  }

  const analysis = await analyzeFood({ imageDataUrl: image, text });
  return json({ ...analysis, photoId });
});
