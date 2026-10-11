/**
 * Code-level check that /api/generate talks to ModelArk only. All network calls are stubbed;
 * no real ModelArk or OpenAI request is made.
 * Run: npx tsx scripts/validate-ai-provider.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveAiProvider } from "../lib/ai-provider";
import { sanitizeEventMetadata, RATING_FEEDBACK_MAX_LENGTH } from "../lib/analytics/types";

const MODELARK_HOST = "ark.ap-southeast.bytepluses.com";

function withProvider(value: string | undefined) {
  if (value === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = value;
  return resolveAiProvider();
}

assert.equal(withProvider(undefined), "modelark", "empty AI_PROVIDER must default to ModelArk");
assert.equal(withProvider(""), "modelark");
assert.equal(withProvider(" ModelArk "), "modelark");
assert.equal(withProvider("openai"), "openai", "OpenAI stays available only when set on purpose");
assert.throws(() => withProvider("gpt"), /Unknown AI_PROVIDER/);

const metadata = sanitizeEventMetadata({
  rating: "2",
  band: "rating_low",
  feedback: "x".repeat(RATING_FEEDBACK_MAX_LENGTH + 50),
  note: "y".repeat(300),
  ignored: 5,
});
assert.equal(metadata.feedback.length, RATING_FEEDBACK_MAX_LENGTH, "feedback keeps up to the feedback limit");
assert.equal(metadata.note.length, 180, "other metadata keeps the 180 limit");
assert.equal(metadata.rating, "2");
assert.equal("ignored" in metadata, false);
assert.deepEqual(sanitizeEventMetadata(["a"]), {});

type Call = { host: string; auth: string };
type Responder = (host: string, index: number) => { status: number; body: unknown };

function quotaResponder(status: number): Responder {
  return (host) => ({
    status,
    body:
      host === MODELARK_HOST
        ? { error: { code: "RateLimitExceeded", message: "quota" } }
        : { error: { message: "You have no credits remaining." } },
  });
}

function modelArkPost(titles: string[]) {
  const post = {
    titles,
    captionParagraphs: ["朋友推荐来吃 Baan Ying，椰子冰淇淋很好吃，冰冰凉凉的。", "下次还想再点一次椰子冰淇淋。"],
    hashtags: ["#曼谷美食", "#泰国旅行", "#曼谷探店", "#BaanYing", "#椰子冰淇淋"],
    mainTitle: "椰子冰淇淋很好吃",
    subTitle: "冰冰凉凉",
    selectedPhotoIndex: 0,
    selectedPhotoIndexes: [0],
    photoSelectionReason: "",
    remainingPhotoOrder: [],
    remainingOrderPattern: "1",
  };
  return {
    status: "completed",
    model: "dola-seed-2-1-turbo-260628",
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(post) }] }],
    usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
  };
}

async function runGenerate(env: Record<string, string | undefined>, status: number | Responder) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const respond = typeof status === "number" ? quotaResponder(status) : status;
  const calls: Call[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    calls.push({ host: url.host, auth: headers.get("authorization") ?? "" });
    const reply = respond(url.host, calls.length - 1);
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const { POST } = await import("../app/api/generate/route");
    const form = new FormData();
    form.set(
      "payload",
      JSON.stringify({
        campaignId: "baan-ying-centralworld",
        branchId: "baan-ying-centralworld",
        brandName: "Baan Ying",
        productCategory: "Thai restaurant",
        productDescription: "",
        productName: "Baan Ying",
        enjoyMost: ["food"],
        enjoyMostOther: "",
        recommendTo: [],
        recommendToOther: "",
        recommendedDishes: ["椰子冰淇淋"],
        recommendedDishOther: "",
        diningExperienceNote: "椰子冰淇淋很好吃",
      }),
    );
    const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: form }));
    const json = (await response.json()) as { error?: string };
    return { status: response.status, error: json.error ?? "", calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const baseEnv = {
  AI_PROVIDER: undefined,
  MODELARK_MODEL: undefined,
  MONGODB_URI: undefined,
  GENERATION_DIAGNOSTICS: undefined,
  OPENAI_API_KEY: "sk-test-openai-should-not-be-used",
};

async function main() {
    const quota = await runGenerate({ ...baseEnv, MODELARK_API_KEY: "test-modelark-key" }, 429);
    assert.ok(quota.calls.length > 0, "generate must call the model");
    assert.ok(
      quota.calls.every((call) => call.host === MODELARK_HOST),
      `generate must only call ModelArk, saw ${quota.calls.map((call) => call.host).join(", ")}`,
    );
    assert.ok(quota.calls.every((call) => call.auth === "Bearer test-modelark-key"), "ModelArk key comes from MODELARK_API_KEY");
    assert.equal(quota.status, 429);
    assert.match(quota.error, /^ModelArk rate limit or quota was reached\./, "ModelArk 429 is labelled as ModelArk");
    assert.doesNotMatch(quota.error, /openai|credits remaining|test-modelark-key/i);

    const missing = await runGenerate({ ...baseEnv, MODELARK_API_KEY: undefined }, 200);
    assert.equal(missing.calls.length, 0, "missing ModelArk key must not fall back to any other provider");
    assert.equal(missing.status, 500);
    assert.equal(missing.error, "ModelArk is not configured: MODELARK_API_KEY is missing on the server.");

    const openaiQuota = await runGenerate({ ...baseEnv, AI_PROVIDER: "openai", MODELARK_API_KEY: "test-modelark-key" }, 429);
    assert.ok(openaiQuota.calls.length > 0 && openaiQuota.calls.every((call) => call.host === "api.openai.com"));
    assert.match(openaiQuota.error, /^OpenAI error \(AI_PROVIDER=openai\): 429/, "OpenAI 429 is labelled as OpenAI");
    assert.doesNotMatch(openaiQuota.error, /sk-test-openai/);

    const success = await runGenerate({ ...baseEnv, MODELARK_API_KEY: "test-modelark-key" }, (host, index) => ({
      status: 200,
      body: modelArkPost(index === 0 ? ["椰子冰淇淋很好吃", "冰冰凉凉"] : ["椰子冰淇淋很好吃", "冰冰凉凉很解腻", "朋友推荐来吃"]),
    }));
    // Outside a Next request, cookies() throws when the route saves the finished post; every model step has run by then.
    assert.ok(
      success.status === 200 || /`cookies` was called outside a request scope/.test(success.error),
      `mocked ModelArk generation failed before saving: ${success.status} ${success.error}`,
    );
    assert.ok(success.calls.length >= 2, "a 2-title first answer must trigger the ModelArk title retry");
    assert.ok(
      success.calls.every((call) => call.host === MODELARK_HOST && call.auth === "Bearer test-modelark-key"),
      `every generate step must use ModelArk, saw ${success.calls.map((call) => call.host).join(", ")}`,
    );

    const route = readFileSync(new URL("../app/api/generate/route.ts", import.meta.url), "utf8");
    assert.equal(route.split("createModelArkResponse(").length - 1, 2, "createModelArkResponse call sites changed");
    assert.match(route, /const openai = provider === "openai" \? getClient\(\) : null;/, "OpenAI client exists only for AI_PROVIDER=openai");
    assert.match(route, /label: "compliance-rewrite"/, "compliance rewrite must go through ModelArk");
    assert.match(route, /complete: complianceComplete/, "compliance rewrite must receive the ModelArk completer");

    console.log("validate-ai-provider: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
