import { promises as fs } from "fs";
import path from "path";
import { create as createFontkitFont, type Font, type FontCollection } from "fontkit";
import { FONT_LABELS } from "./font-labels";
import {
  CoverComposeError,
  type FontId,
  type FontStatus,
  type UsedFont,
} from "./types";

const FONT_EXTENSIONS = [".ttf", ".otf", ".woff2", ".woff"] as const;

export type FontDefinition = {
  id: FontId;
  name: string;
  family: string;
  fileBase: string;
  preferredFile: string;
  source: string;
  download: string;
  license: string;
  commercialUse: string;
  projectAuthorized: boolean;
};

export const FONT_REGISTRY: FontDefinition[] = [
  {
    id: "jiangchengheiti",
    name: "江城黑体",
    family: "JiangChengHeiTi",
    fileBase: "jiangchengheiti",
    preferredFile: "jiangchengheiti.ttf",
    source: "江城黑体 / JiangChengHeiTi（用户提供）",
    download: "本地文件 jiangchengheiti.ttf",
    license: "以用户持有的授权文件为准",
    commercialUse: "仅在授权明确允许时可以商用",
    projectAuthorized: false,
  },
  {
    id: "jiangchengyuanti",
    name: "江城圆体",
    family: "JiangChengYuanTi",
    fileBase: "jiangchengyuanti",
    preferredFile: "jiangchengyuanti.ttf",
    source: "江城圆体 / JiangChengYuanTi（用户提供）",
    download: "本地文件 jiangchengyuanti.ttf",
    license: "以用户持有的授权文件为准",
    commercialUse: "仅在授权明确允许时可以商用",
    projectAuthorized: false,
  },
  {
    id: "jingnabobohei",
    name: "荆南波波黑",
    family: "JingNanBoBoHei",
    fileBase: "jingnabobohei",
    preferredFile: "jingnabobohei.ttf",
    source: "荆南波波黑 / JingNanBoBoHei（用户提供）",
    download: "本地文件 jingnabobohei.ttf",
    license: "以用户持有的授权文件为准",
    commercialUse: "仅在授权明确允许时可以商用",
    projectAuthorized: false,
  },
];

export type LoadedCoverFont = {
  id: FontId;
  name: string;
  family: string;
  fileName: string;
  satoriData: Buffer;
  metricsFont: Font;
};

const fontsDir = () => path.join(process.cwd(), "public", "fonts");

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveFontFile(
  definition: FontDefinition,
): Promise<{ filePath: string; fileName: string } | null> {
  const dir = fontsDir();
  const preferred = path.join(dir, definition.preferredFile);
  if (await fileExists(preferred)) {
    return { filePath: preferred, fileName: definition.preferredFile };
  }
  for (const ext of FONT_EXTENSIONS) {
    const fileName = `${definition.fileBase}${ext}`;
    const filePath = path.join(dir, fileName);
    if (await fileExists(filePath)) {
      return { filePath, fileName };
    }
  }
  return null;
}

function isMetricsFont(font: Font | FontCollection): font is Font {
  return "layout" in font && typeof font.layout === "function";
}

async function decompressWoff2(buffer: Buffer, fileName: string): Promise<Buffer> {
  try {
    const wawoff2 = await import("wawoff2");
    const decompress = wawoff2.decompress ?? wawoff2.default?.decompress;
    if (!decompress) {
      throw new Error("wawoff2 decompress unavailable");
    }
    const decompressed = await decompress(buffer);
    return Buffer.from(decompressed);
  } catch {
    throw new CoverComposeError(
      `Chinese font failed to load: ${fileName}`,
      500,
    );
  }
}

function createMetricsFont(buffer: Buffer, fileName: string): Font {
  try {
    const font = createFontkitFont(buffer);
    if (!isMetricsFont(font)) {
      throw new Error("font collection is not supported");
    }
    return font;
  } catch {
    throw new CoverComposeError(
      `Chinese font failed to load: ${fileName}`,
      500,
    );
  }
}

export async function loadCoverFont(
  definition: FontDefinition,
): Promise<LoadedCoverFont> {
  const resolved = await resolveFontFile(definition);
  if (!resolved) {
    throw new CoverComposeError(
      `Chinese font failed to load: ${definition.preferredFile}`,
      500,
    );
  }

  let fileBuffer: Buffer;
  try {
    fileBuffer = await fs.readFile(resolved.filePath);
  } catch {
    throw new CoverComposeError(
      `Chinese font failed to load: ${resolved.fileName}`,
      500,
    );
  }

  if (!fileBuffer.length) {
    throw new CoverComposeError(
      `Chinese font failed to load: ${resolved.fileName}`,
      500,
    );
  }

  let metricsFont: Font;
  try {
    metricsFont = createMetricsFont(fileBuffer, resolved.fileName);
  } catch {
    if (!resolved.fileName.toLowerCase().endsWith(".woff2")) {
      throw new CoverComposeError(
        `Chinese font failed to load: ${resolved.fileName}`,
        500,
      );
    }
    const decompressed = await decompressWoff2(fileBuffer, resolved.fileName);
    metricsFont = createMetricsFont(decompressed, resolved.fileName);
  }

  return {
    id: definition.id,
    name: definition.name,
    family: definition.family,
    fileName: resolved.fileName,
    satoriData: fileBuffer,
    metricsFont,
  };
}

export async function loadRequiredFonts(
  fontIds?: FontId[],
): Promise<Map<FontId, LoadedCoverFont>> {
  const needed = FONT_REGISTRY.filter(
    (font) => !fontIds || fontIds.includes(font.id),
  );
  const loaded = new Map<FontId, LoadedCoverFont>();

  for (const definition of needed) {
    const font = await loadCoverFont(definition);
    loaded.set(definition.id, font);
  }

  return loaded;
}

export async function getFontStatus(): Promise<FontStatus[]> {
  const statuses: FontStatus[] = [];

  for (const definition of FONT_REGISTRY) {
    try {
      const font = await loadCoverFont(definition);
      statuses.push({
        id: definition.id,
        name: definition.name,
        file: font.fileName,
        loaded: true,
      });
    } catch (error) {
      const resolved = await resolveFontFile(definition);
      statuses.push({
        id: definition.id,
        name: definition.name,
        file: resolved?.fileName ?? definition.preferredFile,
        loaded: false,
        error:
          error instanceof CoverComposeError
            ? error.message
            : `Chinese font failed to load: ${definition.preferredFile}`,
      });
    }
  }

  return statuses;
}

export function getFontFamily(id: FontId): string {
  const definition = FONT_REGISTRY.find((font) => font.id === id);
  if (!definition) {
    throw new CoverComposeError(`Unknown font id: ${id}`, 400);
  }
  return definition.family;
}

export function toUsedFont(font: LoadedCoverFont): UsedFont {
  return {
    id: font.id,
    name: font.name,
    file: font.fileName,
  };
}

export function toSatoriFonts(fonts: Map<FontId, LoadedCoverFont>) {
  return [...fonts.values()].flatMap((font) => {
    const entry = {
      name: font.family,
      data: font.satoriData,
      style: "normal" as const,
    };
    return [
      { ...entry, weight: 400 as const },
      { ...entry, weight: 700 as const },
    ];
  });
}

export function fontLabel(id: FontId) {
  return FONT_LABELS.find((font) => font.id === id);
}
