/**
 * Checks the assembled /api/generate prompts: ModelArk always carries the negative-feedback
 * neutralization rules once, whatever the customer wrote. OpenAI and the legacy
 * /api/generate-content prompts are pinned by hash. No model request, no database.
 * Each store runs in its own child process, because a process loads exactly one deployment.
 * Run: npx tsx scripts/validate-negative-feedback-prompt.ts
 * After an intentional prompt change, print new hashes with PRINT_PROMPT_HASHES=1.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const STORES = {
  "baan-ying-centralworld": {
    branch: "Baan Ying (centralwOrld, 3rd Floor)",
    golden: {
      "openai-system": "b96d8212937f54115cc133e3517159d7f885e22911e94879e267d66ad7aaf3d8",
      "openai-user-positive": "f940c15f4d531a5911fdfd4a9cde7e4c9bbe9cfd043d21eea9d8e1924f5ad95a",
      "openai-user-negative": "34f21bf43763b1c048257b546927cd37791c26475a6b75d432a0014faf32c45d",
      "legacy-system": "a2db48b6965581a29d45262c340b51fd976b7b96580d98d9ce3d70a0a86f0b65",
      "legacy-user": "b4a44c18287d6a597dd664e9859571c2ef04f3f27caf23775c9bb2994536bf15",
    },
  },
  "baan-ying-siam-center": {
    branch: "Baan Ying (Siam Center, 2nd Floor)",
    golden: {
      "openai-system": "9b7bb15ac36c752f0de666bebc8370e800524b2dfb0919ef04debedb8b42216b",
      "openai-user-positive": "648e7c2acb32bc16a5be4b4be9ffe7abcaf831bcaa4811516b2b6fee9083fed9",
      "openai-user-negative": "08ce61c3ee61cce5a6c9d603e84f21e06ad306bf895d4635d109ecd61d923533",
      "legacy-system": "2ddb65233ae285b1be440484b01300021200fc5861ffb4d3daab56887084a66f",
      "legacy-user": "18f51bd4299c2250ff98e8bd40bce7fe0fb4d8b199c76d59860d3f4c611f8e5a",
    },
  },
} as const;
type StoreId = keyof typeof STORES;

const NEGATIVE_HEADER = "CUSTOMER NEGATIVE FEEDBACK — MANDATORY.";
const NOTE_RULE = "Follow NEGATIVE FEEDBACK. Do not paste the note, and do not upgrade it.";
const RESULT_PREFIX = "NEGATIVE_PROMPT_RESULT ";

type Check = { name: string; ok: boolean; detail?: string };
type ChildResult = { deployment: string; checks: Check[]; hashes: Record<string, string> };
type Answers = { note: string; enjoyMost?: string[]; recommendTo?: string[]; recommendToOther?: string };

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const count = (text: string, part: string) => text.split(part).length - 1;

async function runChild(): Promise<ChildResult> {
  const deployment = process.env.DEPLOYMENT_ID as StoreId;
  const store = STORES[deployment];
  if (!store) throw new Error(`Unknown store ${deployment}`);
  const { getDeploymentConfig } = await import("../lib/deployment/config");
  const { buildSystemPrompt, buildUserPrompt } = await import("../lib/generate-prompt");
  const { buildGenerateContentSystemPrompt, buildGenerateContentUserPrompt } = await import("../lib/generate-content/prompt");
  const { formatNegativeNeutralizationRules, mayContainNegativeFeedback } = await import("../lib/compliance/negative-feedback");
  const { pickBrandSpelling } = await import("../lib/brand-spelling");
  const { resolveGenerationContext } = await import("../lib/generation/context");
  const { planLocationTime } = await import("../lib/locations");
  const { MODELARK_OUTPUT_APPENDIX } = await import("../lib/modelark/post-schema");
  const { BAAN_YING_BRAND_CONTEXT } = await import("../lib/brand/baan-ying-context");
  const { BAAN_YING_CONTENT_STRATEGY } = await import("../lib/brand/baan-ying-strategy");
  type Body = Parameters<typeof buildUserPrompt>[0];
  type Provider = Parameters<typeof buildUserPrompt>[2];

  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) =>
    checks.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });
  const negativeRules = formatNegativeNeutralizationRules();

  function payload(answers: Answers): Body {
    const body = {
      branch: store.branch,
      customerType: "Tourist",
      visitFrequency: "1st time",
      totalMealExpense: 900,
      mealExpenseRange: "฿800-1,000",
      enjoyMost: answers.enjoyMost ?? ["食物味道正宗美味"],
      enjoyMostOther: "",
      recommendedDishes: ["Mango Sticky Rice", "River Prawn Tom Yum"],
      recommendedDishOther: "",
      recommendTo: answers.recommendTo ?? ["Delicious", "Fresh"],
      recommendToOther: answers.recommendToOther ?? "",
      diningExperienceNote: answers.note,
      photoCount: 3,
      contentType: "restaurant-recommendation",
      productName: "Baan Ying Thai Food",
      variantIndex: 0,
      contentLanguage: "zh-CN",
      suggestedKspId: "KSP-02",
      suggestedStorylineId: "ST-02",
      suggestedContentAngle: "CA-02",
      suggestedSearchKeyword: "曼谷美食",
      brandName: "Baan Ying",
      productCategory: "Thai restaurant",
      productDescription: "Thai comfort food restaurant in Bangkok malls",
      brandContext: BAAN_YING_BRAND_CONTEXT,
      contentStrategy: BAAN_YING_CONTENT_STRATEGY,
      requiredLocationPlacement: "inline",
    } as unknown as Body;
    Math.random = seeded(1234);
    const plan = planLocationTime({ branch: body.branch, placement: body.requiredLocationPlacement });
    body.requiredLocationPlacement = plan.placement;
    body.requiredLocationFormat = plan.format;
    body.requiredInlineLocationStyle = plan.inlineStyle;
    body.requiredInlineLocationSlot = plan.inlineSlot;
    return body;
  }

  function systemFor(provider: Provider) {
    Math.random = seeded(42);
    return buildSystemPrompt(BAAN_YING_CONTENT_STRATEGY, BAAN_YING_BRAND_CONTEXT, store.branch, provider);
  }

  function userFor(answers: Answers, provider: Provider) {
    const body = payload(answers);
    const context = resolveGenerationContext({ branch: body.branch });
    Math.random = seeded(7);
    return buildUserPrompt(body, pickBrandSpelling(context.branch), provider);
  }

  function detectorSees(answers: Answers) {
    const body = payload(answers);
    return mayContainNegativeFeedback([
      body.diningExperienceNote ?? "",
      body.recommendedDishOther,
      body.enjoyMostOther ?? "",
      body.recommendToOther ?? "",
      ...body.enjoyMost,
      ...body.recommendTo,
    ]);
  }

  const loaded = getDeploymentConfig();
  check("process loaded this store's deployment", loaded.deploymentId === deployment, loaded.deploymentId);

  const legacyRequest: Parameters<typeof buildGenerateContentUserPrompt>[0] = {
    campaign: { brand: "Baan Ying", brandType: "Restaurant", campaign: "UGC", product: "Baan Ying Thai Food", category: "Thai restaurant", contentType: "restaurant-recommendation" },
    customer: { name: "", ageRange: "25-34", origins: "上海", gender: "Female" },
    experience: { branch: store.branch, customerType: "Tourist", visitFrequency: "1st time", enjoyedMost: ["食物味道正宗美味"], favoriteDish: "River Prawn Tom Yum", recommendTo: ["Delicious"] },
    photos: [{ name: "photo-1.jpg", description: "" }],
  };
  Math.random = seeded(1234);
  const legacyPlan = planLocationTime({ branch: store.branch, placement: "standalone" });
  const hashes: Record<string, string> = {
    "openai-system": sha(systemFor("openai")),
    "openai-user-positive": sha(userFor({ note: "菜很好吃服务也很好" }, "openai")),
    "openai-user-negative": sha(userFor({ note: "价格有点贵，冬阴功一般，服务很好" }, "openai")),
    "legacy-system": sha(buildGenerateContentSystemPrompt(store.branch)),
    "legacy-user": sha(buildGenerateContentUserPrompt(legacyRequest, legacyPlan)),
  };
  for (const [key, hash] of Object.entries(hashes)) {
    const golden = store.golden[key as keyof typeof store.golden];
    check(`${key} unchanged`, hash === golden, { hash, golden, hint: "run with PRINT_PROMPT_HASHES=1 only if the change is intended" });
  }

  const system = systemFor("modelark");
  check("ModelArk system carries the negative rules once", count(system, negativeRules) === 1, count(system, negativeRules));
  check("ModelArk system has no short no-false-praise copy", count(system, "NO FALSE PRAISE:") === 0);
  check("ModelArk appendix has no negative rules", count(MODELARK_OUTPUT_APPENDIX, NEGATIVE_HEADER) === 0);

  const cases: Array<[string, Answers]> = [
    ["positive note", { note: "菜很好吃服务也很好" }],
    ["empty note", { note: "" }],
    ["zh 太辣", { note: "冬阴功太辣了" }],
    ["zh 不新鲜", { note: "虾有点不新鲜" }],
    ["zh 吃到头发", { note: "炒饭里吃到头发" }],
    ["zh 拉肚子", { note: "吃完回去拉肚子" }],
    ["en terrible", { note: "The curry was terrible" }],
    ["en overpriced", { note: "overpriced for the portion" }],
    ["en never again", { note: "", recommendToOther: "never again" }],
  ];
  for (const [label, answers] of cases) {
    const user = userFor(answers, "modelark");
    const request = `${system}\n\n${user}\n\n${MODELARK_OUTPUT_APPENDIX}`;
    check(`[${label}] request carries the negative rules once`, count(request, negativeRules) === 1, count(request, negativeRules));
    check(`[${label}] rules header appears once across system + user + appendix`, count(request, NEGATIVE_HEADER) === 1, count(request, NEGATIVE_HEADER));
    check(`[${label}] user prompt does not repeat the rules`, count(user, negativeRules) === 0 && count(user, NEGATIVE_HEADER) === 0);
    check(`[${label}] user prompt points the note at NEGATIVE FEEDBACK once`, count(user, NOTE_RULE) === 1, count(user, NOTE_RULE));
  }

  const missed: Answers = { note: "吃完回去拉肚子" };
  check("detector-miss fixture is not flagged by mayContainNegativeFeedback", detectorSees(missed) === false);
  const missedRequest = `${system}\n\n${userFor(missed, "modelark")}\n\n${MODELARK_OUTPUT_APPENDIX}`;
  check("detector miss still carries the negative rules once", count(missedRequest, negativeRules) === 1, count(missedRequest, negativeRules));

  return { deployment, checks, hashes };
}

function runStore(deployment: StoreId) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ["MONGODB_URI", "DATABASE_URL", "MONGODB_DB_NAME", "OPENAI_API_KEY", "OPENAI_MODEL", "AI_PROVIDER", "MODELARK_MODEL", "MODELARK_API_KEY", "GENERATION_DIAGNOSTICS"]) {
    delete env[key];
  }
  env.NEGATIVE_PROMPT_CHILD = "1";
  env.DEPLOYMENT_ID = deployment;
  env.NEXT_PUBLIC_DEPLOYMENT_ID = deployment;
  const run = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = run.stdout.split("\n").find((row) => row.startsWith(RESULT_PREFIX));
  if (!line) throw new Error(`${deployment} produced no result:\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as ChildResult;
}

async function main() {
  if (process.env.NEGATIVE_PROMPT_CHILD === "1") {
    process.stdout.write(`\n${RESULT_PREFIX}${JSON.stringify(await runChild())}\n`);
    return;
  }
  const results = (Object.keys(STORES) as StoreId[]).map(runStore);
  if (process.env.PRINT_PROMPT_HASHES) {
    console.log(JSON.stringify(Object.fromEntries(results.map((result) => [result.deployment, result.hashes])), null, 2));
    return;
  }
  let failed = 0;
  for (const result of results) {
    const failures = result.checks.filter((item) => !item.ok);
    failed += failures.length;
    console.log(`${result.deployment}: ${result.checks.length - failures.length}/${result.checks.length} checks passed`);
    for (const item of failures) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  if (failed > 0) process.exit(1);
  console.log("validate-negative-feedback-prompt: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
