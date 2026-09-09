import { promises as fs } from "fs";
import path from "path";

const FONT_FILES = new Set([
  "jiangchengheiti.ttf",
  "jiangchengyuanti.ttf",
  "jingnabobohei.ttf",
]);

const COVER_FILES = new Set(["thai-flag.png"]);

function publicOrigin() {
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "";
}

function localPublicPath(relativeFromPublic: string) {
  const rel = relativeFromPublic.replace(/^\/+/, "");
  const [folder, fileName] = rel.split("/");
  if (folder === "fonts" && fileName && FONT_FILES.has(fileName)) {
    return path.join(process.cwd(), "public", "fonts", fileName);
  }
  if (folder === "cover" && fileName && COVER_FILES.has(fileName)) {
    return path.join(process.cwd(), "public", "cover", fileName);
  }
  return null;
}

export async function readPublicFile(relativeFromPublic: string): Promise<Buffer> {
  const filePath = localPublicPath(relativeFromPublic);
  if (filePath) {
    try {
      const buffer = await fs.readFile(filePath);
      if (buffer.length) return buffer;
    } catch {
      /* try the public URL on Vercel */
    }
  }

  const origin = publicOrigin();
  if (origin) {
    const response = await fetch(`${origin}/${relativeFromPublic.replace(/^\/+/, "")}`);
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length) return buffer;
    }
  }

  throw new Error(`Missing public file: ${relativeFromPublic}`);
}
