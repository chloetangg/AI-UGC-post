/**
 * Runs the real /api/generate route with fixed surveys and fixed mocked model replies,
 * then checks the final titles, caption emoji, and cover the user would see.
 * ModelArk and OpenAI are both mocked. Any other network call fails the run. MongoDB is an in-memory stub.
 *
 *   npx tsx scripts/validate-final-title-emoji.ts            run the checks
 *   FINAL_COPY_TRACE=1 npx tsx scripts/...                   also print every post-processing stage
 *   FINAL_COPY_DUMP=/tmp/out.json npx tsx scripts/...        write the final outputs for a before/after diff
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { headlinesSharePoint, sameTitleAngle } from "../lib/headline-overlap";

type Provider = "modelark" | "openai";

type Place = {
  deployment: string;
  branch: string;
  mall: string;
  mallZh: string;
  floor: string;
  foreign: RegExp;
};

const PLACES: Record<string, Place> = {
  "baan-ying-centralworld": {
    deployment: "baan-ying-centralworld",
    branch: "Baan Ying (centralwOrld, 3rd Floor)",
    mall: "centralwOrld",
    mallZh: "尚泰世界购物中心",
    floor: "3楼",
    foreign: /siam\s*center|暹罗中心|10:30–21:00|(?<![0-9０-９])2楼/i,
  },
  "baan-ying-siam-center": {
    deployment: "baan-ying-siam-center",
    branch: "Baan Ying (Siam Center, 2nd Floor)",
    mall: "Siam Center",
    mallZh: "暹罗中心",
    floor: "2楼",
    foreign: /central\s*world|尚泰世界|10:00–22:00|(?<![0-9０-９])3楼/i,
  },
};

export type Case = {
  id: string;
  style: string;
  placement?: "inline" | "standalone";
  format?: "A" | "B" | "C" | "D" | "E";
  /** Customer facts the final caption must still carry. */
  keep?: string[];
  input: (p: Place) => { note: string; dishes: string[]; enjoyMost: string[]; recommendTo: string[] };
  model: (p: Place) => {
    titles: string[];
    captionParagraphs: string[];
    hashtags: string[];
    mainTitle: string;
    subTitle: string;
  };
};

function tags(p: Place) {
  const mallTag = p.mall.replace(/\s+/g, "");
  return ["#BaanYing曼谷", `#${mallTag}泰餐`, "#曼谷美食", "#泰国美食", `#曼谷${mallTag}`];
}

export const CASES: Case[] = [
  {
    id: "titles-no-emoji-caption-one",
    style: "casual",
    keep: ["一家人", "咖喱蟹肉", "芒果糯米饭"],
    input: () => ({
      note: "老婆上次来就说很好吃，这次就带着一家人来了。咖喱蟹肉很下饭，芒果糯米饭也不错",
      dishes: ["Crab Meat Curry", "Mango Sticky Rice"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["咖喱蟹肉很下饭"],
    }),
    model: () => ({
      titles: ["老婆念叨了好久的那家泰餐", "咖喱蟹肉配饭真的停不下来", "一家人吃得都挺满意"],
      captionParagraphs: [
        "老婆上次来就说很好吃，这次干脆带着一家人一起来了。",
        "咖喱蟹肉很下饭，我一个人就拌了两碗饭😋 芒果糯米饭也不错，甜度刚好。",
        "一家人都吃得很满意，下次还会再来。",
      ],
      hashtags: [],
      mainTitle: "老婆推荐的泰餐",
      subTitle: "咖喱蟹肉很下饭",
    }),
  },
  {
    id: "titles-one-emoji",
    style: "foodie",
    input: () => ({
      note: "冬阴功汤酸辣开胃，虾很新鲜，菠萝炒饭配料很足",
      dishes: ["Tom Yum Goong", "Pineapple Fried Rice"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["冬阴功汤酸辣开胃"],
    }),
    model: () => ({
      titles: ["冬阴功汤酸辣很开胃🍤", "菠萝炒饭的配料是真的足", "虾很新鲜这点很加分"],
      captionParagraphs: [
        "冬阴功汤酸辣开胃，喝第一口就醒了🍤",
        "虾很新鲜，肉是弹的。菠萝炒饭配料很足，菠萝块也不少。",
        "两样一起吃刚刚好。",
      ],
      hashtags: [],
      mainTitle: "冬阴功汤很开胃",
      subTitle: "菠萝炒饭配料足",
    }),
  },
  {
    id: "titles-three-emoji",
    style: "playful",
    input: () => ({
      note: "哈哈芒果糯米饭绝了，粉红奶也好喝，朋友一直在拍照",
      dishes: ["Mango Sticky Rice", "Pink Milk"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["芒果糯米饭很好吃"],
    }),
    model: () => ({
      titles: ["🥭芒果糯米饭真的绝了", "粉红奶好喝到续杯🥤", "朋友一直在拍照😂"],
      captionParagraphs: [
        "哈哈芒果糯米饭真的绝了🥭",
        "粉红奶也好喝，朋友一直在拍照，我在旁边一直吃。",
        "这顿吃得很开心😆",
      ],
      hashtags: [],
      mainTitle: "芒果糯米饭绝了",
      subTitle: "粉红奶也好喝",
    }),
  },
  {
    id: "titles-differ-only-by-emoji",
    style: "foodie",
    input: () => ({
      note: "咖喱蟹肉很下饭，店员服务很热情，环境也舒服",
      dishes: ["Crab Meat Curry"],
      enjoyMost: ["店员服务热情周到", "店里氛围很舒服"],
      recommendTo: ["咖喱蟹肉很下饭"],
    }),
    model: () => ({
      titles: ["咖喱蟹肉很下饭🦀", "🦀咖喱蟹肉很下饭！", "咖喱蟹肉很下饭"],
      captionParagraphs: [
        "咖喱蟹肉很下饭，蟹肉给得不少。",
        "店员服务很热情，环境也舒服，坐着不赶时间。",
        "下次还想点这道。",
      ],
      hashtags: [],
      mainTitle: "咖喱蟹肉很下饭",
      subTitle: "店员服务很热情",
    }),
  },
  {
    id: "natural-titles-kept",
    style: "local",
    input: (p) => ({
      note: `在${p.mall}上班，午饭经常来，青咖喱牛肉分量很足，吃完还能坐一会`,
      dishes: ["Green Curry Beef"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["青咖喱牛肉分量很足"],
    }),
    model: () => ({
      titles: ["上班午饭的固定选择", "青咖喱牛肉的分量很实在🍛", "午休还能慢慢坐一会"],
      captionParagraphs: [
        "上班的午饭经常来这家。",
        "青咖喱牛肉分量很足，一份就饱了🍛",
        "午休时间吃完还能坐一会儿。",
      ],
      hashtags: [],
      mainTitle: "上班午饭的固定选择",
      subTitle: "青咖喱牛肉分量很足",
    }),
  },
  {
    id: "caption-enough-emoji",
    style: "emotional",
    input: () => ({
      note: "带爸妈来的，他们很喜欢，青柠蒸鲈鱼很鲜，服务员很耐心",
      dishes: ["Steamed Sea Bass with Lime"],
      enjoyMost: ["店员服务热情周到"],
      recommendTo: ["青柠蒸鲈鱼很鲜"],
    }),
    model: () => ({
      titles: ["带爸妈来吃的这一顿", "青柠蒸鲈鱼很鲜🐟", "服务员一直很耐心"],
      captionParagraphs: [
        "这次是带爸妈来的🥰 他们很喜欢。",
        "青柠蒸鲈鱼很鲜，酸味刚好🐟",
        "服务员一直很耐心，帮我们介绍菜。看着爸妈吃得开心，我也很满足😌",
      ],
      hashtags: [],
      mainTitle: "带爸妈来吃泰餐",
      subTitle: "青柠蒸鲈鱼很鲜",
    }),
  },
  {
    id: "short-style",
    style: "short",
    input: () => ({
      note: "粉红奶很好喝",
      dishes: ["Pink Milk"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["粉红奶很好喝"],
    }),
    model: () => ({
      titles: ["粉红奶很好喝", "这杯粉红奶会再点", "甜度刚刚好"],
      captionParagraphs: ["粉红奶很好喝。", "甜度刚刚好，不腻。", "下次还点这杯。"],
      hashtags: [],
      mainTitle: "粉红奶很好喝",
      subTitle: "甜度刚刚好",
    }),
  },
  {
    id: "customer-ban",
    style: "casual",
    input: () => ({
      note: "不要表情。菠萝炒饭配料很足，服务员很热情",
      dishes: ["Pineapple Fried Rice"],
      enjoyMost: ["店员服务热情周到"],
      recommendTo: ["菠萝炒饭配料很足"],
    }),
    model: () => ({
      titles: ["菠萝炒饭配料很足🍍", "服务员很热情", "🍚这顿吃得很满足"],
      captionParagraphs: ["菠萝炒饭配料很足🍚", "服务员很热情，上菜也快😊", "整体吃得很满足。"],
      hashtags: [],
      mainTitle: "菠萝炒饭配料足",
      subTitle: "服务员很热情",
    }),
  },
  {
    id: "mismatched-food-emoji",
    style: "foodie",
    input: () => ({
      note: "芒果糯米饭的芒果很新鲜，咖喱蟹肉也好吃",
      dishes: ["Mango Sticky Rice", "Crab Meat Curry"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["芒果糯米饭芒果很新鲜"],
    }),
    model: () => ({
      titles: ["芒果糯米饭的芒果很新鲜🍋", "咖喱蟹肉也很好吃🍤", "这两样都会再点"],
      captionParagraphs: ["芒果糯米饭的芒果很新鲜🍋", "咖喱蟹肉也好吃🍤 蟹肉很多。", "这两样下次都会再点。"],
      hashtags: [],
      mainTitle: "芒果糯米饭很新鲜",
      subTitle: "咖喱蟹肉也好吃",
    }),
  },
  {
    id: "location-emoji-not-counted",
    style: "travel",
    keep: ["冬阴功"],
    placement: "standalone",
    format: "A",
    input: (p) => ({
      note: `在${p.mall}逛街逛累了进来吃，冬阴功汤很开胃，环境很舒服`,
      dishes: ["Tom Yum Goong"],
      enjoyMost: ["店里氛围很舒服"],
      recommendTo: ["冬阴功汤很开胃"],
    }),
    model: (p) => ({
      titles: ["逛街逛累了进来歇脚", "冬阴功汤很开胃", "坐下来才发现环境很舒服"],
      captionParagraphs: [
        `在${p.mall}逛街逛累了，就进来吃饭。`,
        "冬阴功汤很开胃，酸辣刚好。环境很舒服，坐着很放松😌",
        `📍 ${p.mallZh}（${p.mall}）${p.floor}`,
        "⏰ 10:00",
      ],
      hashtags: [],
      mainTitle: "逛累了进来吃泰餐",
      subTitle: "冬阴功汤很开胃",
    }),
  },
  {
    id: "punctuation-after-emoji",
    style: "chatty",
    input: () => ({
      note: "其实是朋友拉我来的，结果虾很好吃，泰奶也不错",
      dishes: ["Thai Milk Tea"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["泰奶不错"],
    }),
    model: () => ({
      titles: ["本来是被朋友拉来的", "结果虾很好吃", "泰奶也不错"],
      captionParagraphs: [
        "其实是朋友拉我来的，我本来没什么期待。",
        "结果虾好好吃😋。泰奶也不错，不会太甜。",
        "下次换我拉朋友来。",
      ],
      hashtags: [],
      mainTitle: "被朋友拉来的",
      subTitle: "虾很好吃",
    }),
  },
  {
    id: "copied-customer-sentence",
    style: "story",
    keep: ["一家人", "咖喱蟹肉"],
    input: () => ({
      note: "老婆上次来就说很好吃，这次就带着一家人来了。咖喱蟹肉很下饭",
      dishes: ["Crab Meat Curry"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["咖喱蟹肉很下饭"],
    }),
    model: () => ({
      titles: ["老婆上次来就说很好吃", "咖喱蟹肉拌饭停不下来", "这次就带着一家人来了"],
      captionParagraphs: [
        "老婆上次来过就一直说好吃，这次干脆带着一家人一起过来。",
        "咖喱蟹肉很下饭，蟹肉给得也多。",
        "一家人吃得都挺开心，下次还来。",
      ],
      hashtags: [],
      mainTitle: "老婆推荐的泰餐",
      subTitle: "咖喱蟹肉很下饭",
    }),
  },
  {
    id: "all-dish-yummy-titles",
    style: "foodie",
    input: () => ({
      note: "朋友推荐来的。咖喱蟹肉好吃，芒果糯米饭也好吃",
      dishes: ["Crab Meat Curry", "Mango Sticky Rice"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["咖喱蟹肉好吃"],
    }),
    model: () => ({
      titles: ["咖喱蟹肉真的好吃🦀", "芒果糯米饭也很好吃", "咖喱蟹肉拌饭很好吃"],
      captionParagraphs: [
        "朋友推荐过来的，点了咖喱蟹肉和芒果糯米饭。",
        "咖喱蟹肉好吃，蟹肉不少。芒果糯米饭也好吃，甜度刚好。",
        "两道都会再点。",
      ],
      hashtags: [],
      mainTitle: "朋友推荐的泰餐",
      subTitle: "咖喱蟹肉好吃",
    }),
  },
  {
    id: "local-long-caption-one-emoji",
    style: "local",
    input: (p) => ({
      note: `就在${p.mall}上班，经常来，冬阴功汤很开胃，菠萝炒饭配料很足，店员很热情`,
      dishes: ["Tom Yum Goong", "Pineapple Fried Rice"],
      enjoyMost: ["店员服务热情周到"],
      recommendTo: ["冬阴功汤很开胃"],
    }),
    model: () => ({
      titles: ["上班附近常来的一家", "冬阴功汤很开胃", "店员一直都很热情"],
      captionParagraphs: [
        "上班就在附近，午饭经常来。",
        "冬阴功汤很开胃，酸辣刚好🍤 菠萝炒饭配料很足，一份吃得很饱。",
        "店员一直都很热情，坐着也舒服。下次还是点这两样。",
      ],
      hashtags: [],
      mainTitle: "上班附近常来",
      subTitle: "冬阴功汤很开胃",
    }),
  },
  {
    id: "banned-title-words",
    style: "chatty",
    input: () => ({
      note: "咖喱蟹肉很下饭，泰奶也不错",
      dishes: ["Crab Meat Curry", "Thai Milk Tea"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["咖喱蟹肉很下饭"],
    }),
    model: () => ({
      titles: ["不得不说咖喱蟹肉很下饭", "终于喝到不错的泰奶", "POV：Must-have的泰餐"],
      captionParagraphs: ["咖喱蟹肉很下饭，拌着饭吃刚好。", "泰奶也不错，不会太甜。", "下次还会点这两样。"],
      hashtags: [],
      mainTitle: "咖喱蟹肉很下饭",
      subTitle: "泰奶也不错",
    }),
  },
];

const PROVIDERS: Provider[] = ["modelark", "openai"];
const SEED = 20261011;

type StageRow = { stage: string; titles: string[]; caption: string };

export type RunResult = {
  id: string;
  provider: Provider;
  status: number;
  body: Record<string, unknown>;
  stages: StageRow[];
  modelCalls: string[];
  otherFetches: string[];
};

type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context: unknown) => unknown,
) => unknown;

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
  const p = PLACES[process.env.DEPLOYMENT_ID ?? ""];
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

  let current: RunResult | null = null;
  let pendingModel = "";
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      text?: { format?: { name?: string } };
      response_format?: { json_schema?: { name?: string } };
    };
    if (target.includes("bytepluses.com/api/v3/responses")) {
      const label = body.text?.format?.name ?? "";
      current?.modelCalls.push(`modelark:${label}`);
      if (label !== "xiaohongshu_ugc_post") throw new Error(`unexpected ModelArk call ${label}`);
      return new Response(
        JSON.stringify({
          status: "completed",
          model: "mock-model",
          output: [{ type: "message", content: [{ type: "output_text", text: pendingModel }] }],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (target.includes("api.openai.com/v1/chat/completions")) {
      const label = body.response_format?.json_schema?.name ?? "";
      current?.modelCalls.push(`openai:${label}`);
      if (label !== "xiaohongshu_ugc_post") throw new Error(`unexpected OpenAI call ${label}`);
      return new Response(
        JSON.stringify({
          id: "chatcmpl-mock",
          object: "chat.completion",
          created: 0,
          model: "gpt-4o",
          choices: [{ index: 0, message: { role: "assistant", content: pendingModel }, finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    current?.otherFetches.push(target);
    throw new Error(`unexpected fetch ${target}`);
  }) as typeof fetch;

  const { POST } = await import("../app/api/generate/route");
  const results: RunResult[] = [];
  for (const provider of PROVIDERS) for (const testCase of CASES) {
    process.env.AI_PROVIDER = provider;
    Math.random = mulberry32(SEED);
    const bytes = mulberry32(SEED ^ 0x5bd1e995);
    Object.defineProperty(globalThis.crypto, "getRandomValues", {
      configurable: true,
      value: <T extends ArrayBufferView | null>(array: T) => {
        if (array instanceof Uint32Array) for (let i = 0; i < array.length; i += 1) array[i] = Math.floor(bytes() * 2 ** 32);
        return array;
      },
    });
    const input = testCase.input(p);
    const model = testCase.model(p);
    pendingModel = JSON.stringify({
      ...model,
      hashtags: model.hashtags.length ? model.hashtags : tags(p),
      selectedPhotoIndex: 0,
      selectedPhotoIndexes: [0],
      photoSelectionReason: "",
      remainingPhotoOrder: [],
      remainingOrderPattern: "1",
    });
    current = { id: testCase.id, provider, status: 0, body: {}, stages: [], modelCalls: [], otherFetches: [] };
    sink.delete("generation_diagnostics");
    const payload = {
      branch: p.branch,
      campaignId: p.deployment,
      customerType: "",
      visitFrequency: "",
      enjoyMost: input.enjoyMost,
      recommendedDishes: input.dishes,
      recommendedDishOther: "",
      recommendTo: input.recommendTo,
      diningExperienceNote: input.note,
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
    };
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: form }));
    current.status = response.status;
    current.body = (await response.json()) as Record<string, unknown>;
    const record = (sink.get("generation_diagnostics") ?? []).at(-1) as
      | { stages?: Array<{ stage: string; after?: { titles?: string[]; caption?: string } }> }
      | undefined;
    current.stages = (record?.stages ?? []).map((stage) => ({
      stage: stage.stage,
      titles: stage.after?.titles ?? [],
      caption: stage.after?.caption ?? "",
    }));
    results.push(current);
  }
  process.stdout.write(`\nFINAL_COPY_RESULT ${JSON.stringify(results)}\n`);
}

function runDeployment(deployment: string): RunResult[] {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ["MONGODB_URI", "DATABASE_URL", "OPENAI_MODEL", "AI_PROVIDER", "MODELARK_MODEL"]) delete env[key];
  env.FINAL_COPY_CHILD = "1";
  env.DEPLOYMENT_ID = deployment;
  env.NEXT_PUBLIC_DEPLOYMENT_ID = deployment;
  env.MONGODB_DB_NAME = deployment === "baan-ying-centralworld" ? "" : "final-copy-test";
  env.MODELARK_API_KEY = "final-copy-test-placeholder";
  env.OPENAI_API_KEY = "final-copy-test-placeholder";
  env.GENERATION_DIAGNOSTICS = "1";
  const run = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = run.stdout.split("\n").find((row) => row.startsWith("FINAL_COPY_RESULT "));
  if (!line) throw new Error(`${deployment} produced no result:\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(line.slice("FINAL_COPY_RESULT ".length)) as RunResult[];
}

const PICTO = /\p{Extended_Pictographic}/gu;

function storyOf(caption: string) {
  return caption
    .split("\n")
    .filter((line) => !/^\s*[📍⏰]/u.test(line))
    .join("\n")
    .replace(/[📍⏰][^\n]*/gu, "");
}

function emojiCount(text: string) {
  return (text.match(PICTO) ?? []).filter((char) => char !== "📍" && char !== "⏰").length;
}

function printTrace(deployment: string, results: RunResult[]) {
  for (const result of results) {
    console.log(`\n=== ${deployment} ${result.provider} ${result.id} status=${result.status}`);
    let lastTitles = "";
    let lastCaption = "";
    for (const stage of result.stages) {
      const titles = stage.titles.join(" | ");
      const count = emojiCount(storyOf(stage.caption));
      if (titles !== lastTitles || stage.caption !== lastCaption) {
        console.log(`  ${stage.stage.padEnd(42)} body-emoji=${count}  titles=${titles}`);
        if (stage.caption !== lastCaption) console.log(`      caption: ${stage.caption.replace(/\n/g, "⏎")}`);
      }
      lastTitles = titles;
      lastCaption = stage.caption;
    }
    const body = result.body;
    console.log(`  FINAL titles: ${JSON.stringify(body.titles)}`);
    console.log(`  FINAL cover:  ${body.coverTitle} / ${body.coverSubtitle}`);
    console.log(`  FINAL caption:\n    ${String(body.caption ?? body.error ?? "").replace(/\n/g, "\n    ")}`);
  }
}

const FLAG = "🇹🇭";
const FOOD_EMOJI: Record<string, RegExp> = {
  "🦀": /蟹/,
  "🥭": /芒果/,
  "🍍": /菠萝/,
  "🍤": /虾|冬阴功/,
  "🦐": /虾|冬阴功/,
  "🐟": /鱼|鲈/,
  "🍋": /柠檬|青柠/,
  "🥥": /椰/,
  "🍚": /饭/,
  "🍛": /咖喱|饭/,
  "🍲": /汤|冬阴功|锅/,
  "🍜": /面|河粉|米粉|粉丝/,
  "🧋": /奶/,
  "🍗": /鸡/,
  "🥩": /牛|猪|肉/,
  "🥗": /沙拉|木瓜/,
};
const DISH_WORD = /咖喱|蟹|虾|冬阴功|炒饭|糯米饭|鲈鱼|泰奶|粉红奶|牛肉|汤/;
const DISH_AT_END = /(?:饭|汤|蟹肉|虾仁|河虾|鲈鱼|粉红奶|泰奶|咖喱|牛肉|冬阴功|空心菜)$/;
const BANNED_TITLE_WORDS = /终于|不得不说|POV|Must[-\s]?have/i;
const COLD_TEMPLATE = /^曼谷泰餐\p{Script=Han}{1,10}很满足|^曼谷泰餐的\p{Script=Han}{1,10}值得点|记得住的/u;

const titleEmojis = (title: string) => (title.replace(FLAG, "").match(PICTO) ?? []);
const plainText = (text: string) => text.replace(/\uFE0F/g, "").replace(/[^\p{L}\p{N}\n]/gu, "").replace(/\n+/g, "\n");
const hanKey = (text: string) => (text.match(/\p{Script=Han}|[A-Za-z0-9]/gu) ?? []).join("");

function sentencesOf(story: string) {
  return story
    .split(/[。！？!?\n]|\p{Extended_Pictographic}\uFE0F?\s/u)
    .filter((part) => /\p{Script=Han}{2}/u.test(part)).length;
}

function sentenceAround(text: string, index: number, length: number) {
  const before = text.slice(0, index);
  const after = text.slice(index + length);
  const atStart = before.length === 0 || /[。！？!?\n\s]$/.test(before);
  if (atStart) return after.split(/[。！？!?\n]|\p{Extended_Pictographic}/u)[0];
  const parts = before.split(/[。！？!?\n]|\p{Extended_Pictographic}\uFE0F?\s/u);
  return parts[parts.length - 1];
}

function wrongFoodEmoji(text: string) {
  const wrong: string[] = [];
  for (const match of text.matchAll(PICTO)) {
    const words = FOOD_EMOJI[match[0]];
    if (!words) continue;
    const sentence = sentenceAround(text, match.index ?? 0, match[0].length);
    if (!words.test(sentence)) wrong.push(`${match[0]} in "${sentence}"`);
  }
  return wrong;
}

type Check = { name: string; ok: boolean; detail?: string };

function checkResult(deployment: string, result: RunResult, testCase: Case): Check[] {
  const p = PLACES[deployment];
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail?: unknown) =>
    checks.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });
  const body = result.body as { titles?: string[]; caption?: string; coverTitle?: string; coverSubtitle?: string };
  const input = testCase.input(p);
  const model = testCase.model(p);
  const banned = /不要\s*(?:加)?\s*(?:表情|emoji)|无表情/i.test(input.note);

  add("status 200", result.status === 200, result.body);
  add("one model request, no other network call", result.modelCalls.length === 1 && result.otherFetches.length === 0, result);
  if (result.status !== 200) return checks;

  const titles = body.titles ?? [];
  const caption = body.caption ?? "";
  const story = storyOf(caption);
  const cover = [body.coverTitle ?? "", body.coverSubtitle ?? ""];

  add("3 non-empty titles", titles.length === 3 && titles.every((title) => hanKey(title).length >= 4), titles);
  const keys = titles.map(hanKey);
  add("titles differ beyond emoji/punctuation", new Set(keys).size === keys.length, titles);
  add(
    "no two titles share one angle",
    titles.every((left, i) => titles.slice(i + 1).every((right) => !sameTitleAngle(left, right))),
    titles,
  );
  add("no 终于/不得不说/POV/Must-have", titles.every((title) => !BANNED_TITLE_WORDS.test(title)), titles);
  add(
    "not all three titles are dish + 好吃",
    !titles.every((title) => DISH_WORD.test(title) && /好吃|好喝/.test(title)),
    titles,
  );
  add(
    "no title copies a customer sentence",
    titles.every((title) => {
      const key = hanKey(title);
      return !input.note.split(/[。！？!?，,\n]/).some((clause) => hanKey(clause) === key && key.length >= 6);
    }),
    titles,
  );
  add("no 全家都喜欢-style invention", titles.every((title) => !/全家都喜欢/.test(title)), titles);
  add("no cold template title", titles.every((title) => !COLD_TEMPLATE.test(title.replace(FLAG, ""))), titles);

  const withEmoji = titles.filter((title) => titleEmojis(title).length > 0);
  if (banned) {
    add("ban: no title emoji", titles.every((title) => !/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]/u.test(title)), titles);
  } else {
    add("at least one title has an emoji", withEmoji.length >= 1, titles);
    add("at least one title is plain", withEmoji.length <= 2, titles);
  }
  add("at most one emoji per title", titles.every((title) => titleEmojis(title).length <= 1), titles);
  const used = titles.flatMap(titleEmojis).map((emoji) => emoji.replace(/\uFE0F/g, ""));
  add("no emoji repeats across titles", new Set(used).size === used.length, titles);
  add(
    "🇹🇭 at most once and only at the start",
    titles.filter((title) => title.includes(FLAG)).length <= 1 && titles.every((title) => !title.includes(FLAG) || title.startsWith(FLAG)),
    titles,
  );
  add(
    "title emoji only at the start or end",
    titles.every((title) => {
      const inner = title.replace(FLAG, "").replace(/^\p{Extended_Pictographic}\uFE0F?/u, "").replace(/\p{Extended_Pictographic}\uFE0F?$/u, "");
      return !/\p{Extended_Pictographic}/u.test(inner);
    }),
    titles,
  );
  add(
    "no title emoji right after a dish name",
    titles.every((title) => {
      const match = title.match(/^(.*?)\p{Extended_Pictographic}\uFE0F?$/u);
      return !match || !DISH_AT_END.test(match[1].trim());
    }),
    titles,
  );
  const bareTitles = titles.map((title) => title.replace(FLAG, ""));
  add("title food emoji matches the title", bareTitles.every((title) => wrongFoodEmoji(title).length === 0), bareTitles.flatMap(wrongFoodEmoji));

  add("no emoji on the cover", cover.every((line) => !/\p{Extended_Pictographic}/u.test(line)), cover);
  add("cover main and subtitle filled", cover.every((line) => hanKey(line).length >= 3), cover);
  add("cover main and subtitle carry different points", !headlinesSharePoint(cover[0], cover[1]), cover);
  add("no cold template cover main", !COLD_TEMPLATE.test(cover[0]), cover);

  const count = emojiCount(story);
  const sentences = sentencesOf(story);
  if (banned) {
    add("ban: no caption emoji", count === 0, story);
  } else {
    const restrained = /^(local|short)$/.test(testCase.style) && sentences <= 3;
    const floor = sentences <= 2 || restrained ? 1 : 2;
    add(`caption story emoji ≥ ${floor} (${sentences} sentences)`, count >= floor, story);
    if (sentences <= 6) add("caption story emoji ≤ 4", count <= 4, story);
    if (sentences >= 3) add("not every sentence carries an emoji", count < sentences, story);
  }
  add("no emoji wedged between Han characters", !/\p{Script=Han}\p{Extended_Pictographic}\uFE0F?\p{Script=Han}/u.test(story), story);
  add("no emoji followed by 。or ，", !/\p{Extended_Pictographic}\uFE0F?[。，、]/u.test(story), story);
  add("caption food emoji matches its sentence", wrongFoodEmoji(story).length === 0, wrongFoodEmoji(story));
  add(
    "paragraphs kept",
    story.split(/\n{2,}/).filter((part) => part.trim()).length >= Math.min(2, model.captionParagraphs.length),
    story,
  );
  for (const fact of testCase.keep ?? []) add(`caption keeps "${fact}"`, story.includes(fact), story);
  if (testCase.id === "natural-titles-kept") {
    add("natural titles kept word for word", titles.map(hanKey).join("|") === model.titles.map(hanKey).join("|"), { titles, model: model.titles });
  }
  if (testCase.id === "location-emoji-not-counted") {
    add("📍 line kept outside the story", /📍/u.test(caption) && !/📍/u.test(story), caption);
  }

  for (let i = 1; i < result.stages.length; i += 1) {
    if (result.stages[i].stage !== "ensureCaptionEmojis") continue;
    const before = result.stages[i - 1].caption;
    const after = result.stages[i].caption;
    const ok = banned
      ? hanKey(before) === hanKey(after)
      : plainText(before) === plainText(after) && (before.match(/\n\n/g) ?? []).length === (after.match(/\n\n/g) ?? []).length;
    add(`ensureCaptionEmojis (stage ${i}) changed only emoji`, ok, { before, after });
  }

  add("no foreign-store facts", !p.foreign.test(JSON.stringify(result.body)), result.body);
  return checks;
}

async function checkCaptionFunction(): Promise<Check[]> {
  process.env.DEPLOYMENT_ID ??= "baan-ying-centralworld";
  const { ensureCaptionEmojis } = await import("../lib/caption-emoji");
  type Style = Parameters<typeof ensureCaptionEmojis>[1];
  const style = (primaryStyle: string, variation = 0.3) => ({ primaryStyle, intensity: 0.6, variation }) as unknown as Style;
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail?: unknown) =>
    checks.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });

  const long = "这次点了咖喱蟹肉和冬阴功汤。\n\n咖喱蟹肉很下饭，蟹肉给得很多。冬阴功汤酸辣开胃😋 喝完还想再来一碗。\n\n店员很热情，坐着也舒服。下次还会再来。";
  for (const id of ["local", "short", "playful", "foodie", "casual"]) {
    const out = ensureCaptionEmojis(long, style(id));
    const count = emojiCount(out);
    add(`${id}: 5+ sentence caption gets 2–4 emoji`, count >= 2 && count <= 4, out);
    add(`${id}: only emoji changed`, plainText(out) === plainText(long), out);
    add(`${id}: paragraphs kept`, (out.match(/\n\n/g) ?? []).length === 2, out);
  }

  const glued = ensureCaptionEmojis("咖喱蟹肉好好吃😋。下次还来。", style("casual"));
  add("好好吃😋。 loses the 。", !/😋。/u.test(glued), glued);

  const banned = ensureCaptionEmojis("菠萝炒饭配料很足🍍 服务员很热情😊 下次还来。", style("casual"), "不要表情");
  add("customer ban removes every caption emoji", emojiCount(banned) === 0 && hanKey(banned) === hanKey("菠萝炒饭配料很足服务员很热情下次还来"), banned);

  const spaced = ensureCaptionEmojis("咖喱蟹肉很下饭😋 下次还来。", style("playful"), "好吃，不要 emoji");
  add("「不要 emoji」 with a space is a ban too", emojiCount(spaced) === 0, spaced);

  const mismatched = ensureCaptionEmojis("咖喱蟹肉很下饭🍋 芒果糯米饭也不错。下次还来。", style("foodie"));
  add("wrong food emoji is corrected", wrongFoodEmoji(mismatched).length === 0 && !mismatched.includes("🍋"), mismatched);

  const enough = "咖喱蟹肉很下饭🦀 芒果糯米饭甜度刚好🥭\n\n店员很热情😊 下次还来。";
  const kept = ensureCaptionEmojis(enough, style("emotional"));
  add("enough emoji: none added or removed", emojiCount(kept) === 3 && plainText(kept) === plainText(enough), kept);

  const located = "冬阴功汤很开胃。环境很舒服。逛累了刚好坐一会。\n\n📍 centralwOrld 3楼\n⏰ 10:00–22:00";
  const locatedOut = ensureCaptionEmojis(located, style("travel"));
  add("📍/⏰ do not count toward the story", emojiCount(storyOf(locatedOut)) >= 2, locatedOut);
  add("📍/⏰ lines unchanged", locatedOut.endsWith("📍 centralwOrld 3楼\n⏰ 10:00–22:00"), locatedOut);
  return checks;
}

async function runParent() {
  const dump: Record<string, RunResult[]> = {};
  for (const deployment of Object.keys(PLACES)) {
    dump[deployment] = runDeployment(deployment);
    if (process.env.FINAL_COPY_TRACE) printTrace(deployment, dump[deployment]);
  }
  if (process.env.FINAL_COPY_DUMP) writeFileSync(process.env.FINAL_COPY_DUMP, JSON.stringify(dump, null, 2));

  const failures: string[] = [];
  let total = 0;
  const record = (label: string, checks: Check[]) => {
    for (const check of checks) {
      total += 1;
      if (!check.ok) failures.push(`${label} :: ${check.name}\n      ${check.detail ?? ""}`);
    }
  };

  const titleSlots = { start: 0, end: 0 };
  for (const [deployment, results] of Object.entries(dump)) {
    for (const result of results) {
      const testCase = CASES.find((item) => item.id === result.id);
      if (!testCase) continue;
      record(`${deployment} ${result.provider} ${result.id}`, checkResult(deployment, result, testCase));
      for (const title of (result.body.titles as string[] | undefined) ?? []) {
        const bare = title.replace(FLAG, "");
        if (/^\p{Extended_Pictographic}/u.test(bare)) titleSlots.start += 1;
        else if (/\p{Extended_Pictographic}\uFE0F?$/u.test(bare)) titleSlots.end += 1;
      }
    }
    for (const testCase of CASES) {
      const [modelark, openai] = PROVIDERS.map((provider) => results.find((item) => item.id === testCase.id && item.provider === provider));
      const pick = (result?: RunResult) =>
        JSON.stringify([result?.body.titles, result?.body.caption, result?.body.coverTitle, result?.body.coverSubtitle]);
      record(`${deployment} ${testCase.id}`, [
        { name: "ModelArk and OpenAI final output identical", ok: pick(modelark) === pick(openai), detail: `${pick(modelark)}\n      ${pick(openai)}` },
      ]);
    }
  }
  record("all cases", [
    { name: "title emoji positions vary (start and end both used)", ok: titleSlots.start > 0 && titleSlots.end > 0, detail: JSON.stringify(titleSlots) },
  ]);
  record("ensureCaptionEmojis", await checkCaptionFunction());

  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.log(`\n${total - failures.length}/${total} checks passed`);
  if (failures.length) process.exit(1);
}

if (process.env.FINAL_COPY_CHILD === "1") {
  runChild().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  runParent().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
