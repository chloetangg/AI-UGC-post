import { MODELARK_JSON_RETRY_HINT } from "../lib/modelark/post-schema";
import { withModelArkJsonRetry } from "../lib/modelark/json-retry";
import {
  interpretModelArkPayload,
  ModelArkError,
  parseModelArkJsonText,
} from "../lib/modelark/responses";
import type { OpenAICallUsage } from "../lib/openai-usage";

const PRIVATE = "用户隐私正文不应出现在日志";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function throws(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
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

const legal = parseModelArkJsonText('{"titles":["一","二","三"]}') as { titles: string[] };
assert(legal.titles.length === 3, "1 legal json");

const missingColon = `{"titles" ["${PRIVATE}"]}`;
const colonError = throws(() => parseModelArkJsonText(missingColon));
assert(colonError instanceof ModelArkError && colonError.stage === "json_parse", "2 stage");
assert(
  colonError instanceof ModelArkError && /Expected ':' after property name/.test(colonError.message),
  colonError instanceof Error ? colonError.message : "2 message",
);
assert(
  colonError instanceof ModelArkError &&
    !colonError.interpretation?.reason.includes(PRIVATE) &&
    /at=U\+[0-9A-F]{4}/.test(colonError.interpretation?.reason ?? ""),
  colonError instanceof ModelArkError ? colonError.interpretation?.reason ?? "2 skeleton" : "2 skeleton",
);

const escaped = parseModelArkJsonText('{"captionParagraphs":["第一段\\n第二段"]}') as {
  captionParagraphs: string[];
};
assert(escaped.captionParagraphs[0] === "第一段\n第二段", "3 escaped newline stays inside the string");

const rawNewline = throws(() => parseModelArkJsonText('{"captionParagraphs":["第一段\n第二段"]}'));
assert(rawNewline instanceof ModelArkError && rawNewline.stage === "json_parse", "4 raw newline");

const truncated = throws(() => parseModelArkJsonText('{"titles":["截断"'));
assert(truncated instanceof ModelArkError && truncated.stage === "json_parse", "5 truncated json is not repaired");
const incomplete = throws(() =>
  interpretModelArkPayload(
    {
      status: "incomplete",
      incomplete_details: { reason: "length" },
      output: [{ type: "message", content: [{ type: "output_text", text: '{"titles":["截断"' }] }],
    },
    "mock",
    "generate",
  ),
);
assert(incomplete instanceof ModelArkError && incomplete.stage === "incomplete", "5 incomplete response is not parsed as success");

const noOutputText = throws(() =>
  interpretModelArkPayload(
    {
      status: "completed",
      output_text: '{"titles":["不要读这里"]}',
      output: [{ type: "message", content: [{ type: "text", text: '{"titles":["也不要读这里"]}' }] }],
    },
    "mock",
    "generate",
  ),
);
assert(noOutputText instanceof ModelArkError && noOutputText.stage === "missing_output", "6 missing output_text");

async function run(texts: string[]) {
  const logs: string[] = [];
  const hints: Array<string | undefined> = [];
  let cursor = 0;
  const take = async (hint?: string) => {
    hints.push(hint);
    const text = texts[cursor];
    cursor += 1;
    if (text === undefined) throw new Error(`unexpected request ${cursor}`);
    return { text, usages: [usage] };
  };
  const first = await take();
  const checked = await withModelArkJsonRetry({
    first,
    requestRetry: () => take(MODELARK_JSON_RETRY_HINT),
    parseJson: parseModelArkJsonText,
    log: (line) => logs.push(line),
  });
  return { checked, hints, logs, requests: cursor };
}

async function fails(texts: string[]) {
  const logs: string[] = [];
  const hints: Array<string | undefined> = [];
  let cursor = 0;
  const take = async (hint?: string) => {
    hints.push(hint);
    const text = texts[cursor];
    cursor += 1;
    if (text === undefined) throw new Error(`unexpected request ${cursor}`);
    return { text, usages: [usage] };
  };
  try {
    const first = await take();
    await withModelArkJsonRetry({
      first,
      requestRetry: () => take(MODELARK_JSON_RETRY_HINT),
      parseJson: parseModelArkJsonText,
      log: (line) => logs.push(line),
    });
    throw new Error("expected failure");
  } catch (error) {
    return { error, hints, logs, requests: cursor };
  }
}

function logsAreSafe(logs: string[]) {
  const joined = logs.join("\n");
  assert(!joined.includes(PRIVATE), `log included the caption: ${joined}`);
  assert(!/sk-|api[_-]?key|bearer /i.test(joined), `log included a credential: ${joined}`);
}

async function main() {
  const recovered = await run([missingColon, '{"titles":["一","二","三"]}']);
  assert(recovered.requests === 2, `7 requests ${recovered.requests}`);
  assert(recovered.hints[1] === MODELARK_JSON_RETRY_HINT, "7 retry asks for valid JSON");
  assert(recovered.checked.recovered === "json_parse", recovered.checked.recovered);
  assert((recovered.checked.text.match(/titles/g) ?? []).length === 1, "7 uses the second body");
  assert(recovered.logs.some((line) => line.includes("stage=json_parse retry=1")), recovered.logs.join(" | "));
  assert(recovered.logs.some((line) => line.includes("json=ok") && line.includes("recovered=json_parse")), recovered.logs.join(" | "));
  logsAreSafe(recovered.logs);

  const bothBad = await fails([missingColon, '{"titles" ["还是缺冒号"]}']);
  assert(bothBad.requests === 2, `8 requests ${bothBad.requests}`);
  assert(bothBad.hints.filter((hint) => hint === MODELARK_JSON_RETRY_HINT).length === 1, "8 one retry");
  assert(bothBad.error instanceof ModelArkError && bothBad.error.stage === "json_parse", "8 still json_parse");
  assert(bothBad.logs.some((line) => line.includes("final=json_parse")), bothBad.logs.join(" | "));
  assert(!bothBad.logs.some((line) => line.includes("json=ok")), bothBad.logs.join(" | "));
  logsAreSafe(bothBad.logs);

  const direct = await run(['{"titles":["一","二","三"]}']);
  assert(direct.requests === 1, `legal requests ${direct.requests}`);
  assert(direct.hints.length === 1 && direct.hints[0] === undefined, "legal does not send the retry hint");

  console.log("validate-modelark-json: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
