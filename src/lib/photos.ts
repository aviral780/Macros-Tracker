import "server-only";
import fs from "node:fs";
import path from "node:path";
import { PHOTO_DIR, photoPath } from "./db";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * Photos live on Vercel Blob in production and on disk in development, so local work
 * needs no cloud account. `photos.filename` holds whichever reference was written:
 * a URL from blob storage, or a bare filename on disk.
 */
const usingBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export const contentTypeFor = (ext: string) => TYPES[ext.toLowerCase()] ?? "application/octet-stream";

export async function savePhoto(id: string, ext: string, body: Buffer): Promise<string> {
  const name = `${id}.${ext}`;
  if (usingBlob()) {
    const { put } = await import("@vercel/blob");
    const saved = await put(`photos/${name}`, body, {
      access: "public",
      contentType: contentTypeFor(ext),
      addRandomSuffix: false,
    });
    return saved.url;
  }
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  fs.writeFileSync(photoPath(name), body);
  return name;
}

export async function readPhoto(ref: string): Promise<{ body: Buffer; contentType: string } | null> {
  if (/^https?:\/\//.test(ref)) {
    const res = await fetch(ref, { cache: "no-store" });
    if (!res.ok) return null;
    return {
      body: Buffer.from(await res.arrayBuffer()),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
    };
  }
  const file = photoPath(ref);
  if (!fs.existsSync(file)) return null;
  return { body: fs.readFileSync(file), contentType: contentTypeFor(path.extname(file).slice(1)) };
}

export async function deletePhoto(ref: string) {
  if (/^https?:\/\//.test(ref)) {
    const { del } = await import("@vercel/blob");
    await del(ref).catch(() => {});
    return;
  }
  const file = photoPath(ref);
  if (fs.existsSync(file)) fs.rmSync(file, { force: true });
}
