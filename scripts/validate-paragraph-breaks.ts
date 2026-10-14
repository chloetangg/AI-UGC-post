/**
 * Paragraph breaks the model wrote survive the sentence-level passes (generation variation, content lock),
 * and keeping them stops enforceCustomerEvidence from re-sorting a caption that already had its own shape.
 * Part 1 checks keepParagraphBreaks on its own, part 2 the two passes that call it, part 3 drives the real
 * /api/generate route with a mocked ModelArk reply. Each store runs in its own child process.
 * No real model request; MongoDB is an in-memory stub.
 * Run: npx tsx scripts/validate-paragraph-breaks.ts
 */
import { spawnSync } from "node:child_process";
import * as nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const STORES: Record<string, { branch: string; mall: string }> = {
  "baan-ying-centralworld": { branch: "Baan Ying (centralwOrld, 3rd Floor)", mall: "centralwOrld" },
  "baan-ying-siam-center": { branch: "Baan Ying (Siam Center, 2nd Floor)", mall: "Siam Center" },
};
const RESULT_PREFIX = "PARAGRAPH_BREAKS_RESULT ";
const SEED = 20261011;

type Check = { name: string; ok: boolean; detail?: string };
type ResolveHook = (specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) => unknown;
type RouteCase = {
  id: string;
  style: string;
  placement?: string;
  format?: string;
  note: (mall: string) => string;
  dishes: string[];
  enjoyMost: string[];
  recommendTo: string[];
  titles: [string, string, string];
  paragraphs: (mall: string) => string[];
  main: string;
  sub: string;
};

/** The six captions whose paragraphs used to be flattened before enforceCustomerEvidence. Same inputs as validate-final-title-emoji. */
const ROUTE_CASES: RouteCase[] = [
  {
    id: "titles-no-emoji-caption-one",
    style: "casual",
    note: () => "老婆上次来就说很好吃，这次就带着一家人来了。咖喱蟹肉很下饭，芒果糯米饭也不错",
    dishes: ["Crab Meat Curry", "Mango Sticky Rice"],
    enjoyMost: ["食物味道正宗美味"],
    recommendTo: ["咖喱蟹肉很下饭"],
    titles: ["老婆念叨了好久的那家泰餐", "咖喱蟹肉配饭真的停不下来", "一家人吃得都挺满意"],
    paragraphs: () => [
      "老婆上次来就说很好吃，这次干脆带着一家人一起来了。",
      "咖喱蟹肉很下饭，我一个人就拌了两碗饭😋 芒果糯米饭也不错，甜度刚好。",
      "一家人都吃得很满意，下次还会再来。",
    ],
    main: "老婆推荐的泰餐",
    sub: "咖喱蟹肉很下饭",
  },
  {
    id: "titles-differ-only-by-emoji",
    style: "foodie",
    note: () => "咖喱蟹肉很下饭，店员服务很热情，环境也舒服",
    dishes: ["Crab Meat Curry"],
    enjoyMost: ["店员服务热情周到", "店里氛围很舒服"],
    recommendTo: ["咖喱蟹肉很下饭"],
    titles: ["咖喱蟹肉很下饭🦀", "🦀咖喱蟹肉很下饭！", "咖喱蟹肉很下饭"],
    paragraphs: () => ["咖喱蟹肉很下饭，蟹肉给得不少。", "店员服务很热情，环境也舒服，坐着不赶时间。", "下次还想点这道。"],
    main: "咖喱蟹肉很下饭",
    sub: "店员服务很热情",
  },
  {
    id: "short-style",
    style: "short",
    note: () => "粉红奶很好喝",
    dishes: ["Pink Milk"],
    enjoyMost: ["食物味道正宗美味"],
    recommendTo: ["粉红奶很好喝"],
    titles: ["粉红奶很好喝", "这杯粉红奶会再点", "甜度刚刚好"],
    paragraphs: () => ["粉红奶很好喝。", "甜度刚刚好，不腻。", "下次还点这杯。"],
    main: "粉红奶很好喝",
    sub: "甜度刚刚好",
  },
  {
    id: "location-emoji-not-counted",
    style: "travel",
    placement: "standalone",
    format: "A",
    note: (mall) => `在${mall}逛街逛累了进来吃，冬阴功汤很开胃，环境很舒服`,
    dishes: ["Tom Yum Goong"],
    enjoyMost: ["店里氛围很舒服"],
    recommendTo: ["冬阴功汤很开胃"],
    titles: ["逛街逛累了进来歇脚", "冬阴功汤很开胃", "坐下来才发现环境很舒服"],
    paragraphs: (mall) => [`在${mall}逛街逛累了，就进来吃饭。`, "冬阴功汤很开胃，酸辣刚好。环境很舒服，坐着很放松😌"],
    main: "逛累了进来吃泰餐",
    sub: "冬阴功汤很开胃",
  },
  {
    id: "copied-customer-sentence",
    style: "story",
    note: () => "老婆上次来就说很好吃，这次就带着一家人来了。咖喱蟹肉很下饭",
    dishes: ["Crab Meat Curry"],
    enjoyMost: ["食物味道正宗美味"],
    recommendTo: ["咖喱蟹肉很下饭"],
    titles: ["老婆上次来就说很好吃", "咖喱蟹肉拌饭停不下来", "这次就带着一家人来了"],
    paragraphs: () => [
      "老婆上次来过就一直说好吃，这次干脆带着一家人一起过来。",
      "咖喱蟹肉很下饭，蟹肉给得也多。",
      "一家人吃得都挺开心，下次还来。",
    ],
    main: "老婆推荐的泰餐",
    sub: "咖喱蟹肉很下饭",
  },
  {
    id: "local-long-caption-one-emoji",
    style: "local",
    note: (mall) => `就在${mall}上班，经常来，冬阴功汤很开胃，菠萝炒饭配料很足，店员很热情`,
    dishes: ["Tom Yum Goong", "Pineapple Fried Rice"],
    enjoyMost: ["店员服务热情周到"],
    recommendTo: ["冬阴功汤很开胃"],
    titles: ["上班附近常来的一家", "冬阴功汤很开胃", "店员一直都很热情"],
    paragraphs: () => [
      "上班就在附近，午饭经常来。",
      "冬阴功汤很开胃，酸辣刚好🍤 菠萝炒饭配料很足，一份吃得很饱。",
      "店员一直都很热情，坐着也舒服。下次还是点这两样。",
    ],
    main: "上班附近常来",
    sub: "冬阴功汤很开胃",
  },
];

const emojiCount = (text: string) => (text.match(/\p{Extended_Pictographic}/gu) ?? []).length;
const story = (caption: string) =>
  caption
    .split("\n")
    .filter((row) => !/^\s*(?:📍|⏰)/u.test(row))
    .join("\n")
    .trim();
const paragraphsOf = (text: string) => story(text).split(/\n\n+/).filter((block) => block.trim());
const sentenceKeys = (text: string) =>
  story(text)
    .split(/[。！？!?\n]|\p{Extended_Pictographic}\uFE0F?\s*/u)
    .map((part) => part.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, ""))
    .filter((part) => part.length >= 2);
/** Sentences both texts share, in the order each text has them. */
const sameOrder = (a: string, b: string) => {
  const left = sentenceKeys(a);
  const right = sentenceKeys(b);
  const shared = left.filter((key) => right.includes(key));
  return shared.join("|") === right.filter((key) => left.includes(key)).join("|");
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fakeCollection(name: string, sink: Map<string, unknown[]>) {
  const cursor: Record<string, unknown> = {};
  for (const method of ["sort", "limit", "skip", "project"]) cursor[method] = () => cursor;
  cursor.toArray = async () => [];
  return new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "find" || prop === "aggregate") return () => cursor;
        if (prop === "findOne") return async () => null;
        return async (...args: unknown[]) => {
          if (prop === "replaceOne" || prop === "insertOne") {
            const doc = prop === "replaceOne" ? args[1] : args[0];
            sink.set(name, [...(sink.get(name) ?? []), doc]);
          }
          return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
        };
      },
    },
  );
}

async function runChild() {
  const deployment = process.env.DEPLOYMENT_ID ?? "";
  const store = STORES[deployment];
  if (!store) throw new Error(`Unknown store ${deployment}`);
  const stub = pathToFileURL(fileURLToPath(new URL("./stubs/next-headers.cjs", import.meta.url))).href;
  const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void };
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "next/headers") return { url: stub, shortCircuit: true, format: "commonjs" };
      return nextResolve(specifier, context);
    },
  });
  const sink = new Map<string, unknown[]>();
  (globalThis as { _mongoClient?: unknown })._mongoClient = {
    db: () => ({ collection: (name: string) => fakeCollection(name, sink) }),
  };

  const { getDeploymentConfig } = await import("../lib/deployment/config");
  const { keepParagraphBreaks } = await import("../lib/caption-story");
  const { ensureGenerationVariation, planGenerationVariation } = await import("../lib/generation-variation");
  const { ensureContentLock } = await import("../lib/content-lock");

  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) =>
    checks.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });
  check("process loaded this store's deployment", getDeploymentConfig().deploymentId === deployment, getDeploymentConfig().deploymentId);

  // Part 1: keepParagraphBreaks on its own.
  const flat = (text: string) => text.replace(/\s+/g, "");
  const unit = (name: string, original: string, processed: string, expected: string) => {
    const out = keepParagraphBreaks(original, processed);
    check(`unit ${name}: result`, out === expected, { out, expected });
    check(`unit ${name}: only line breaks were added`, flat(out) === flat(processed), { out, processed });
    check(`unit ${name}: emoji count unchanged`, emojiCount(out) === emojiCount(processed), out);
    check(`unit ${name}: running it again changes nothing`, keepParagraphBreaks(original, out) === out, out);
  };
  unit(
    "three flattened paragraphs",
    "老婆上次来就说很好吃，这次干脆带着一家人一起来了。\n\n咖喱蟹肉很下饭，蟹肉给得不少。\n\n一家人吃得都挺开心，下次还来。",
    "老婆上次来就说很好吃，这次干脆带着一家人一起来了。咖喱蟹肉很下饭，蟹肉给得不少。一家人吃得都挺开心，下次还来。",
    "老婆上次来就说很好吃，这次干脆带着一家人一起来了。\n\n咖喱蟹肉很下饭，蟹肉给得不少。\n\n一家人吃得都挺开心，下次还来。",
  );
  unit(
    "paragraph opens with an emoji",
    "咖喱蟹肉很下饭，甜度刚好。\n\n🥰一家人都吃得很满意，下次还会再来。",
    "咖喱蟹肉很下饭，甜度刚好。🥰一家人都吃得很满意，下次还会再来。",
    "咖喱蟹肉很下饭，甜度刚好。\n\n🥰一家人都吃得很满意，下次还会再来。",
  );
  unit(
    "paragraph opens with a variation-selector emoji",
    "冬阴功汤很开胃，酸辣刚好。\n\n🛍️逛完商场刚好过来吃饭。",
    "冬阴功汤很开胃，酸辣刚好。🛍️逛完商场刚好过来吃饭。",
    "冬阴功汤很开胃，酸辣刚好。\n\n🛍️逛完商场刚好过来吃饭。",
  );
  unit(
    "previous paragraph ends on an emoji",
    "泰奶也不错，不会太甜🧋\n\n下次换我拉朋友来。",
    "泰奶也不错，不会太甜🧋下次换我拉朋友来。",
    "泰奶也不错，不会太甜🧋\n\n下次换我拉朋友来。",
  );
  unit(
    "two paragraphs open with the same words",
    "咖喱蟹肉很下饭，蟹肉给得不少。\n\n咖喱蟹肉的汤汁拌饭刚好。",
    "咖喱蟹肉很下饭，蟹肉给得不少。咖喱蟹肉的汤汁拌饭刚好。",
    "咖喱蟹肉很下饭，蟹肉给得不少。\n\n咖喱蟹肉的汤汁拌饭刚好。",
  );
  unit(
    "a clause merged onto the opening sentence",
    "咖喱蟹肉很下饭。\n\n店员服务很热情。",
    "咖喱蟹肉很下饭。店员服务很热情，上菜也快。",
    "咖喱蟹肉很下饭。\n\n店员服务很热情，上菜也快。",
  );
  unit(
    "opening sentence deleted: that break is skipped, the next one returns",
    "这次点了咖喱蟹肉。\n\n店员服务很热情。\n\n下次还会再来这家。",
    "这次点了咖喱蟹肉。下次还会再来这家。",
    "这次点了咖喱蟹肉。\n\n下次还会再来这家。",
  );
  unit(
    "opening sentence rewritten: that break is skipped",
    "这次点了咖喱蟹肉。\n\n店员服务很热情。",
    "这次点了咖喱蟹肉。店员一直都很耐心。",
    "这次点了咖喱蟹肉。店员一直都很耐心。",
  );
  unit(
    "repeated opening deduplicated: ambiguous, skipped",
    "这次点了很多菜。\n\n下次还来这里。\n\n下次还来这里。",
    "这次点了很多菜。下次还来这里。",
    "这次点了很多菜。下次还来这里。",
  );
  unit(
    "same opening appears twice in the result: ambiguous, skipped",
    "这次点了很多菜。\n\n咖喱蟹肉很下饭。",
    "咖喱蟹肉很下饭。这次点了很多菜。咖喱蟹肉很下饭。",
    "咖喱蟹肉很下饭。这次点了很多菜。咖喱蟹肉很下饭。",
  );
  unit(
    "paragraphs moved out of order: both skipped",
    "第一段第一句话。\n\n第二段第一句话。\n\n第三段第一句话。",
    "第一段第一句话。第三段第一句话。第二段第一句话。",
    "第一段第一句话。第三段第一句话。第二段第一句话。",
  );
  unit("original without paragraph breaks", "没有段落的原文。第二句话在这里。", "没有段落的原文。第二句话在这里。", "没有段落的原文。第二句话在这里。");
  unit("short opening (under four characters) is not an anchor", "咖喱蟹肉很下饭。\n\n好吃。", "咖喱蟹肉很下饭。好吃。", "咖喱蟹肉很下饭。好吃。");
  unit(
    "breaks already there are kept, none doubled",
    "咖喱蟹肉很下饭。\n\n店员服务很热情。",
    "咖喱蟹肉很下饭。\n\n店员服务很热情。",
    "咖喱蟹肉很下饭。\n\n店员服务很热情。",
  );

  // Part 2: the passes that call it.
  const paragraphCaption = "第一次来这家店，朋友推荐的。\n\n咖喱蟹肉很下饭，蟹肉给得不少。\n\n店员服务很热情，下次还会再来。";
  const noted = {
    branch: store.branch,
    diningNote: "朋友推荐的，咖喱蟹肉很下饭，店员服务很热情",
    dishes: ["Crab Meat Curry"],
    enjoyMost: ["店员服务热情周到"],
    recommendTo: ["咖喱蟹肉很下饭"],
  };
  const notedPlan = planGenerationVariation({ context: noted, variantIndex: 0 });
  const kept = ensureGenerationVariation({
    titles: ["朋友推荐的泰餐", "咖喱蟹肉很下饭", "店员服务很热情"],
    caption: paragraphCaption,
    coverTitle: "朋友推荐的泰餐",
    coverSubtitle: "咖喱蟹肉很下饭",
    plan: notedPlan,
    context: noted,
    variantIndex: 0,
  });
  check("variation keeps the customer's paragraphs", paragraphsOf(kept.caption).length === 3, kept.caption);
  check("variation keeps the sentence order", sameOrder(paragraphCaption, kept.caption), kept.caption);
  check("variation memory still reads the flat caption", !kept.memory.firstSentencePattern.includes("\n"), kept.memory.firstSentencePattern);

  const tagsOnly = {
    branch: store.branch,
    dishes: ["Crab Meat Curry"],
    enjoyMost: ["食物味道正宗美味", "店员服务热情周到", "店里氛围很舒服"],
  };
  const tagPlan = planGenerationVariation({ context: tagsOnly, variantIndex: 1, previousCaption: paragraphCaption });
  const rebuilt = ensureGenerationVariation({
    titles: ["朋友推荐的泰餐", "咖喱蟹肉很下饭", "店员服务很热情"],
    caption: paragraphCaption,
    coverTitle: "朋友推荐的泰餐",
    coverSubtitle: "咖喱蟹肉很下饭",
    plan: tagPlan,
    context: tagsOnly,
    previousCaption: paragraphCaption,
    variantIndex: 1,
  });
  check("rebuilt caption is new text", flat(rebuilt.caption) !== flat(paragraphCaption), rebuilt.caption);
  check("rebuilt caption gets no breaks from the text it replaced", !/\n\n/.test(rebuilt.caption), rebuilt.caption);

  const locked = ensureContentLock({
    titles: ["朋友推荐的泰餐", "咖喱蟹肉很下饭", "店员服务很热情"],
    caption: paragraphCaption,
    coverTitle: "朋友推荐的泰餐",
    coverSubtitle: "咖喱蟹肉很下饭",
    context: noted,
  });
  check("content lock keeps the paragraphs", paragraphsOf(locked.caption).length === 3, locked.caption);
  check("content lock keeps the sentence order", sameOrder(paragraphCaption, locked.caption), locked.caption);
  const lockedFlat = ensureContentLock({
    titles: ["朋友推荐的泰餐", "咖喱蟹肉很下饭", "店员服务很热情"],
    caption: paragraphCaption.replace(/\n\n/g, ""),
    coverTitle: "朋友推荐的泰餐",
    coverSubtitle: "咖喱蟹肉很下饭",
    context: noted,
  });
  check("content lock adds no breaks to a caption that had none", !/\n\n/.test(lockedFlat.caption), lockedFlat.caption);

  // Part 3: the real route.
  let pendingModel = "";
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    if (!target.includes("bytepluses.com/api/v3/responses")) throw new Error(`unexpected fetch ${target}`);
    return new Response(
      JSON.stringify({
        status: "completed",
        model: "mock-model",
        output: [{ type: "message", content: [{ type: "output_text", text: pendingModel }] }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  const { POST } = await import("../app/api/generate/route");
  const mallTag = store.mall.replace(/\s+/g, "");

  for (const testCase of ROUTE_CASES) {
    Math.random = mulberry32(SEED);
    const bytes = mulberry32(SEED ^ 0x5bd1e995);
    Object.defineProperty(globalThis.crypto, "getRandomValues", {
      configurable: true,
      value: <T extends ArrayBufferView | null>(array: T) => {
        if (array instanceof Uint32Array) for (let i = 0; i < array.length; i += 1) array[i] = Math.floor(bytes() * 2 ** 32);
        return array;
      },
    });
    const paragraphs = testCase.paragraphs(store.mall);
    pendingModel = JSON.stringify({
      titles: testCase.titles,
      captionParagraphs: paragraphs,
      hashtags: ["#BaanYing曼谷", `#${mallTag}泰餐`, "#曼谷美食", "#泰国美食", `#曼谷${mallTag}`],
      mainTitle: testCase.main,
      subTitle: testCase.sub,
      selectedPhotoIndex: 0,
      selectedPhotoIndexes: [0],
      photoSelectionReason: "",
      remainingPhotoOrder: [],
      remainingOrderPattern: "1",
    });
    sink.delete("generation_diagnostics");
    const form = new FormData();
    form.append(
      "payload",
      JSON.stringify({
        branch: store.branch,
        campaignId: deployment,
        customerType: "",
        visitFrequency: "",
        enjoyMost: testCase.enjoyMost,
        recommendedDishes: testCase.dishes,
        recommendedDishOther: "",
        recommendTo: testCase.recommendTo,
        diningExperienceNote: testCase.note(store.mall),
        photoCount: 1,
        contentType: "restaurant-recommendation",
        productName: "Baan Ying",
        variantIndex: 1,
        previousGenerationMemories: [
          {
            contentFocus: "food",
            openingStyle: "",
            openingPattern: "",
            firstSentencePattern: "",
            informationPriority: [],
            informationOrder: [],
            dishOrder: [],
            dishEntryPattern: "",
            sentenceRhythm: "",
            endingPattern: "",
            informationDensity: "",
            structureType: "",
            lengthLevel: "medium",
            humanStyle: testCase.style,
          },
        ],
        contentLanguage: "zh-CN",
        requiredLocationPlacement: testCase.placement ?? "inline",
        requiredLocationFormat: testCase.format ?? "",
        brandName: "Baan Ying",
        productCategory: "Thai Restaurant / Food & Dining",
        productDescription: "",
      }),
    );
    const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: form }));
    const body = (await response.json()) as { caption?: string };
    const label = testCase.id;
    check(`${label}: status 200`, response.status === 200, body);
    const record = (sink.get("generation_diagnostics") ?? []).at(-1) as
      | { stages?: Array<{ stage: string; before?: { caption?: string }; after?: { caption?: string } }> }
      | undefined;
    const evidence = (record?.stages ?? []).find((stage) => stage.stage === "enforceCustomerEvidence");
    const before = evidence?.before?.caption ?? "";
    const after = evidence?.after?.caption ?? "";
    const model = paragraphs.join("\n\n");
    check(`${label}: enforceCustomerEvidence stage recorded`, Boolean(evidence), record?.stages?.map((stage) => stage.stage));
    check(`${label}: model paragraphs reach enforceCustomerEvidence`, paragraphsOf(before).length === paragraphsOf(model).length, before);
    check(`${label}: enforceCustomerEvidence does not re-sort the sentences`, sameOrder(before, after) && paragraphsOf(after).length === paragraphsOf(before).length, { before, after });
    check(`${label}: enforceCustomerEvidence keeps the emoji count`, emojiCount(after) === emojiCount(before), { before, after });
    const finalCaption = body.caption ?? "";
    check(`${label}: final caption keeps the model's sentence order`, sameOrder(model, finalCaption), { model, finalCaption });
    check(`${label}: final caption keeps the model's paragraph count`, paragraphsOf(finalCaption).length === paragraphsOf(model).length, finalCaption);
  }

  process.stdout.write(`\n${RESULT_PREFIX}${JSON.stringify({ deployment, checks })}\n`);
}

function runStore(deployment: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ["MONGODB_URI", "DATABASE_URL", "MONGODB_DB_NAME", "OPENAI_API_KEY", "OPENAI_MODEL", "AI_PROVIDER", "MODELARK_MODEL"]) {
    delete env[key];
  }
  env.PARAGRAPH_BREAKS_CHILD = "1";
  env.GENERATION_DIAGNOSTICS = "1";
  env.DEPLOYMENT_ID = deployment;
  env.NEXT_PUBLIC_DEPLOYMENT_ID = deployment;
  if (deployment !== "baan-ying-centralworld") env.MONGODB_DB_NAME = "paragraph-breaks-test";
  env.MODELARK_API_KEY = "paragraph-breaks-test-placeholder";
  const run = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = run.stdout.split("\n").find((row) => row.startsWith(RESULT_PREFIX));
  if (!line) throw new Error(`${deployment} produced no result:\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as { deployment: string; checks: Check[] };
}

async function main() {
  if (process.env.PARAGRAPH_BREAKS_CHILD === "1") return runChild();
  let failed = 0;
  for (const deployment of Object.keys(STORES)) {
    const result = runStore(deployment);
    const failures = result.checks.filter((item) => !item.ok);
    failed += failures.length;
    console.log(`${result.deployment}: ${result.checks.length - failures.length}/${result.checks.length} checks passed`);
    for (const item of failures) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  if (failed > 0) process.exit(1);
  console.log("validate-paragraph-breaks: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
