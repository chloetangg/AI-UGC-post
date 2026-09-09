import { DEFAULT_COVER_FONT_ID, DEFAULT_COVER_TEMPLATE_ID } from "@/types/content";

export { DEFAULT_COVER_FONT_ID, DEFAULT_COVER_TEMPLATE_ID };

const COVER_MAX_EDGE = 1080;
const JPEG_QUALITY = 0.7;
const SKIP_IF_SMALLER_THAN = 280_000;
const compressedCoverFiles = new Map<string, File>();

function blobToFile(blob: Blob, name: string) {
  return blob instanceof File ? blob : new File([blob], name, { type: blob.type || "image/jpeg" });
}

function cacheKey(file: Blob, name: string) {
  if (file instanceof File) return `${file.name}:${file.size}:${file.lastModified}:${COVER_MAX_EDGE}`;
  return `${name}:${file.size}:${COVER_MAX_EDGE}`;
}

async function compressCoverFile(file: Blob, name = "cover.jpg"): Promise<File> {
  const key = cacheKey(file, name);
  const cached = compressedCoverFiles.get(key);
  if (cached) return cached;
  if (file instanceof File && file.type === "image/jpeg" && file.size <= SKIP_IF_SMALLER_THAN) {
    compressedCoverFiles.set(key, file);
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, COVER_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return blobToFile(file, name);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return blobToFile(file, name);
    const compressed = new File([blob], name, { type: "image/jpeg" });
    compressedCoverFiles.set(key, compressed);
    return compressed;
  } catch {
    return blobToFile(file, name);
  }
}

export function preloadCoverFile(file: Blob, name = "cover.jpg") {
  void compressCoverFile(file, name);
}

export function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Cover generation failed"));
    };
    reader.onerror = () => reject(new Error("Cover generation failed"));
    reader.readAsDataURL(file);
  });
}

export async function composeCoverImage(input: {
  image: File | Blob | string;
  images?: Array<File | Blob | string>;
  title: string;
  subtitle?: string;
  templateId?: string;
  fontId?: string;
}) {
  const form = new FormData();
  form.append("title", input.title);
  form.append("subtitle", input.subtitle || "");
  form.append("templateId", input.templateId || DEFAULT_COVER_TEMPLATE_ID);
  if (input.fontId) form.append("fontId", input.fontId);
  form.append("format", "jpeg");
  form.append("overlayEnabled", "true");
  form.append("dimPhoto", "false");
  form.append("crop", "attention");

  const extras = input.images?.slice(0, 3) ?? [];
  const [main, ...tiles] = await Promise.all([
    typeof input.image === "string" ? Promise.resolve(input.image) : compressCoverFile(input.image, "cover.jpg"),
    ...extras.map((extra, index) =>
      typeof extra === "string" ? Promise.resolve(extra) : compressCoverFile(extra, `tile-${index + 1}.jpg`),
    ),
  ]);

  if (typeof main === "string") form.append("imageUrl", main);
  else form.append("image", main);

  for (const extra of tiles) {
    if (typeof extra === "string") {
      if (extra.trim()) form.append("imageUrls", extra);
      continue;
    }
    form.append("images", extra);
  }

  const response = await fetch("/api/compose-cover?raw=1", {
    method: "POST",
    body: form,
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    let message = "Cover generation failed";
    if (contentType.includes("application/json")) {
      try {
        const data = (await response.json()) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        /* keep default */
      }
    }
    throw new Error(message);
  }

  if (contentType.includes("application/json")) {
    let data: { imageUrl?: string; error?: string };
    try {
      data = (await response.json()) as { imageUrl?: string; error?: string };
    } catch {
      throw new Error("Cover generation failed");
    }
    if (!data.imageUrl) throw new Error(data.error || "Cover generation failed");
    return data.imageUrl;
  }

  const blob = await response.blob();
  if (!blob.size) throw new Error("Cover generation failed");
  return URL.createObjectURL(blob);
}
