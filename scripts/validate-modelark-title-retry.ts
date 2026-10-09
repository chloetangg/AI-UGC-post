import { ensureTitleFormats } from "../lib/title-formats";
import { parseGeneratedContent } from "../lib/parse-generated";
import { modelArkPostSchema, MODELARK_TITLE_RETRY_HINT } from "../lib/modelark/post-schema";
import { ModelArkError, parseModelArkJsonText } from "../lib/modelark/responses";
import { isModelArkTitleCountFailure, withModelArkTitleCheck } from "../lib/modelark/title-check";
import type { OpenAICallUsage } from "../lib/openai-usage";

const PRIVATE_CAPTION = "用户隐私正文不应出现在日志";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function post(titles: string[], caption: string = PRIVATE_CAPTION) {
  return JSON.stringify({
    titles,
    captionParagraphs: [caption],
    hashtags: ["#BaanYing曼谷", "#泰国菜", "#曼谷必吃", "#Centralworld", "#曼谷泰餐推荐"],
    mainTitle: "封面",
    subTitle: "副标题",
    selectedPhotoIndex: 0,
    selectedPhotoIndexes: [0],
    photoSelectionReason: "",
    remainingPhotoOrder: [],
    remainingOrderPattern: "1",
  });
}

const usage = {
  label: "generate",
  model: "mock",
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
  cachedInputTokens: 0,
  imageInputTokens: 0,
  usageMissing: false,
} satisfies OpenAICallUsage;

async function run(responses: Array<string | "TIMEOUT">) {
  const logs: string[] = [];
  const hints: Array<string | undefined> = [];
  let cursor = 0;
  const take = async (hint?: string) => {
    hints.push(hint);
    const next = responses[cursor];
    cursor += 1;
    if (next === undefined) throw new Error(`unexpected request ${cursor}`);
    if (next === "TIMEOUT") {
      throw new ModelArkError(502, "The operation was aborted due to timeout", "read_timeout", "timeout");
    }
    return { text: next, usages: [usage] };
  };
  const first = await take();
  const checked = await withModelArkTitleCheck({
    text: first.text,
    requestRetry: () => take(MODELARK_TITLE_RETRY_HINT),
    parseJson: (text) => {
      parseModelArkJsonText(text);
    },
    parsePost: (text) => parseGeneratedContent(text, 1),
    log: (line) => logs.push(line),
  });
  return { checked, hints, logs, requests: cursor };
}

async function fails(responses: Array<string | "TIMEOUT">) {
  const logs: string[] = [];
  const hints: Array<string | undefined> = [];
  let cursor = 0;
  const take = async (hint?: string) => {
    hints.push(hint);
    const next = responses[cursor];
    cursor += 1;
    if (next === undefined) throw new Error(`unexpected request ${cursor}`);
    if (next === "TIMEOUT") {
      throw new ModelArkError(502, "The operation was aborted due to timeout", "read_timeout", "timeout");
    }
    return { text: next, usages: [usage] };
  };
  try {
    const first = await take();
    await withModelArkTitleCheck({
      text: first.text,
      requestRetry: () => take(MODELARK_TITLE_RETRY_HINT),
      parseJson: (text) => {
        parseModelArkJsonText(text);
      },
      parsePost: (text) => parseGeneratedContent(text, 1),
      log: (line) => logs.push(line),
    });
    throw new Error("expected failure");
  } catch (error) {
    return { error, hints, logs, requests: cursor };
  }
}

function logsAreSafe(logs: string[]) {
  const joined = logs.join("\n");
  assert(!joined.includes(PRIVATE_CAPTION), `log included the caption: ${joined}`);
  assert(!/sk-|api[_-]?key|bearer /i.test(joined), `log included a credential: ${joined}`);
  assert(!joined.includes("final=ok") || !joined.includes("final=missing_fields"), joined);
}

const titleSchema = modelArkPostSchema.schema.properties.titles as {
  minItems: number;
  maxItems: number;
  items: { minLength: number };
};
assert(titleSchema.minItems === 3 && titleSchema.maxItems === 3 && titleSchema.items.minLength === 1, "schema");

async function main() {
const three = ["标题一", "标题二", "标题三"];

const recovered = await run([post(["标题一", "标题二"]), post(three)]);
assert(recovered.requests === 2, `A requests ${recovered.requests}`);
assert(recovered.hints[1] === MODELARK_TITLE_RETRY_HINT, "A retry hint");
assert(recovered.checked.parsed.titles.length === 3, "A titles");
assert(recovered.checked.recovered === "missing_fields", recovered.checked.recovered);
assert(recovered.logs.some((line) => line.includes("stage=missing_fields retry=1") && line.includes("titles=2") && line.includes("raw=2") && line.includes("blank=0")), recovered.logs.join(" | "));
assert(recovered.logs.some((line) => line.includes("final=ok") && line.includes("recovered=missing_fields")), recovered.logs.join(" | "));
assert(recovered.logs.some((line) => line.includes("raw=3") && line.includes("blank=0") && line.includes("kept=3")), recovered.logs.join(" | "));
logsAreSafe(recovered.logs);

const stillShort = await fails([post(["标题一", "标题二"]), post(["标题一", "标题二"])]);
assert(stillShort.requests === 2, `B requests ${stillShort.requests}`);
assert(stillShort.hints.filter((hint) => hint === MODELARK_TITLE_RETRY_HINT).length === 1, "B one title retry");
assert(stillShort.error instanceof Error && stillShort.error.message.includes("titles=2") && stillShort.error.message.includes("stage=empty-title-filter"), stillShort.error instanceof Error ? stillShort.error.message : "B");
assert(stillShort.logs.some((line) => line.includes("final=missing_fields")), stillShort.logs.join(" | "));
assert(!stillShort.logs.some((line) => line.includes("final=ok")), stillShort.logs.join(" | "));
logsAreSafe(stillShort.logs);

const blankThenOk = await run([post(["标题一", "标题二", "   "]), post(three)]);
assert(blankThenOk.requests === 2, `C requests ${blankThenOk.requests}`);
assert(blankThenOk.hints.filter((hint) => hint === MODELARK_TITLE_RETRY_HINT).length === 1, "C one retry");
assert(blankThenOk.logs.some((line) => line.includes("titles=2") && line.includes("raw=3") && line.includes("blank=1")), blankThenOk.logs.join(" | "));
assert(blankThenOk.checked.parsed.titles.length === 3, "C titles");
logsAreSafe(blankThenOk.logs);

const direct = await run([post(three)]);
assert(direct.requests === 1, `D requests ${direct.requests}`);
assert(direct.hints.length === 1 && direct.hints[0] === undefined, "D no retry hint");
assert(direct.checked.parsed.titles.join("|") === three.join("|"), "D titles");
assert(direct.logs.some((line) => line.includes("final=ok") && line.includes("recovered=")), direct.logs.join(" | "));
assert(!direct.logs.some((line) => line.includes("missing_fields")), direct.logs.join(" | "));
logsAreSafe(direct.logs);

const duplicates = await run([post(["同一句", "同一句", "另一句"])]);
assert(duplicates.requests === 1, `E requests ${duplicates.requests}`);
assert(duplicates.checked.parsed.titles.length === 3 && duplicates.checked.parsed.titles[0] === duplicates.checked.parsed.titles[1], "E parse keeps duplicates");
const formatted = ensureTitleFormats(duplicates.checked.parsed.titles, []);
assert(formatted.length === 3 && formatted.every((title) => title.trim().length > 0), `E later formatting dropped a title: ${formatted.join("|")}`);
logsAreSafe(duplicates.logs);

const missingCaption = await fails([post(three, "")]);
assert(missingCaption.requests === 1, `F caption requests ${missingCaption.requests}`);
assert(!missingCaption.hints.some((hint) => hint === MODELARK_TITLE_RETRY_HINT), "F caption used the title retry");
assert(missingCaption.error instanceof Error && missingCaption.error.message.includes("caption=empty"), missingCaption.error instanceof Error ? missingCaption.error.message : "F caption");
assert(!isModelArkTitleCountFailure(missingCaption.error), "F caption is not a title retry");
assert(!missingCaption.logs.some((line) => line.includes("final=ok")), missingCaption.logs.join(" | "));

const badJson = await fails(['{"titles":["一" "二"]}']);
assert(badJson.requests === 1, `F json requests ${badJson.requests}`);
assert(!badJson.hints.some((hint) => hint === MODELARK_TITLE_RETRY_HINT), "F json used the title retry");
assert(!isModelArkTitleCountFailure(badJson.error), "F json is not a title retry");
assert(!badJson.logs.some((line) => line.includes("final=ok")), badJson.logs.join(" | "));

const timeout = await fails(["TIMEOUT"]);
assert(timeout.requests === 1, `F timeout requests ${timeout.requests}`);
assert(timeout.error instanceof ModelArkError && timeout.error.stage === "read_timeout", "F timeout stage");
assert(!isModelArkTitleCountFailure(timeout.error), "F timeout is not a title retry");
assert(!timeout.hints.some((hint) => hint === MODELARK_TITLE_RETRY_HINT), "F timeout used the title retry");

const jsonOnRetry = await fails([post(["标题一", "标题二"]), '{"titles":["一" "二"]}']);
assert(jsonOnRetry.requests === 2, `F retry json requests ${jsonOnRetry.requests}`);
assert(jsonOnRetry.error instanceof ModelArkError && jsonOnRetry.error.stage === "json_parse", "F retry json stage");
assert(jsonOnRetry.logs.some((line) => line.includes("final=json_parse")), jsonOnRetry.logs.join(" | "));
assert(!jsonOnRetry.logs.some((line) => line.includes("final=ok")), jsonOnRetry.logs.join(" | "));
logsAreSafe(jsonOnRetry.logs);

console.log("validate-modelark-title-retry: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
