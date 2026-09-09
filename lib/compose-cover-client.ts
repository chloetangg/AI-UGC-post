import { DEFAULT_COVER_FONT_ID, DEFAULT_COVER_TEMPLATE_ID } from "@/types/content";

export { DEFAULT_COVER_FONT_ID, DEFAULT_COVER_TEMPLATE_ID };

const COVER_MAX_EDGE = 1600;
const COVER_JPEG_QUALITY = 0.86;

function blobToFile(blob: Blob, name: string) {
  return blob instanceof File ? blob : new File([blob], name, { type: blob.type || "image/jpeg" });
}

async function compressCoverFile(file: Blob, name = "cover.jpg"): Promise<File> {
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
      canvas.toBlob(resolve, "image/jpeg", COVER_JPEG_QUALITY),
    );
    if (!blob) return blobToFile(file, name);
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return blobToFile(file, name);
  }
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
  form.append("format", "png");
  form.append("overlayEnabled", "true");
  form.append("dimPhoto", "false");
  form.append("crop", "attention");

  if (typeof input.image === "string") {
    form.append("imageUrl", input.image);
  } else {
    form.append("image", await compressCoverFile(input.image, "cover.jpg"));
  }

  for (const extra of input.images?.slice(0, 3) ?? []) {
    if (typeof extra === "string") {
      if (extra.trim()) form.append("imageUrls", extra);
      continue;
    }
    form.append("images", await compressCoverFile(extra, "tile.jpg"));
  }

  const response = await fetch("/api/compose-cover", {
    method: "POST",
    body: form,
  });

  let data: { imageUrl?: string; error?: string };
  try {
    data = (await response.json()) as { imageUrl?: string; error?: string };
  } catch {
    throw new Error("Cover generation failed");
  }

  if (!response.ok || !data.imageUrl) {
    throw new Error(data.error || "Cover generation failed");
  }

  return data.imageUrl;
}
