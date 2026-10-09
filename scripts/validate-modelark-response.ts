import { parseGeneratedContent, titleSlotCounts } from "../lib/parse-generated";
import { MODELARK_OUTPUT_APPENDIX, modelArkPostSchema } from "../lib/modelark/post-schema";
import {
  classifyTransportError,
  echoedFormatType,
  interpretModelArkPayload,
  jsonStructureSkeleton,
  modelArkOutputText,
  modelArkTextFormat,
  parseModelArkJsonText,
  shouldRaiseOutputCap,
  ModelArkError,
} from "../lib/modelark/responses";

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

const completed = {
  status: "completed",
  model: "dola-seed-2-1-turbo-260628",
  output: [
    { type: "reasoning", summary: [{ type: "summary_text", text: "ignore this" }] },
    {
      type: "message",
      status: "completed",
      content: [{ type: "output_text", text: '{"titles":["一","二","三"],"caption":"一句"}' }],
    },
  ],
  usage: {
    input_tokens: 20,
    output_tokens: 8,
    total_tokens: 28,
    output_tokens_details: { reasoning_tokens: 0 },
  },
};

const read = interpretModelArkPayload(completed, "fallback", "generate");
assert(read.status === "completed", "completed status");
assert(read.text.startsWith("{"), "completed text is the message");
assert(!read.text.includes("ignore this"), "reasoning text is not extracted");
assert(read.usage?.inputTokens === 20 && read.usage.outputTokens === 8, "usage tokens");
assert(modelArkOutputText(completed) === read.text, "output helper matches");

const split = interpretModelArkPayload(
  {
    status: "completed",
    output: [
      {
        type: "message",
        content: [
          { type: "output_text", text: '{"ok":' },
          { type: "output_text", text: "true}" },
        ],
      },
    ],
  },
  "fallback",
  "generate",
);
assert(split.text === '{"ok":true}', "message text fragments stay in order");

const truncated = {
  status: "incomplete",
  incomplete_details: { reason: "max_output_tokens" },
  output: [
    {
      type: "message",
      content: [{ type: "output_text", text: '{"titles":["只写了一半"' }],
    },
  ],
  usage: { input_tokens: 10, output_tokens: 4, total_tokens: 14 },
};
const truncatedError = throws(() => interpretModelArkPayload(truncated, "fallback", "generate"));
assert(truncatedError instanceof ModelArkError && truncatedError.stage === "incomplete", "truncated stage");
assert(truncatedError instanceof ModelArkError && truncatedError.reason === "max_output_tokens", "truncated reason");
assert(modelArkOutputText(truncated).includes("只写了一半"), "partial text stays available for logs only");

const failed = throws(() =>
  interpretModelArkPayload(
    { status: "failed", error: { code: "server_error", message: "upstream failed" }, output: [] },
    "fallback",
    "generate",
  ),
);
assert(failed instanceof ModelArkError && failed.stage === "failed", "failed stage");

const missing = throws(() =>
  interpretModelArkPayload({ status: "completed", output: [{ type: "message", content: [] }] }, "fallback", "generate"),
);
assert(missing instanceof ModelArkError && missing.stage === "missing_output", "missing output stage");

const noStatus = throws(() =>
  interpretModelArkPayload({ output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] }, "fallback", "generate"),
);
assert(noStatus instanceof ModelArkError && noStatus.stage === "incomplete", "missing status is not success");

const parsed = parseModelArkJsonText('{"titles":["一","二","三"]}') as { titles: string[] };
assert(parsed.titles.length === 3, "valid json");

const illegal = '{"titles":["一" "二"]}';
const jsonError = throws(() => parseModelArkJsonText(illegal));
assert(jsonError instanceof ModelArkError && jsonError.stage === "json_parse", "illegal json stage");
assert(jsonError instanceof ModelArkError && !jsonError.interpretation?.reason.includes("一"), "skeleton hides text");
assert(jsonStructureSkeleton(illegal, 12).includes("{"), "skeleton keeps structure");

const lengthStop = throws(() =>
  interpretModelArkPayload(
    {
      status: "incomplete",
      incomplete_details: { reason: "length" },
      output: [{ type: "message", content: [{ type: "output_text", text: '{"titles":["截断"' }] }],
    },
    "fallback",
    "generate",
  ),
);
assert(lengthStop instanceof ModelArkError && lengthStop.reason === "length", "length is incomplete");
assert(shouldRaiseOutputCap("length") && shouldRaiseOutputCap("max_output_tokens"), "length can raise the cap once");
assert(!shouldRaiseOutputCap("content_filter"), "other incomplete reasons do not raise the cap");

const format = modelArkTextFormat(modelArkPostSchema);
assert(format.type === "json_schema" && format.strict === true && format.name === "xiaohongshu_ugc_post", "modelark format");
const required = modelArkPostSchema.schema.required as string[];
assert(required.includes("captionParagraphs") && required.includes("titles"), "paragraph schema");
assert(!required.includes("evidenceSource") && !required.includes("caption"), "internal fields stay local");
assert(!MODELARK_OUTPUT_APPENDIX.includes("绝绝子"), "appendix is format only");
assert(
  echoedFormatType({ text: { format: { type: "json_schema" } } }) === "json_schema",
  "echoed format",
);

const joined = parseGeneratedContent(
  JSON.stringify({
    titles: ["标题一", "标题二", "标题三"],
    captionParagraphs: ["第一段没有换行", "第二段也没有"],
    hashtags: ["#BaanYing曼谷", "#泰国菜", "#曼谷必吃", "#Centralworld", "#曼谷泰餐推荐"],
    mainTitle: "封面",
    subTitle: "另一句",
  }),
  1,
);
assert(joined.caption === "第一段没有换行\n\n第二段也没有", "paragraphs join into caption");
assert(joined.titles.length === 3, "joined post keeps 3 titles");

const stillIllegal = throws(() => parseModelArkJsonText('{"captionParagraphs":["第一段\n第二段"]}'));
assert(stillIllegal instanceof ModelArkError && stillIllegal.stage === "json_parse", "raw newline is still rejected");

const timeout = classifyTransportError(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }));
assert(timeout.stage === "read_timeout", "timeout stage");
const connect = classifyTransportError(new TypeError("fetch failed"));
assert(connect.stage === "connect", "connect stage");

const business = throws(() => parseGeneratedContent('{"titles":["只有一个"],"caption":""}', 1));
assert(business instanceof Error && business.message.includes("titles=1") && business.message.includes("caption=empty"), business instanceof Error ? business.message : "business");

const twoTitles = throws(() =>
  parseGeneratedContent(JSON.stringify({ titles: ["标题一", "标题二"], caption: "正文还在" }), 1),
);
assert(
  twoTitles instanceof Error &&
    twoTitles.message.includes("titles=2") &&
    twoTitles.message.includes("caption=present") &&
    twoTitles.message.includes("raw=2") &&
    twoTitles.message.includes("blank=0") &&
    twoTitles.message.includes("stage=empty-title-filter"),
  twoTitles instanceof Error ? twoTitles.message : "two titles",
);

const blankThird = throws(() =>
  parseGeneratedContent(JSON.stringify({ titles: ["标题一", "标题二", "  "], caption: "正文还在" }), 1),
);
assert(
  blankThird instanceof Error &&
    blankThird.message.includes("titles=2") &&
    blankThird.message.includes("raw=3") &&
    blankThird.message.includes("blank=1"),
  blankThird instanceof Error ? blankThird.message : "blank third",
);
assert(titleSlotCounts(["标题一", "标题二", "  "]).kept === 2, "blank slot is dropped before later title formatting");

const duplicates = parseGeneratedContent(
  JSON.stringify({
    titles: ["同一句", "同一句", "另一句"],
    captionParagraphs: ["一段正文"],
    hashtags: ["#BaanYing曼谷", "#泰国菜", "#曼谷必吃", "#Centralworld", "#曼谷泰餐推荐"],
    mainTitle: "封面",
    subTitle: "另一句",
  }),
  1,
);
assert(duplicates.titles[0] === duplicates.titles[1] && duplicates.titles.length === 3, "duplicate titles are not removed at parse");

const titleSchema = modelArkPostSchema.schema.properties.titles as {
  minItems: number;
  maxItems: number;
  items: { minLength: number };
};
assert(titleSchema.minItems === 3 && titleSchema.maxItems === 3 && titleSchema.items.minLength === 1, "title schema requires 3 non-empty strings");

console.log("validate-modelark-response: ok");
