/**
 * Post-processing must not force a search keyword into a valid title.
 * Checks enforceCustomerEvidence directly and the real /api/generate route with a mocked ModelArk reply.
 * Each store runs in its own child process. No real model request; MongoDB is an in-memory stub.
 * Run: npx tsx scripts/validate-title-keyword-postprocess.ts
 */
import { spawnSync } from "node:child_process";
import * as nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const STORES: Record<string, { branch: string; mall: string }> = {
  "baan-ying-centralworld": { branch: "Baan Ying (centralwOrld, 3rd Floor)", mall: "centralwOrld" },
  "baan-ying-siam-center": { branch: "Baan Ying (Siam Center, 2nd Floor)", mall: "Siam Center" },
};
const RESULT_PREFIX = "TITLE_KEYWORD_RESULT ";
const SEED = 20261013;
const FLAG = /🇹🇭/g;
const COLD_TEMPLATE = /^曼谷泰餐\p{Script=Han}{1,10}很满足|^曼谷泰餐的\p{Script=Han}{1,10}值得点|记得住的/u;
const KEYWORD_SPLICE = /^曼谷泰餐/u;

type Check = { name: string; ok: boolean; detail?: string };
type Titles = [string, string, string];
type Visit = { note: string; dishes: string[]; enjoyMost?: string[]; recommendTo?: string[] };
type ResolveHook = (specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) => unknown;

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

const hanKey = (text: string) => (text.match(/\p{Script=Han}|[A-Za-z0-9]/gu) ?? []).join("");
const bare = (title: string) => title.replace(FLAG, "").replace(/\p{Extended_Pictographic}\uFE0F?/gu, "").trim();

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
  const { enforceCustomerEvidence } = await import("../lib/customer-evidence");
  const { sameTitleAngle } = await import("../lib/headline-overlap");

  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) =>
    checks.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });
  check("process loaded this store's deployment", getDeploymentConfig().deploymentId === deployment, getDeploymentConfig().deploymentId);

  const enforce = (visit: Visit, titles: Titles) =>
    enforceCustomerEvidence({
      titles,
      caption: "这次吃得很开心。",
      coverTitle: "粉红奶很好喝",
      coverSubtitle: "环境坐着很舒服",
      note: visit.note,
      dishes: visit.dishes,
      enjoyMost: visit.enjoyMost ?? [],
      recommendTo: visit.recommendTo ?? [],
      branch: store.branch,
    }).titles;

  const shapeChecks = (label: string, titles: string[]) => {
    const keys = titles.map(hanKey);
    check(`${label}: 3 titles with at least 4 characters`, titles.length === 3 && keys.every((key) => key.length >= 4), titles);
    check(`${label}: titles differ beyond emoji/punctuation`, new Set(keys).size === keys.length, titles);
    check(
      `${label}: no two titles share one angle`,
      titles.every((left, i) => titles.slice(i + 1).every((right) => !sameTitleAngle(left, right))),
      titles,
    );
    check(`${label}: no cold template title`, titles.every((title) => !COLD_TEMPLATE.test(bare(title))), titles);
  };

  const pinkMilk: Visit = { note: "粉红奶很好喝，环境很舒服", dishes: ["Mango Sticky Rice"] };
  const natural: Titles = ["粉红奶甜度刚刚好", "芒果糯米饭软糯香甜", "店里坐着很舒服"];
  const naturalOut = enforce(pinkMilk, natural);
  check("no keyword anywhere, all natural: titles unchanged", JSON.stringify(naturalOut) === JSON.stringify(natural), naturalOut);
  shapeChecks("natural", naturalOut);

  const dishVisit: Visit = { note: "粉红奶很好喝，环境很舒服", dishes: ["Pineapple Fried Rice"] };
  const dishTitles: Titles = ["粉红奶甜度刚刚好", "菠萝炒饭值得一试", "店里坐着很舒服"];
  const dishOut = enforce(dishVisit, dishTitles);
  check("dish title 2 without keyword is not rewritten", dishOut[1] === dishTitles[1], dishOut);
  check("dish title 2 does not become 曼谷泰餐的…值得点", !/^曼谷泰餐的.+值得点$/u.test(dishOut[1]), dishOut);

  const twoDishVisit: Visit = { note: "粉红奶很好喝", dishes: ["Mango Sticky Rice", "Pineapple Fried Rice"] };
  const twoDishTitles: Titles = ["粉红奶甜度刚刚好", "菠萝炒饭值得推荐", "芒果糯米饭软糯香甜"];
  const twoDishOut = enforce(twoDishVisit, twoDishTitles);
  check("title 2 keeps its own dish (菠萝炒饭)", twoDishOut[1].includes("菠萝炒饭") && !twoDishOut[1].includes("芒果糯米饭"), twoDishOut);
  check("title 2 is not swapped to title 3's dish", twoDishOut.filter((title) => title.includes("芒果糯米饭")).length === 1, twoDishOut);
  shapeChecks("two dishes", twoDishOut);

  const voiceTitles: Titles = ["店里坐着很舒服", "粉红奶喝着刚刚好", "芒果糯米饭软糯香甜"];
  const voiceOut = enforce(pinkMilk, voiceTitles);
  check("title 2 carrying the customer's point stays", voiceOut[1] === voiceTitles[1], voiceOut);
  check("no 曼谷泰餐 prefix is spliced onto any title", voiceOut.every((title) => !KEYWORD_SPLICE.test(bare(title))), voiceOut);

  const keywordTitles: Titles = ["粉红奶甜度刚刚好", "曼谷泰餐吃到很满足", "芒果糯米饭软糯香甜"];
  const keywordOut = enforce({ note: "粉红奶很好喝", dishes: ["Mango Sticky Rice"] }, keywordTitles);
  check("titles that already carry a keyword are unchanged", JSON.stringify(keywordOut) === JSON.stringify(keywordTitles), keywordOut);

  const mangoVisit: Visit = { note: "芒果糯米饭的芒果很新鲜，服务也很热情", dishes: ["Mango Sticky Rice", "Pineapple Fried Rice"] };
  const genericFirst = enforce(mangoVisit, ["真的好好吃", "菠萝炒饭配料很足", "店员服务很热情"]);
  check(
    "generic title 1 is still repaired from the customer's point",
    genericFirst[0] !== "真的好好吃" && genericFirst[0].includes("芒果糯米饭") && genericFirst[0].includes("新鲜"),
    genericFirst,
  );

  const placeOnly: Visit = { note: "服务很好，环境很舒服", dishes: [] };
  const placeOut = enforce(placeOnly, ["店员服务很热情", "这家真的值得一试", "店里坐着很舒服"]);
  check("invalid generic title 2 still gets the evidence fallback", placeOut[1] !== "这家真的值得一试" && placeOut[1].includes(store.mall), placeOut);
  check("fallback is not a 曼谷泰餐 splice", !KEYWORD_SPLICE.test(bare(placeOut[1])), placeOut);

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

  const routeCases: Array<{ id: string; visit: Visit; titles: Titles; caption: string[]; keep: string }> = [
    {
      id: "route natural titles",
      visit: { note: "粉红奶很好喝，环境很舒服", dishes: ["Mango Sticky Rice"], enjoyMost: ["刚刚翻新环境很好"] },
      titles: ["粉红奶甜度刚刚好", "芒果糯米饭软糯香甜", "店里坐着很舒服"],
      caption: ["粉红奶很好喝，甜度刚刚好。", "芒果糯米饭软糯香甜，店里坐着也很舒服。"],
      keep: "",
    },
    {
      id: "route second dish title",
      visit: { note: "粉红奶很好喝", dishes: ["Mango Sticky Rice", "Pineapple Fried Rice"] },
      titles: ["粉红奶甜度刚刚好", "菠萝炒饭值得推荐", "芒果糯米饭软糯香甜"],
      caption: ["粉红奶很好喝，甜度刚刚好。", "菠萝炒饭和芒果糯米饭也点了，吃得很满足。"],
      keep: "菠萝炒饭",
    },
  ];
  for (const testCase of routeCases) {
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
      mainTitle: "粉红奶很好喝",
      subTitle: "环境坐着很舒服",
      selectedPhotoIndex: 0,
      selectedPhotoIndexes: [0],
      photoSelectionReason: "",
      remainingPhotoOrder: [],
      remainingOrderPattern: "1",
    });
    modelCalls = 0;
    sink.delete("generation_diagnostics");
    const form = new FormData();
    form.append(
      "payload",
      JSON.stringify({
        branch: store.branch,
        campaignId: deployment,
        customerType: "",
        visitFrequency: "",
        enjoyMost: testCase.visit.enjoyMost ?? [],
        recommendedDishes: testCase.visit.dishes,
        recommendedDishOther: "",
        recommendTo: testCase.visit.recommendTo ?? [],
        diningExperienceNote: testCase.visit.note,
        photoCount: 1,
        contentType: "restaurant-recommendation",
        productName: "Baan Ying",
        variantIndex: 0,
        contentLanguage: "zh-CN",
        requiredLocationPlacement: "standalone",
        brandName: "Baan Ying",
        productCategory: "Thai Restaurant / Food & Dining",
        productDescription: "",
      }),
    );
    const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: form }));
    const body = (await response.json()) as { titles?: string[] };
    check(`${testCase.id}: status 200`, response.status === 200, body);
    check(`${testCase.id}: exactly one mocked ModelArk call`, modelCalls === 1, modelCalls);
    const record = (sink.get("generation_diagnostics") ?? []).at(-1) as
      | { stages?: Array<{ stage: string; before?: { titles?: string[] }; after?: { titles?: string[] } }> }
      | undefined;
    const stage = record?.stages?.find((item) => item.stage === "enforceCustomerEvidence");
    check(`${testCase.id}: enforceCustomerEvidence stage recorded`, Boolean(stage), record?.stages?.map((item) => item.stage));
    if (stage) {
      check(
        `${testCase.id}: enforceCustomerEvidence leaves the titles as they arrived`,
        JSON.stringify(stage.after?.titles) === JSON.stringify(stage.before?.titles),
        { before: stage.before?.titles, after: stage.after?.titles },
      );
    }
    const titles = body.titles ?? [];
    shapeChecks(testCase.id, titles);
    check(`${testCase.id}: no 曼谷泰餐 prefix spliced onto a final title`, titles.every((title) => !KEYWORD_SPLICE.test(bare(title))), titles);
    if (testCase.keep) check(`${testCase.id}: a final title still names ${testCase.keep}`, titles.some((title) => title.includes(testCase.keep)), titles);
  }

  process.stdout.write(`\n${RESULT_PREFIX}${JSON.stringify({ deployment, checks })}\n`);
}

function runStore(deployment: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ["MONGODB_URI", "DATABASE_URL", "MONGODB_DB_NAME", "OPENAI_API_KEY", "OPENAI_MODEL", "AI_PROVIDER", "MODELARK_MODEL"]) {
    delete env[key];
  }
  env.TITLE_KEYWORD_CHILD = "1";
  env.DEPLOYMENT_ID = deployment;
  env.NEXT_PUBLIC_DEPLOYMENT_ID = deployment;
  if (deployment !== "baan-ying-centralworld") env.MONGODB_DB_NAME = "title-keyword-test";
  env.MODELARK_API_KEY = "title-keyword-test-placeholder";
  env.GENERATION_DIAGNOSTICS = "1";
  const run = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = run.stdout.split("\n").find((row) => row.startsWith(RESULT_PREFIX));
  if (!line) throw new Error(`${deployment} produced no result:\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as { deployment: string; checks: Check[] };
}

async function main() {
  if (process.env.TITLE_KEYWORD_CHILD === "1") return runChild();
  let failed = 0;
  for (const deployment of Object.keys(STORES)) {
    const result = runStore(deployment);
    const failures = result.checks.filter((item) => !item.ok);
    failed += failures.length;
    console.log(`${result.deployment}: ${result.checks.length - failures.length}/${result.checks.length} checks passed`);
    for (const item of failures) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  if (failed > 0) process.exit(1);
  console.log("validate-title-keyword-postprocess: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
