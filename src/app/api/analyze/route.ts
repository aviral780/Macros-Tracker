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
  let pendingPhoto: { id: string; ext: string; bytes: Buffer } | null = null;

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
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length > 8 * 1024 * 1024) return fail("Photo is larger than 8 MB");
    pendingPhoto = { id: randomUUID(), ext: m[1] === "jpeg" ? "jpg" : m[1], bytes };
  }

  // Read the food first. The model already has the image in hand, so keeping the picture
  // is a nice-to-have — losing the whole analysis because storage is misconfigured is not.
  const analysis = await analyzeFood({ imageDataUrl: image, text });

  let photoWarning: string | null = null;
  if (pendingPhoto) {
    try {
      const ref = await savePhoto(pendingPhoto.id, pendingPhoto.ext, pendingPhoto.bytes);
      await run("INSERT INTO photos (id, filename) VALUES (?, ?)", [pendingPhoto.id, ref]);
      photoId = pendingPhoto.id;
    } catch (e) {
      console.error("Couldn't keep the photo:", e);
      photoWarning = "Your food was analysed, but the photo couldn't be saved.";
    }
  }

  return json({ ...analysis, photoId, photoWarning });
});
