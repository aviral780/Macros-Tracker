import { get } from "@/lib/db";
import { fail, handle } from "@/lib/http";
import { readPhoto } from "@/lib/photos";

export const GET = handle(async (_req: Request, ctx: RouteContext<"/api/photos/[id]">) => {
  const { id } = await ctx.params;
  const row = await get<{ filename: string }>("SELECT filename FROM photos WHERE id = ?", [id]);
  if (!row) return fail("Photo not found", 404);
  const photo = await readPhoto(row.filename);
  if (!photo) return fail("Photo not found", 404);
  return new Response(new Uint8Array(photo.body), {
    headers: {
      "Content-Type": photo.contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
});
