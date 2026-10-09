import { readFileSync } from "node:fs";
import { ModelArkError } from "../lib/modelark/responses";
import { withModelArkJsonRetry } from "../lib/modelark/json-retry";
import {
  DIAGNOSTIC_STAGE_ORDER,
  createGenerationDiagnostics,
  redactDiagnosticSecrets,
  summarizeCaptionChange,
} from "../lib/generation/diagnostics";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
const saved: unknown[] = [];
const enabled = createGenerationDiagnostics({
  generationId: "gen-1",
  provider: "modelark",
  model: "dola-seed-2-1-turbo-260628",
  enabled: true,
  now: () => new Date("2026-10-09T06:00:00.000Z"),
  save: async (record) => {
    saved.push(record);
  },
});
enabled.setNote("芒果糯米饭粘度刚好");
enabled.recordRaw('{"caption":"点的几道里面，我比较喜欢芒果糯米饭，粘度刚好。"}', "json_ok");
enabled.snapshot(
  "parseGeneratedContent",
  { titles: [], caption: "" },
  { titles: ["芒果糯米饭"], caption: "点的几道里面，我比较喜欢芒果糯米饭，粘度刚好。" },
  "芒果糯米饭粘度刚好",
);
enabled.snapshot(
  "ensureCaptionEmojis",
  { titles: ["芒果糯米饭"], caption: "点的几道里面，我比较喜欢芒果糯米饭，粘度刚好。" },
  { titles: ["芒果糯米饭"], caption: "点的几道里面，我比较喜欢。🥭芒果糯米饭，粘度刚好。" },
  "芒果糯米饭粘度刚好",
);
await enabled.finish({
  titles: ["芒果糯米饭"],
  caption: "点的几道里面，我比较喜欢。🥭芒果糯米饭，粘度刚好。",
  hashtags: ["#泰国菜"],
  modelCalls: 1,
  complianceCalls: 0,
});

const stored = saved[0] as {
  generationId: string;
  provider: string;
  model: string;
  rawOutputs: Array<{ outputText: string; parseStatus: string }>;
  stages: Array<{ stage: string; changed: boolean; changedFields: string[]; before: { caption: string }; after: { caption: string } }>;
  finalResponse: { caption: string };
  parseStatus: string;
  expiresAt: Date;
  createdAt: Date;
};
assert(saved.length === 1, "enabled diagnostics did not save");
assert(stored.generationId === "gen-1", stored.generationId);
assert(stored.provider === "modelark" && stored.model.includes("dola-seed"), "provider metadata missing");
assert(stored.rawOutputs[0]?.outputText.includes("caption"), "raw output_text was dropped");
assert(!stored.rawOutputs[0]?.outputText.includes("sk-"), "a key was stored");
assert(stored.stages[1]?.changed && stored.stages[1]?.changedFields.includes("caption"), "caption change was not marked");
assert(stored.stages[1]?.before.caption.includes("粘度刚好") && !stored.stages[1]?.before.caption.includes("🥭"), "parsed caption was treated as raw text");
assert(stored.finalResponse.caption !== stored.rawOutputs[0]?.outputText, "final caption replaced the raw output");
assert(stored.expiresAt.getTime() - stored.createdAt.getTime() === 7 * 24 * 60 * 60 * 1000, "retention is not 7 days");
const emojiDiff = summarizeCaptionChange(stored.stages[1].before.caption, stored.stages[1].after.caption, "芒果糯米饭粘度刚好");
assert(emojiDiff.emojiChanged, "emoji change was missed");
assert(emojiDiff.sentencesAdded.length > 0 || emojiDiff.sentencesRemoved.length > 0, "sentence split was missed");
assert(!emojiDiff.userDetailLost, `a kept detail was marked lost: ${emojiDiff.userDetailLost}`);

const lost = summarizeCaptionChange("芒果糯米饭粘度刚好。", "芒果糯米饭很好吃。", "芒果糯米饭粘度刚好");
assert(lost.userDetailLost, "a dropped user detail was missed");
const moved = summarizeCaptionChange("先吃菠萝炒饭。再喝冬阴功。", "再喝冬阴功。先吃菠萝炒饭。");
assert(moved.orderChanged && moved.sentencesAdded.length === 0, "order change was missed");
const punct = summarizeCaptionChange("粘度刚好。", "粘度刚好");
assert(punct.punctuationChanged, "punctuation change was missed");
const place = summarizeCaptionChange("朋友介绍来的。", "朋友介绍来的。\n\n📍 尚泰世界购物中心 3楼\n⏰ 10:00–22:00");
assert(place.locationChanged, "location change was missed");
const dish = summarizeCaptionChange("朋友介绍来的。", "朋友介绍来的。咖喱蟹肉咸香浓郁，店员服务很好。");
assert(dish.dishOrServiceAdded, "added dish or service text was missed");

const disabledSaves: unknown[] = [];
const disabled = createGenerationDiagnostics({
  generationId: "gen-off",
  provider: "openai",
  model: "gpt-4o",
  enabled: false,
  save: async (record) => {
    disabledSaves.push(record);
  },
});
disabled.recordRaw("secret caption", "received");
disabled.snapshot("parseGeneratedContent", { titles: [], caption: "" }, { titles: ["a"], caption: "b" });
await disabled.finish({ titles: ["a"], caption: "b", hashtags: [], modelCalls: 1, complianceCalls: 0 });
await disabled.fail("json_parse", "nope");
assert(disabledSaves.length === 0, "disabled diagnostics saved a record");
assert(disabled.inspect().rawOutputs.length === 0 && disabled.inspect().stages.length === 0, "disabled diagnostics kept user text");

const seen: string[] = [];
await withModelArkJsonRetry({
  first: { text: '{"titles":', usages: [] },
  requestRetry: async () => ({ text: '{"still":', usages: [] }),
  parseJson: () => {
    throw new ModelArkError(502, "ModelArk output was not valid JSON.", "json_parse", "missing colon");
  },
  observe: (outputText, parseStatus) => {
    seen.push(`${parseStatus}:${outputText}`);
  },
}).then(
  () => {
    throw new Error("illegal JSON was accepted");
  },
  () => undefined,
);
assert(seen.length === 2, `parse failure did not keep both raw texts: ${seen.join(" | ")}`);
assert(seen[0] === 'json_parse:{"titles":' && seen[1] === 'json_parse:{"still":', seen.join(" | "));

const route = readFileSync(new URL("../app/api/generate/route.ts", import.meta.url), "utf8");
const stages = [...route.matchAll(/snap\(\s*"([^"]+)"/g)].map((match) => match[1]);
assert(stages.join("\n") === DIAGNOSTIC_STAGE_ORDER.join("\n"), `stage order\n${stages.join("\n")}`);
assert(route.includes('trace.recordRaw(text, "json_ok")'), "ModelArk raw text is not recorded");
assert(route.includes('trace.recordRaw(text, "received")'), "OpenAI raw text is not recorded");
assert(route.includes("observe: (outputText, parseStatus) => trace.recordRaw(outputText, parseStatus)"), "JSON parse failure is not observed");
assert((route.match(/createModelArkResponse\(/g) ?? []).length === 2, "diagnostics added a model call");
assert(redactDiagnosticSecrets("Bearer sk-testsecret123 token").includes("[redacted]"), "secrets were not redacted");
assert(!redactDiagnosticSecrets("Bearer sk-testsecret123 token").includes("sk-testsecret123"), "raw key remained");

console.log("validate-generation-diagnostics: ok");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
