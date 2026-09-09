const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.72;

export async function compressPhotoForGenerate(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;
  if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function compressPhotosForGenerate(files: File[]) {
  const prepared: File[] = [];
  for (const file of files.slice(0, 5)) {
    prepared.push(await compressPhotoForGenerate(file));
  }
  return prepared;
}
