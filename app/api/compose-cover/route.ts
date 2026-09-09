import { NextResponse } from "next/server";
import { composeCover } from "@/lib/cover/compose";
import { loadImageBuffer } from "@/lib/cover/image";
import { CoverComposeError, type CropMode, type FontId } from "@/lib/cover/types";
import { isFontId } from "@/lib/cover/font-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isCropMode(value: string | null): value is CropMode {
  return value === "attention" || value === "center-top" || value === "center";
}

function readBoolean(value: FormDataEntryValue | string | null, fallback: boolean) {
  if (value == null || value === "") return fallback;
  const text = String(value).toLowerCase();
  if (text === "true" || text === "1") return true;
  if (text === "false" || text === "0") return false;
  return fallback;
}

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const imageEntry = form.get("image");
    const imageFile = imageEntry instanceof File ? imageEntry : null;
    const imageUrl =
      typeof form.get("imageUrl") === "string" ? String(form.get("imageUrl")) : null;

    const extraFiles = form
      .getAll("images")
      .filter((item): item is File => item instanceof File);
    const extraUrls = form
      .getAll("imageUrls")
      .filter((item): item is string => typeof item === "string");

    return {
      title: String(form.get("title") ?? ""),
      subtitle: String(form.get("subtitle") ?? ""),
      badge: String(form.get("badge") ?? ""),
      templateId: String(form.get("templateId") ?? ""),
      format: String(form.get("format") ?? "png"),
      overlayEnabled: readBoolean(form.get("overlayEnabled"), true),
      dimPhoto: readBoolean(form.get("dimPhoto"), false),
      crop: String(form.get("crop") ?? "attention"),
      fontId: String(form.get("fontId") ?? ""),
      imageFile,
      imageUrl,
      extraFiles,
      extraUrls,
    };
  }

  const json = (await request.json()) as Record<string, unknown>;
  const extraUrls = Array.isArray(json.images)
    ? json.images.filter((item): item is string => typeof item === "string")
    : [];
  return {
    title: String(json.title ?? ""),
    subtitle: String(json.subtitle ?? ""),
    badge: String(json.badge ?? ""),
    templateId: String(json.templateId ?? ""),
    format: String(json.format ?? "png"),
    overlayEnabled: readBoolean(
      typeof json.overlayEnabled === "boolean" || typeof json.overlayEnabled === "string"
        ? String(json.overlayEnabled)
        : null,
      true,
    ),
    dimPhoto: readBoolean(
      typeof json.dimPhoto === "boolean" || typeof json.dimPhoto === "string"
        ? String(json.dimPhoto)
        : null,
      false,
    ),
    crop: String(json.crop ?? "attention"),
    fontId: typeof json.fontId === "string" ? json.fontId : "",
    imageFile: null as File | null,
    imageUrl: typeof json.image === "string" ? json.image : null,
    extraFiles: [] as File[],
    extraUrls,
  };
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request);
    const format = body.format === "jpeg" || body.format === "jpg" ? "jpeg" : "png";
    const crop = isCropMode(body.crop) ? body.crop : "attention";
    let fontId: FontId | undefined;
    if (body.fontId) {
      if (!isFontId(body.fontId)) {
        return NextResponse.json({ error: `Unknown fontId: ${body.fontId}` }, { status: 400 });
      }
      fontId = body.fontId;
    }

    if (!body.templateId) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }
    if (!body.title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const extraUrls = body.extraUrls.filter((url) => url.trim()).slice(0, 4);
    const [image, extraLoaded] = await Promise.all([
      loadImageBuffer({
        file: body.imageFile,
        url: body.imageUrl,
      }),
      Promise.all(
        [
          ...body.extraFiles.slice(0, 4).map((file) => loadImageBuffer({ file })),
          ...extraUrls.map((url) => loadImageBuffer({ url })),
        ].map((task) =>
          task.catch((error) => {
            console.warn("Skipping extra cover image", error);
            return null;
          }),
        ),
      ),
    ]);
    const extraImages = extraLoaded
      .filter((item): item is Buffer => Boolean(item))
      .slice(0, 4);

    const result = await composeCover({
      image,
      images: extraImages,
      templateId: body.templateId,
      title: body.title,
      subtitle: body.subtitle.trim() || undefined,
      badge: body.badge.trim() || undefined,
      format,
      overlayEnabled: body.overlayEnabled,
      dimPhoto: body.dimPhoto,
      crop,
      fontId,
    });

    const raw = new URL(request.url).searchParams.get("raw");
    if (raw === "1" || raw === "true") {
      return new NextResponse(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          "Content-Type": result.contentType,
          "X-Template-Id": result.templateId,
          "X-Used-Font-Size": String(result.usedFontSize),
          "X-Used-Font": result.usedFont.id,
          "Cache-Control": "no-store",
        },
      });
    }

    const imageUrl = `data:${result.contentType};base64,${result.buffer.toString("base64")}`;
    return NextResponse.json({
      imageUrl,
      templateId: result.templateId,
      usedFontSize: result.usedFontSize,
      usedFont: result.usedFont,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    if (error instanceof CoverComposeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "failed to compose cover" }, { status: 500 });
  }
}
