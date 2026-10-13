/**
 * Cost estimation for ModelArk and OpenAI generations, and what reaches MongoDB.
 * MongoDB is an in-memory fake; no network or database is touched.
 * Run: npx tsx scripts/validate-generation-cost.ts
 */
import assert from "node:assert/strict";
import { interpretModelArkPayload } from "../lib/modelark/responses";
import { aggregateGenerationCost, formatGenerationCostLog, type OpenAICallUsage } from "../lib/openai-usage";
import { knownPricingForModel, OPENAI_MODEL_PRICING } from "../lib/openai-pricing";

const MODEL = "dola-seed-2-1-turbo-260628";

function close(actual: number, expected: number, message: string) {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${message}: expected ${expected}, got ${actual}`);
}

function modelArkUsage(usage: Record<string, unknown> | undefined, label = "generate") {
  const payload = {
    status: "completed",
    model: MODEL,
    output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }],
    ...(usage ? { usage } : {}),
  };
  return interpretModelArkPayload(payload, MODEL, label).usage;
}

function call(model: string, input: number, output: number, extra: Partial<OpenAICallUsage> = {}): OpenAICallUsage {
  return {
    label: "test",
    model,
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    cachedInputTokens: 0,
    imageInputTokens: 0,
    usageMissing: false,
    ...extra,
  };
}

// Pricing lookup: the versioned id resolves to the dola-seed-2-1-turbo family; others stay unknown.
assert.deepEqual(knownPricingForModel(MODEL), { inputPerMillion: 0.5, outputPerMillion: 2.5, cachedInputPerMillion: 0.1 });
assert.deepEqual(knownPricingForModel("dola-seed-2-1-turbo"), knownPricingForModel(MODEL));
assert.equal(knownPricingForModel("dola-seed-2-1-pro-260628"), null, "a different ModelArk model must not borrow a price");
assert.equal(knownPricingForModel("dola-seed-2-1-turbo2"), null, "only a dash-separated version suffix matches the family");
assert.equal(knownPricingForModel("some-unknown-model"), null);

// 1. Production log 2026-10-13 12:09 (centralwOrld): 22602 input, 190 output, no cache field.
//    22602 × 0.5 / 1e6 = 0.011301; 190 × 2.5 / 1e6 = 0.000475; total 0.011776.
const plain = modelArkUsage({ input_tokens: 22602, output_tokens: 190, total_tokens: 22792 });
assert.ok(plain && !plain.usageMissing);
assert.equal(plain.cachedInputTokens, 0, "no cached_tokens reported means none are assumed");
const plainCost = aggregateGenerationCost([plain]);
assert.equal(plainCost.costKnown, true, "a priced ModelArk model must not be unknown");
assert.equal(plainCost.model, MODEL);
close(plainCost.inputCost, 0.011301, "ModelArk input cost");
close(plainCost.outputCost, 0.000475, "ModelArk output cost");
close(plainCost.totalCost, 0.011776, "ModelArk total cost");
assert.match(formatGenerationCostLog(plainCost), /Total Cost: \$0\.011776/);
assert.doesNotMatch(formatGenerationCostLog(plainCost), /unavailable|not estimated/);

// 2. Cache hits are billed at the cache-hit price, the rest at the input price.
//    (22602 − 10000) × 0.5 + 10000 × 0.1 + 190 × 2.5 = 6301 + 1000 + 475 = 7776 → 0.007776.
const cached = modelArkUsage({
  input_tokens: 22602,
  output_tokens: 190,
  total_tokens: 22792,
  input_tokens_details: { cached_tokens: 10000 },
});
assert.equal(cached?.cachedInputTokens, 10000);
const cachedCost = aggregateGenerationCost([cached!]);
close(cachedCost.inputCost, 0.007301, "cached + uncached input cost");
close(cachedCost.totalCost, 0.007776, "cached total cost");

// Cache count larger than input never produces negative billed input.
const overCached = aggregateGenerationCost([call(MODEL, 100, 0, { cachedInputTokens: 500 })]);
close(overCached.totalCost, (100 * 0.1) / 1e6, "cache hits are capped at input tokens");

// 3. Production log 2026-10-13 12:07: a length retry made two calls; both are billed.
//    45204 × 0.5 + 2224 × 2.5 = 22602 + 5560 = 28162 → 0.028162.
const twoCalls = aggregateGenerationCost([
  modelArkUsage({ input_tokens: 22602, output_tokens: 2048, total_tokens: 24650 })!,
  modelArkUsage({ input_tokens: 22602, output_tokens: 176, total_tokens: 22778 })!,
]);
assert.equal(twoCalls.calls, 2);
assert.equal(twoCalls.costKnown, true);
close(twoCalls.totalCost, 0.028162, "retry calls are summed");

// 4. Missing usage stays unknown instead of being priced as zero tokens.
assert.equal(modelArkUsage(undefined), null, "no usage object yields no usage row");
const partial = modelArkUsage({ input_tokens: 22602 });
assert.equal(partial?.usageMissing, true, "usage without output_tokens is incomplete");
const missingCost = aggregateGenerationCost([plain, partial!]);
assert.equal(missingCost.costKnown, false);
assert.equal(missingCost.usageMissingCalls, 1);
assert.match(formatGenerationCostLog(missingCost), /Total Cost: unavailable/);
assert.equal(aggregateGenerationCost([]).costKnown, false, "no calls means no known cost");

// 5. Unknown model stays unknown; it must not silently use gpt-4o prices.
const unknown = aggregateGenerationCost([call("some-unknown-model", 1_000_000, 1_000_000)]);
assert.equal(unknown.costKnown, false);
assert.equal(unknown.totalCost, 0);
assert.equal(aggregateGenerationCost([plain, call("some-unknown-model", 10, 10)]).costKnown, false, "one unpriced call makes the total unknown");

// 6. OpenAI prices and math are unchanged.
assert.deepEqual(OPENAI_MODEL_PRICING["gpt-4o"], { inputPerMillion: 2.5, outputPerMillion: 10, cachedInputPerMillion: 1.25 });
assert.deepEqual(OPENAI_MODEL_PRICING["gpt-4o-mini"], { inputPerMillion: 0.15, outputPerMillion: 0.6, cachedInputPerMillion: 0.075 });
//    Stored Siam record from 2026-10-07: gpt-4o-2024-08-06, 16591 in, 312 out, cost 0.0445975.
close(aggregateGenerationCost([call("gpt-4o-2024-08-06", 16591, 312)]).totalCost, 0.0445975, "gpt-4o record");
//    800k × 2.5 + 200k × 1.25 + 100k × 10 = 2.0 + 0.25 + 1.0 = 3.25.
close(
  aggregateGenerationCost([call("gpt-4o", 1_000_000, 100_000, { cachedInputTokens: 200_000 })]).totalCost,
  3.25,
  "gpt-4o cached input",
);

// 7. What insertGeneration writes, and what persistGeneration adds to analytics_daily.
type Write = { collection: string; op: string; args: unknown[] };
const writes: Write[] = [];
const fakeDb = {
  collection(name: string) {
    return {
      insertOne: async (...args: unknown[]) => (writes.push({ collection: name, op: "insertOne", args }), { acknowledged: true }),
      updateOne: async (...args: unknown[]) => (writes.push({ collection: name, op: "updateOne", args }), { matchedCount: 0 }),
    };
  },
};
(globalThis as { _mongoClient?: unknown })._mongoClient = { db: () => fakeDb };
process.env.DEPLOYMENT_ID = "baan-ying-centralworld";
delete process.env.NEXT_PUBLIC_DEPLOYMENT_ID;
delete process.env.MONGODB_DB_NAME;

async function settle() {
  for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
}

async function savedCost(cost: ReturnType<typeof aggregateGenerationCost>) {
  writes.length = 0;
  const { insertGeneration } = await import("../lib/generations");
  await insertGeneration({
    campaignId: "baan-ying-centralworld",
    titles: ["一", "二", "三"],
    caption: "一句",
    hashtags: ["#a", "#b", "#c", "#d", "#e"],
    coverTitle: "封面",
    coverSubtitle: "副标题",
    cost,
  });
  await settle();
  const inserted = writes.find((w) => w.collection === "generations" && w.op === "insertOne");
  const daily = writes.find((w) => w.collection === "analytics_daily" && w.op === "updateOne");
  assert.ok(inserted, "generation document was inserted");
  assert.ok(daily, "analytics_daily was updated");
  const aiUsage = (inserted.args[0] as { aiUsage: { model: string; cost: number | null; totalTokens: number } }).aiUsage;
  const inc = (daily.args[1] as { $inc: { cost: number; totalTokens: number } }).$inc;
  return { aiUsage, inc };
}

async function main() {
  const known = await savedCost(plainCost);
  assert.equal(known.aiUsage.model, MODEL);
  assert.equal(known.aiUsage.totalTokens, 22792);
  close(known.aiUsage.cost as number, 0.011776, "generations.aiUsage.cost");
  close(known.inc.cost, 0.011776, "analytics_daily $inc.cost");

  const notKnown = await savedCost(unknown);
  assert.equal(notKnown.aiUsage.cost, null, "unknown price is stored as null, not 0");
  assert.equal(notKnown.inc.cost, 0, "unknown price adds nothing to the daily cost");

  console.log("validate-generation-cost: ok");
  console.log(`example: ${MODEL}, 22602 input × $0.50/M + 190 output × $2.50/M = $${plainCost.totalCost.toFixed(6)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
