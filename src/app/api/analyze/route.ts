import { randomUUID } from "node:crypto";
import { z } from "zod";
import { analyzeFood } from "@/lib/ai";
import { get, run } from "@/lib/db";
import { fail, handle, json } from "@/lib/http";
import { readPhoto, savePhoto } from "@/lib/photos";

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
    const row = await get<{ filename: string }>("SELECT filename FROM photos WHERE id = ?", [body.photoId]);
    if (!row) return fail("That photo is no longer available. Add it again.", 404);
    const stored = await readPhoto(row.filename);
    if (!stored) return fail("That photo is no longer available. Add it again.", 404);
    image = `data:${stored.contentType};base64,${stored.body.toString("base64")}`;
    photoId = body.photoId;
  } else if (body.image) {
    const m = body.image.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
    if (!m) return fail("Use a JPEG, PNG or WebP photo");
    const buf = Buffer.from(m[2], "base64");
    if (buf.length > 8 * 1024 * 1024) return fail("Photo is larger than 8 MB");
    photoId = randomUUID();
    const ref = await savePhoto(photoId, m[1] === "jpeg" ? "jpg" : m[1], buf);
    await run("INSERT INTO photos (id, filename) VALUES (?, ?)", [photoId, ref]);
  }

  const analysis = await analyzeFood({ imageDataUrl: image, text });
  return json({ ...analysis, photoId });
});
