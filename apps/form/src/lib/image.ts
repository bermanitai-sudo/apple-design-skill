/** Downscale a photo in the browser so uploads stay small and fast. Returns a JPEG data URL. */
export async function resizeImage(file: Blob, maxSide: number, quality = 0.82): Promise<string> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('Canvas unavailable');
  g.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ('close' in bitmap) (bitmap as ImageBitmap).close();
  return canvas.toDataURL('image/jpeg', quality);
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall through to <img> decoding, e.g. HEIC on older Safari */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
