import { promises as fs } from "fs";
import path from "path";

function publicUrl(relativeFromPublic: string) {
  const rel = relativeFromPublic.replace(/^\/+/, "");
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "";
  return origin ? `${origin}/${rel}` : "";
}

export function publicFileCandidates(relativeFromPublic: string) {
  const rel = relativeFromPublic.replace(/^\/+/, "");
  return [
    path.join(process.cwd(), "public", rel),
    path.join(process.cwd(), rel),
    path.join(process.cwd(), ".next", "standalone", "public", rel),
  ];
}

export async function readPublicFile(relativeFromPublic: string): Promise<Buffer> {
  for (const filePath of publicFileCandidates(relativeFromPublic)) {
    try {
      const buffer = await fs.readFile(filePath);
      if (buffer.length) return buffer;
    } catch {
      /* try the next location */
    }
  }

  const url = publicUrl(relativeFromPublic);
  if (url) {
    const response = await fetch(url);
    if (response.ok) {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length) return buffer;
    }
  }

  throw new Error(`Missing public file: ${relativeFromPublic}`);
}
