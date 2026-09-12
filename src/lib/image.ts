"use client";

/** Downscales a photo in the browser before upload: smaller payloads, faster analysis, same accuracy. */
export async function photoToDataUrl(file: File, maxSide = 1280, quality = 0.85): Promise<string> {
  let source: CanvasImageSource;
  let width: number;
  let height: number;
  let cleanup = () => {};

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    source = bitmap;
    width = bitmap.width;
    height = bitmap.height;
    cleanup = () => bitmap.close();
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("This browser can't open that photo format. Save it as JPEG or PNG and try again.");
    }
    source = img;
    width = img.naturalWidth;
    height = img.naturalHeight;
    cleanup = () => URL.revokeObjectURL(url);
  }

  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  cleanup();
  return canvas.toDataURL("image/jpeg", quality);
}
