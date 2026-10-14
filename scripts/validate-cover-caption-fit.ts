/**
 * The cover must match the final caption, and a selected dish is not a review.
 * Drives the real /api/generate route with a mocked ModelArk reply (first generation and regeneration)
 * and checks the final cover against the final caption. Each store runs in its own child process.
 * No real model request; MongoDB is an in-memory stub.
 * Run: npx tsx scripts/validate-cover-caption-fit.ts
 */
import { spawnSync } from "node:child_process";
import * as nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const STORES: Record<string, { branch: string; mall: string }> = {
  "baan-ying-centralworld": { branch: "Baan Ying (centralwOrld, 3rd Floor)", mall: "centralwOrld" },
  "baan-ying-siam-center": { branch: "Baan Ying (Siam Center, 2nd Floor)", mall: "Siam Center" },
};
const RESULT_PREFIX = "COVER_CAPTION_FIT_RESULT ";
const SEED = 20261013;
const DISH_PRAISE = /必吃|值得点|值得一试|很香|真香|好香|很满足|超爱|有点特别|还想再点|受欢迎|蛮喜欢|好吃|下饭|开胃/;
const TAG_WORDS = /服务|店员|热情|周到|温馨|氛围/;

type Check = { name: string; ok: boolean; detail?: string };
type ResolveHook = (specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) => unknown;
type RouteCase = {
  id: string;
  note: string;
  dishes: string[];
  enjoyMost: string[];
  recommendTo: string[];
  titles: [string, string, string];
  caption: string[];
  main: string;
  sub: string;
  /** Run only as a regeneration whose previous cover was this. */
  previousCover?: string;
  /** Dish (full name) the cover may still carry, because the customer praised it and the caption has it. */
  keepDish?: string;
  /** The cover must carry one of these customer points. */
  coverAbout?: RegExp;
  /** Dish (full name) the customer complained about. */
  complainedDish?: string;
  /** Words that must stay off the whole cover. */
  coverMustNot?: RegExp;
  /** Words that must stay off the cover main title. */
  mainMustNot?: RegExp;
  /** Words the caption must not gain. */
  captionMustNotAdd?: RegExp;
};

const ROUTE_CASES: RouteCase[] = [
  {
    id: "dish selected only, caption silent on it",
    note: "",
    dishes: ["Crab Meat Curry"],
    enjoyMost: [],
    recommendTo: [],
    titles: ["下班后来吃顿晚饭", "周末随手记一顿饭", "这次吃得很简单"],
    caption: ["下班后过来吃了顿晚饭。", "点完菜坐了一会儿就回去了。"],
    main: "曼谷必吃咖喱蟹肉",
    sub: "咖喱蟹肉很香很下饭",
    captionMustNotAdd: /蛮喜欢|很香|好吃|下饭|很满足|还想再点/,
  },
  {
    id: "owner and service note, dish selected",
    note: "老板很帅，服务很好",
    dishes: ["Crab Meat Curry"],
    enjoyMost: [],
    recommendTo: [],
    titles: ["老板很帅的一顿泰餐", "服务很好吃得很放松", "下班后来吃顿饭"],
    caption: ["这次来吃饭，老板很帅，服务也很好。", "坐着聊了很久才走。"],
    main: "曼谷必吃咖喱蟹肉",
    sub: "没想到超爱咖喱蟹肉",
    coverAbout: /老板|服务/,
    captionMustNotAdd: /蛮喜欢|很香|好吃|下饭|很满足/,
  },
  {
    id: "dish praised in the note and kept in the caption",
    note: "咖喱蟹肉很好吃",
    dishes: ["Crab Meat Curry"],
    enjoyMost: [],
    recommendTo: [],
    titles: ["咖喱蟹肉很好吃", "下班后来吃顿晚饭", "这顿吃得很开心"],
    caption: ["咖喱蟹肉很好吃，配米饭刚刚好。", "吃完就回去了。"],
    main: "咖喱蟹肉很好吃",
    sub: "配米饭吃刚刚好",
    keepDish: "咖喱蟹肉",
  },
  {
    id: "dish called too sour",
    note: "冬阴功太酸了",
    dishes: ["River Prawn Tom Yum"],
    enjoyMost: [],
    recommendTo: [],
    titles: ["下班后来吃顿晚饭", "这次点了冬阴功", "周末随手记一顿饭"],
    caption: ["这次点了冬阴功，酸度对我来说偏高。", "店里坐着还可以。"],
    main: "冬阴功酸辣开胃",
    sub: "曼谷必吃冬阴功",
    complainedDish: "河虾冬阴功汤",
  },
  {
    id: "regeneration after a food cover, tags present",
    note: "咖喱蟹肉很下饭",
    dishes: ["Crab Meat Curry"],
    enjoyMost: ["店员服务热情周到", "餐厅风格有满满的家庭式温馨氛围"],
    recommendTo: [],
    titles: ["曼谷美食发现", "曼谷美食推荐", "曼谷泰餐推荐"],
    caption: ["咖喱蟹肉很下饭，配米饭刚刚好。", "吃完就回去了。"],
    main: "曼谷美食发现",
    sub: "曼谷美食推荐",
    previousCover: "咖喱蟹肉很下饭 / 配米饭刚刚好",
    mainMustNot: TAG_WORDS,
    coverAbout: /咖喱蟹肉/,
  },
  {
    id: "regeneration keeps the customer's own subtitle over tags",
    note: "咖喱蟹肉很下饭",
    dishes: ["Crab Meat Curry"],
    enjoyMost: ["店员服务热情周到", "餐厅风格有满满的家庭式温馨氛围"],
    recommendTo: [],
    titles: ["咖喱蟹肉很下饭", "下班后来吃顿晚饭", "这顿吃得很开心"],
    caption: ["咖喱蟹肉很下饭，配米饭刚刚好。", "吃完就回去了。"],
    main: "咖喱蟹肉很下饭",
    sub: "配米饭吃刚刚好",
    previousCover: "曼谷泰餐咖喱蟹肉 / 这次点了咖喱蟹肉",
    coverMustNot: TAG_WORDS,
    coverAbout: /下饭|配米饭/,
  },
  {
    id: "cover names a dish the final caption dropped",
    note: "咖喱蟹肉很好吃",
    dishes: ["Crab Meat Curry", "Mango Sticky Rice"],
    enjoyMost: [],
    recommendTo: [],
    titles: ["咖喱蟹肉很好吃", "下班后来吃顿晚饭", "这顿吃得很开心"],
    caption: ["咖喱蟹肉很好吃，配米饭刚刚好。", "吃完就回去了。"],
    main: "芒果糯米饭超好吃",
    sub: "没想到超爱芒果糯米饭",
  },
];

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
  const { collectFullDishNames } = await import("../lib/cover/dish-names");
  const { evidenceLedCoverPairs, formatEvidencePriorityInstance } = await import("../lib/content-evidence");
  const { ensureContentLock } = await import("../lib/content-lock");
  const fit = (await import("../lib/cover/cover-caption-fit").catch(() => null)) as
    | null
    | { alignCoverWithCaption?: (input: { coverTitle: string; coverSubtitle: string; caption: string; context: Record<string, unknown> }) => { coverTitle: string; coverSubtitle: string } };

  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) =>
    checks.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });
  check("process loaded this store's deployment", getDeploymentConfig().deploymentId === deployment, getDeploymentConfig().deploymentId);
  const dishesIn = (text: string) => collectFullDishNames({ sourceTexts: [text] });

  // Selected dish only: post-processing must not tell the caption the customer liked it.
  const lockedOnly = ensureContentLock({
    titles: ["下班后来吃顿晚饭", "周末随手记一顿饭", "这次吃得很简单"],
    caption: "下班后过来吃了顿晚饭。点完菜坐了一会儿就回去了。",
    coverTitle: "下班后来吃顿晚饭",
    coverSubtitle: "点完菜坐了一会儿",
    context: { branch: store.branch, dishes: ["Crab Meat Curry"] },
  });
  check("content lock adds no praise for a dish that was only selected", !/蛮喜欢|很香|好吃|下饭/.test(lockedOnly.caption), lockedOnly.caption);
  const lockedPraised = ensureContentLock({
    titles: ["下班后来吃顿晚饭", "周末随手记一顿饭", "这次吃得很简单"],
    caption: "下班后过来吃了顿晚饭。点完菜坐了一会儿就回去了。",
    coverTitle: "下班后来吃顿晚饭",
    coverSubtitle: "点完菜坐了一会儿",
    context: { branch: store.branch, dishes: ["Crab Meat Curry"], diningNote: "咖喱蟹肉很好吃" },
  });
  check("content lock restores the customer's own words for a praised dish", lockedPraised.caption.includes("咖喱蟹肉很好吃"), lockedPraised.caption);

  // Evidence-led cover pairs: no 必吃 for a dish that was only selected; regeneration does not hand the cover to a tag.
  const selectionPairs = evidenceLedCoverPairs({ branch: store.branch, dishes: ["Crab Meat Curry"] });
  check("cover pairs: no 必吃 for a selected-only dish", selectionPairs.every((pair) => !/必吃/.test(pair.title + pair.subtitle)), selectionPairs.slice(0, 4));
  const regenPairs = evidenceLedCoverPairs({
    branch: store.branch,
    diningNote: "咖喱蟹肉很下饭",
    dishes: ["Crab Meat Curry"],
    enjoyMost: ["店员服务热情周到", "餐厅风格有满满的家庭式温馨氛围"],
    previousCoverHookType: "food",
  });
  check("cover pairs on regeneration: a tag does not lead the first pair", Boolean(regenPairs[0]) && !TAG_WORDS.test(regenPairs[0]?.title ?? ""), regenPairs.slice(0, 3));
  const regenBrief = formatEvidencePriorityInstance({
    branch: store.branch,
    diningNote: "老板很帅",
    enjoyMost: ["店员服务热情周到", "餐厅风格有满满的家庭式温馨氛围"],
    previousCoverTitle: "老板很帅的曼谷泰餐 / 老板本人很有记忆点",
  });
  const regenPrimary = regenBrief.split("\n").find((row) => row.startsWith("PRIMARY EXPERIENCE: ")) ?? "";
  check("regeneration brief: PRIMARY EXPERIENCE stays on the customer's point, not a tag", /handsome-owner/.test(regenPrimary), regenPrimary);

  // The final cover gate on its own.
  if (!fit?.alignCoverWithCaption) {
    check("alignCoverWithCaption exists", false, "lib/cover/cover-caption-fit.ts not found");
  } else {
    const align = fit.alignCoverWithCaption;
    const ctx = { branch: store.branch, dishes: ["Crab Meat Curry"], diningNote: "老板很帅，服务很好" };
    const out = align({ coverTitle: "曼谷必吃咖喱蟹肉", coverSubtitle: "没想到超爱咖喱蟹肉", caption: "老板很帅，服务也很好。坐着聊了很久。", context: ctx });
    check("gate: a dish missing from the caption leaves the cover", dishesIn(out.coverTitle + out.coverSubtitle).length === 0, out);
    check("gate: replacement comes from what the caption says", /老板|服务/.test(out.coverTitle + out.coverSubtitle), out);
    const kept = align({ coverTitle: "咖喱蟹肉很好吃", coverSubtitle: "配米饭吃刚刚好", caption: "咖喱蟹肉很好吃，配米饭刚刚好。", context: { branch: store.branch, dishes: ["Crab Meat Curry"], diningNote: "咖喱蟹肉很好吃" } });
    check("gate: a praised dish in the caption stays", kept.coverTitle === "咖喱蟹肉很好吃" && kept.coverSubtitle === "配米饭吃刚刚好", kept);
    const before = { coverTitle: "咖喱蟹肉很好吃", coverSubtitle: "配米饭吃刚刚好" };
    const changed = align({ ...before, caption: "这次来吃饭，老板很帅。", context: { branch: store.branch, dishes: ["Crab Meat Curry"], diningNote: "咖喱蟹肉很好吃，老板很帅" } });
    check("gate: after the caption drops the dish, the cover drops it too", dishesIn(changed.coverTitle + changed.coverSubtitle).length === 0, changed);
    const sour = align({ coverTitle: "冬阴功酸辣开胃", coverSubtitle: "这次点了冬阴功", caption: "这次点了冬阴功，酸度对我来说偏高。", context: { branch: store.branch, dishes: ["River Prawn Tom Yum"], diningNote: "冬阴功太酸了" } });
    check("gate: a complained dish leaves the cover", !/冬阴功/.test(sour.coverTitle + sour.coverSubtitle), sour);
    const neutral = align({ coverTitle: "曼谷必吃", coverSubtitle: "这次点了咖喱蟹肉", caption: "这次点了咖喱蟹肉。", context: { branch: store.branch, dishes: ["Crab Meat Curry"] } });
    check("gate: 必吃 does not sit beside a dish nobody reviewed", !/必吃|超爱|很香|值得点/.test(neutral.coverTitle + neutral.coverSubtitle), neutral);
    const dropped = align({
      coverTitle: "咖喱蟹肉",
      coverSubtitle: "还点了芒果糯米饭",
      caption: "如果只选一道，我会选咖喱蟹肉。\n\n📍 Location",
      context: { branch: store.branch, dishes: ["Crab Meat Curry", "Mango Sticky Rice"], recommendTo: ["Rich", "Satisfying"] },
    });
    check("gate: a dropped dish leaves the subtitle", !/芒果糯米饭/.test(dropped.coverSubtitle), dropped);
    check("gate: the replacement subtitle adds no praise nobody wrote", !DISH_PRAISE.test(dropped.coverSubtitle), dropped);
  }

  let pendingModel = "";
  let modelCalls = 0;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    if (!target.includes("bytepluses.com/api/v3/responses")) throw new Error(`unexpected fetch ${target}`);
    modelCalls += 1;
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
    const runs = testCase.previousCover ? [true] : [false, true];
    for (const regenerate of runs) {
      const label = `${testCase.id}${regenerate ? " (regenerate)" : ""}`;
      Math.random = mulberry32(SEED);
      const bytes = mulberry32(SEED ^ 0x5bd1e995);
      Object.defineProperty(globalThis.crypto, "getRandomValues", {
        configurable: true,
        value: <T extends ArrayBufferView | null>(array: T) => {
          if (array instanceof Uint32Array) for (let i = 0; i < array.length; i += 1) array[i] = Math.floor(bytes() * 2 ** 32);
          return array;
        },
      });
      pendingModel = JSON.stringify({
        titles: testCase.titles,
        captionParagraphs: testCase.caption,
        hashtags: ["#BaanYing曼谷", `#${mallTag}泰餐`, "#曼谷美食", "#泰国美食", `#曼谷${mallTag}`],
        mainTitle: testCase.main,
        subTitle: testCase.sub,
        selectedPhotoIndex: 0,
        selectedPhotoIndexes: [0],
        photoSelectionReason: "",
        remainingPhotoOrder: [],
        remainingOrderPattern: "1",
      });
      modelCalls = 0;
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
          diningExperienceNote: testCase.note,
          photoCount: 1,
          contentType: "restaurant-recommendation",
          productName: "Baan Ying",
          variantIndex: regenerate ? 1 : 0,
          contentLanguage: "zh-CN",
          requiredLocationPlacement: "standalone",
          brandName: "Baan Ying",
          productCategory: "Thai Restaurant / Food & Dining",
          productDescription: "",
          ...(regenerate
            ? {
                previousCaption: testCase.caption.join("\n"),
                previousTitles: testCase.titles,
                previousCoverTitle: testCase.previousCover ?? `${testCase.main} / ${testCase.sub}`,
              }
            : {}),
        }),
      );
      const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: form }));
      const body = (await response.json()) as { titles?: string[]; caption?: string; coverTitle?: string; coverSubtitle?: string };
      check(`${label}: status 200`, response.status === 200, body);
      check(`${label}: exactly one mocked ModelArk call`, modelCalls === 1, modelCalls);
      const caption = body.caption ?? "";
      const cover = `${body.coverTitle ?? ""} / ${body.coverSubtitle ?? ""}`;
      const coverDishes = dishesIn(cover);
      const captionDishes = new Set(dishesIn(caption));
      check(`${label}: every dish on the cover is in the final caption`, coverDishes.every((dish) => captionDishes.has(dish)), { cover, caption });
      const praisedInNote = new Set(dishesIn(testCase.note.split(/[，,。]/).filter((clause) => !/太|一般|不/.test(clause)).join("，")));
      const unreviewed = coverDishes.filter((dish) => !praisedInNote.has(dish));
      check(`${label}: no praise on the cover for a dish nobody reviewed`, unreviewed.length === 0 || !DISH_PRAISE.test(cover), { cover, unreviewed });
      if (testCase.keepDish) check(`${label}: a praised dish in the caption keeps its cover angle`, cover.includes(testCase.keepDish), cover);
      if (testCase.coverAbout) check(`${label}: cover follows what the customer wrote`, testCase.coverAbout.test(cover), cover);
      if (testCase.complainedDish) {
        check(`${label}: the complained dish is not on the cover`, !dishesIn(cover).includes(testCase.complainedDish), cover);
      }
      if (testCase.coverMustNot) check(`${label}: tags do not replace the customer's cover`, !testCase.coverMustNot.test(cover), cover);
      if (testCase.mainMustNot) check(`${label}: a tag does not lead the cover`, !testCase.mainMustNot.test(body.coverTitle ?? ""), cover);
      if (testCase.captionMustNotAdd) {
        const given = [testCase.note, ...testCase.caption].join(" ");
        const added = [...new Set(caption.match(new RegExp(testCase.captionMustNotAdd.source, "g")) ?? [])].filter((word) => !given.includes(word));
        check(`${label}: caption gains no praise to match the cover`, added.length === 0, { added, caption });
      }
      check(`${label}: 3 titles returned`, (body.titles ?? []).length === 3, body.titles);
    }
  }

  process.stdout.write(`\n${RESULT_PREFIX}${JSON.stringify({ deployment, checks })}\n`);
}

function runStore(deployment: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ["MONGODB_URI", "DATABASE_URL", "MONGODB_DB_NAME", "OPENAI_API_KEY", "OPENAI_MODEL", "AI_PROVIDER", "MODELARK_MODEL"]) {
    delete env[key];
  }
  env.COVER_CAPTION_FIT_CHILD = "1";
  env.DEPLOYMENT_ID = deployment;
  env.NEXT_PUBLIC_DEPLOYMENT_ID = deployment;
  if (deployment !== "baan-ying-centralworld") env.MONGODB_DB_NAME = "cover-caption-fit-test";
  env.MODELARK_API_KEY = "cover-caption-fit-test-placeholder";
  const run = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = run.stdout.split("\n").find((row) => row.startsWith(RESULT_PREFIX));
  if (!line) throw new Error(`${deployment} produced no result:\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as { deployment: string; checks: Check[] };
}

async function main() {
  if (process.env.COVER_CAPTION_FIT_CHILD === "1") return runChild();
  let failed = 0;
  for (const deployment of Object.keys(STORES)) {
    const result = runStore(deployment);
    const failures = result.checks.filter((item) => !item.ok);
    failed += failures.length;
    console.log(`${result.deployment}: ${result.checks.length - failures.length}/${result.checks.length} checks passed`);
    for (const item of failures) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  if (failed > 0) process.exit(1);
  console.log("validate-cover-caption-fit: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
