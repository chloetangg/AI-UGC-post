import sharp from "sharp";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CoverComposeError,
  type CropMode,
} from "./types";

const FETCH_TIMEOUT_MS = 15_000;

const SUPPORTED_INPUT = new Set([
  "jpeg",
  "jpg",
  "png",
  "webp",
  "heif",
  "heic",
  "avif",
]);

function looksLikeHeic(buffer: Buffer): boolean {
  const header = buffer.subarray(0, 32).toString("ascii").toLowerCase();
  return header.includes("ftypheic") || header.includes("ftypheif") || header.includes("ftypmif1");
}

function cropPosition(crop: CropMode) {
  if (crop === "attention") return sharp.strategy.attention;
  if (crop === "center") return "centre";
  return "top";
}

export async function loadImageBuffer(input: {
  file?: File | null;
  url?: string | null;
  buffer?: Buffer | null;
}): Promise<Buffer> {
  if (input.buffer && input.buffer.length) {
    return input.buffer;
  }

  if (input.file) {
    const bytes = Buffer.from(await input.file.arrayBuffer());
    if (!bytes.length) {
      throw new CoverComposeError("image is required", 400);
    }
    return bytes;
  }

  const url = input.url?.trim();
  if (!url) {
    throw new CoverComposeError("image is required", 400);
  }

  if (url.startsWith("data:")) {
    const comma = url.indexOf(",");
    if (comma < 0) {
      throw new CoverComposeError("invalid image data URL", 400);
    }
    const encoded = url.slice(comma + 1);
    const bytes = Buffer.from(encoded, "base64");
    if (!bytes.length) {
      throw new CoverComposeError("image is required", 400);
    }
    return bytes;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CoverComposeError("image URL is invalid", 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new CoverComposeError("image URL must be http or https", 400);
  }

  let response: Response;
  try {
    response = await fetch(parsed, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch {
    throw new CoverComposeError("failed to fetch image URL", 400);
  }

  if (!response.ok) {
    throw new CoverComposeError(`failed to fetch image URL (${response.status})`, 400);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) {
    throw new CoverComposeError("image is required", 400);
  }
  return bytes;
}

export async function prepareBaseImage(
  input: Buffer,
  options?: {
    crop?: CropMode;
    dimPhoto?: boolean;
  },
): Promise<{ buffer: Buffer; dataUrl: string }> {
  if (looksLikeHeic(input)) {
    try {
      await sharp(input).metadata();
    } catch {
      throw new CoverComposeError(
        "HEIC conversion is optional and not available. Convert the photo to JPG or PNG first.",
        400,
      );
    }
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input).rotate().metadata();
  } catch {
    throw new CoverComposeError(
      "unsupported image. Use jpg, jpeg, png, or webp",
      400,
    );
  }

  const format = (metadata.format ?? "").toLowerCase();
  if (format && !SUPPORTED_INPUT.has(format)) {
    throw new CoverComposeError(
      "unsupported image. Use jpg, jpeg, png, or webp",
      400,
    );
  }

  const crop = options?.crop ?? "attention";

  try {
    let pipeline = sharp(input)
      .rotate()
      .resize(CANVAS_WIDTH, CANVAS_HEIGHT, {
        fit: "cover",
        position: cropPosition(crop),
        withoutEnlargement: false,
      });

    if (options?.dimPhoto) {
      pipeline = pipeline.modulate({ brightness: 0.92 });
    }

    const buffer = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    const dataUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    return { buffer, dataUrl };
  } catch {
    if (crop === "attention") {
      return prepareBaseImage(input, { ...options, crop: "center-top" });
    }
    throw new CoverComposeError("failed to crop image to 1080x1350", 400);
  }
}

export async function prepareTileImage(
  input: Buffer,
  width: number,
  height: number,
  options?: {
    crop?: CropMode;
    zoom?: number;
  },
): Promise<{ buffer: Buffer; dataUrl: string }> {
  const crop = options?.crop ?? "attention";
  const zoom = Math.max(1, options?.zoom ?? 1);
  const sourceWidth = Math.round(width * zoom);
  const sourceHeight = Math.round(height * zoom);

  try {
    const resized = await sharp(input)
      .rotate()
      .resize(sourceWidth, sourceHeight, {
        fit: "cover",
        position: cropPosition(crop),
        withoutEnlargement: false,
      })
      .toBuffer();

    const extracted = await sharp(resized)
      .extract({
        left: Math.max(0, Math.round((sourceWidth - width) / 2)),
        top: Math.max(0, Math.round((sourceHeight - height) / 2)),
        width,
        height,
      })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    return {
      buffer: extracted,
      dataUrl: `data:image/jpeg;base64,${extracted.toString("base64")}`,
    };
  } catch {
    if (crop === "attention") {
      return prepareTileImage(input, width, height, { ...options, crop: "center-top", zoom: 1 });
    }
    throw new CoverComposeError("failed to crop collage tile", 400);
  }
}

export async function encodeOutput(
  png: Buffer,
  format: "png" | "jpeg",
): Promise<{ buffer: Buffer; contentType: "image/png" | "image/jpeg" }> {
  if (format === "jpeg") {
    const buffer = await sharp(png).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    return { buffer, contentType: "image/jpeg" };
  }
  return { buffer: png, contentType: "image/png" };
}
