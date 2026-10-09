import { readFileSync } from "node:fs";
import { GENERATION_DIAGNOSTICS_COLLECTION } from "../lib/generation/diagnostics";
import { getDb } from "../lib/mongodb";

function loadLocalEnv() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq);
      if (process.env[key]) continue;
      let value = trimmed.slice(eq + 1);
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // The process environment already has the variables.
  }
}

loadLocalEnv();

async function main() {
  const generationId = process.argv[2]?.trim() ?? "";
  if (!generationId) {
    console.error("Usage: npm run diagnostics:generation -- <generationId>");
    process.exit(1);
  }
  const db = await getDb();
  const record = await db.collection(GENERATION_DIAGNOSTICS_COLLECTION).findOne(
    { generationId },
    { projection: { _id: 0 } },
  );
  if (!record) {
    console.error(`No diagnostic record for ${generationId}. Set GENERATION_DIAGNOSTICS=1 before the request.`);
    process.exit(1);
  }
  console.log(JSON.stringify(record, null, 2));
  process.exit(0);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Could not read diagnostics";
  console.error(message.replace(/mongodb(\+srv)?:\/\/\S+/gi, "[redacted]"));
  process.exit(1);
});
