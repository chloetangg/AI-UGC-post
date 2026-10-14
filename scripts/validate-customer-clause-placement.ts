/**
 * A note clause around the mall name (就在{mall}上班) that the model already told in its own words
 * (上班就在附近) is not tacked onto the caption again by generation variation. Part 1 drives
 * ensureGenerationVariation directly, including the cases it must still fill in; part 2 runs the local-long
 * case through the real /api/generate route with a mocked ModelArk reply. Each store runs in its own child process.
 * No real model request; MongoDB is an in-memory stub.
 * Run: npx tsx scripts/validate-customer-clause-placement.ts
 */
import { spawnSync } from "node:child_process";
import * as nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { GenerationMemory } from "../lib/generation-variation";

const STORES: Record<string, { branch: string; mall: string }> = {
  "baan-ying-centralworld": { branch: "Baan Ying (centralwOrld, 3rd Floor)", mall: "centralwOrld" },
  "baan-ying-siam-center": { branch: "Baan Ying (Siam Center, 2nd Floor)", mall: "Siam Center" },
};
const RESULT_PREFIX = "CUSTOMER_CLAUSE_RESULT ";
const SEED = 20261011;

type Check = { name: string; ok: boolean; detail?: string };
type ResolveHook = (specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) => unknown;

const note = (mall: string) => `就在${mall}上班，经常来，冬阴功汤很开胃，菠萝炒饭配料很足，店员很热情`;
const MODEL_PARAGRAPHS = [
  "上班就在附近，午饭经常来。",
  "冬阴功汤很开胃，酸辣刚好🍤 菠萝炒饭配料很足，一份吃得很饱。",
  "店员一直都很热情，坐着也舒服。下次还是点这两样。",
];
const MODEL_CAPTION = MODEL_PARAGRAPHS.join("\n\n");
/** A note clause, the model's opening sentence, and whether variation must still fill the clause in. */
const CLAUSE_CASES: Array<{ id: string; clause: (mall: string) => string; opening: string; appended: boolean }> = [
  { id: "original", clause: (mall) => `就在${mall}上班`, opening: "上班就在附近，午饭经常来。", appended: false },
  { id: "reordered", clause: (mall) => `就在${mall}上班`, opening: "我就在这附近上班，午饭常来。", appended: false },
  { id: "words in two comma clauses", clause: (mall) => `就在${mall}上班`, opening: "就在附近转了转，明天还要上班。", appended: true },
  { id: "words in two sentences", clause: (mall) => `就在${mall}上班`, opening: "就在附近转了转。明天还要上班。", appended: true },
  { id: "half the words", clause: (mall) => `就在${mall}上班`, opening: "就在附近，午饭经常来。", appended: true },
  { id: "short common word", clause: (mall) => `从${mall}出来`, opening: "冬阴功汤吃得出来很用心。", appended: true },
  { id: "restaurant name, long enough", clause: () => "Baan Ying一直很稳", opening: "这家一直很稳，午饭经常来。", appended: false },
];

const MEMORY = {
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
  humanStyle: "local",
} as unknown as GenerationMemory;

const story = (caption: string) =>
  caption
    .split("\n")
    .filter((row) => !/^\s*(?:📍|⏰)/u.test(row))
    .join("\n")
    .trim();
const paragraphsOf = (text: string) => story(text).split(/\n\n+/).filter((block) => block.trim());
const keyOf = (text: string) => text.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "");
const sentenceKeys = (text: string) =>
  story(text)
    .split(/[。！？!?\n]|\p{Extended_Pictographic}\uFE0F?\s*/u)
    .map(keyOf)
    .filter((part) => part.length >= 2);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const placeClause = (mall: string) => new RegExp(`就在${escapeRegExp(mall)}上班`, "i");
const countOf = (text: string, pattern: RegExp) => (text.match(new RegExp(pattern.source, "gi")) ?? []).length;

/** Where each model sentence sits in the result: one result sentence holding it, or -1 when missing or ambiguous. */
function placements(model: string, result: string) {
  const resultKeys = sentenceKeys(result);
  return sentenceKeys(model).map((key) => {
    const hits = resultKeys.flatMap((candidate, index) => (candidate.includes(key) ? [index] : []));
    return hits.length === 1 ? (hits[0] ?? -1) : -1;
  });
}

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
  const { ensureGenerationVariation, planGenerationVariation } = await import("../lib/generation-variation");
  const { evidenceFactsForCopy } = await import("../lib/content-evidence");

  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) =>
    checks.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });
  check("process loaded this store's deployment", getDeploymentConfig().deploymentId === deployment, getDeploymentConfig().deploymentId);

  const clause = placeClause(store.mall);
  const context = {
    branch: store.branch,
    diningNote: note(store.mall),
    dishes: ["Tom Yum Goong", "Pineapple Fried Rice"],
    enjoyMost: ["店员服务热情周到"],
    recommendTo: ["冬阴功汤很开胃"],
    variantIndex: 1,
    customerType: "",
    visitFrequency: "",
  };
  const plan = planGenerationVariation({ context, variantIndex: 1, previousMemories: [MEMORY] });
  const vary = (caption: string) =>
    ensureGenerationVariation({
      titles: ["上班附近常来的一家", "冬阴功汤很开胃", "店员一直都很热情"],
      caption,
      coverTitle: "上班附近常来",
      coverSubtitle: "冬阴功汤很开胃",
      plan,
      context,
      previousMemories: [MEMORY],
      variantIndex: 1,
    }).caption;

  // Part 1: generation variation on its own.
  const told = vary(MODEL_CAPTION);
  check("variation: the clause the model already told is not appended", !clause.test(told), told);
  const toldAt = placements(MODEL_CAPTION, told);
  check(
    "variation: every model sentence kept once, in order",
    toldAt.every((at, index) => at >= 0 && (index === 0 || at > (toldAt[index - 1] ?? -1))),
    { toldAt, told },
  );
  check("variation: model paragraphs kept", paragraphsOf(told).length === MODEL_PARAGRAPHS.length, told);

  const untold = MODEL_CAPTION.replace("上班就在附近，午饭经常来。", "午饭经常来这家。");
  const filled = vary(untold);
  check("variation: a clause the model never told is still filled in, once", countOf(filled, clause) === 1, filled);

  const halfTold = MODEL_CAPTION.replace("上班就在附近，午饭经常来。", "就在附近，午饭经常来。");
  const halfFilled = vary(halfTold);
  check("variation: a sentence holding only part of the clause does not count as told", countOf(halfFilled, clause) === 1, halfFilled);

  const outcomes: Record<string, boolean> = {};
  for (const item of CLAUSE_CASES) {
    const head = item.clause(store.mall);
    const caseContext = { ...context, diningNote: `${head}，经常来，冬阴功汤很开胃，菠萝炒饭配料很足，店员很热情` };
    const hook = evidenceFactsForCopy(caseContext).find((fact) => fact.id === "customer-words")?.captionLine ?? "";
    check(`${item.id}: the note clause is the customer-words fact`, hook === `${head}。`, hook);
    const casePlan = planGenerationVariation({ context: caseContext, variantIndex: 1, previousMemories: [MEMORY] });
    check(`${item.id}: the plan picks the customer-words fact`, casePlan.selectedFactIds.includes("customer-words"), casePlan.selectedFactIds);
    const model = MODEL_CAPTION.replace(MODEL_PARAGRAPHS[0] ?? "", item.opening);
    const out = ensureGenerationVariation({
      titles: ["上班附近常来的一家", "冬阴功汤很开胃", "店员一直都很热情"],
      caption: model,
      coverTitle: "上班附近常来",
      coverSubtitle: "冬阴功汤很开胃",
      plan: casePlan,
      context: caseContext,
      previousMemories: [MEMORY],
      variantIndex: 1,
    }).caption;
    const times = out.split(head).length - 1;
    outcomes[item.id] = times > 0;
    check(
      `${item.id}: ${item.appended ? "filled in once" : "not filled in"}`,
      times === (item.appended ? 1 : 0),
      out,
    );
    const at = placements(model, out);
    check(
      `${item.id}: every model sentence kept once, in order`,
      at.every((index, position) => index >= 0 && (position === 0 || index > (at[position - 1] ?? -1))),
      { at, out },
    );
    check(`${item.id}: model paragraphs kept`, paragraphsOf(out).length === MODEL_PARAGRAPHS.length, out);
  }

  // Part 2: the real route.
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
    titles: ["上班附近常来的一家", "冬阴功汤很开胃", "店员一直都很热情"],
    captionParagraphs: MODEL_PARAGRAPHS,
    hashtags: ["#BaanYing曼谷", `#${mallTag}泰餐`, "#曼谷美食", "#泰国美食", `#曼谷${mallTag}`],
    mainTitle: "上班附近常来",
    subTitle: "冬阴功汤很开胃",
    selectedPhotoIndex: 0,
    selectedPhotoIndexes: [0],
    photoSelectionReason: "",
    remainingPhotoOrder: [],
    remainingOrderPattern: "1",
  });
  const form = new FormData();
  form.append(
    "payload",
    JSON.stringify({
      branch: store.branch,
      campaignId: deployment,
      customerType: "",
      visitFrequency: "",
      enjoyMost: context.enjoyMost,
      recommendedDishes: context.dishes,
      recommendedDishOther: "",
      recommendTo: context.recommendTo,
      diningExperienceNote: note(store.mall),
      photoCount: 1,
      contentType: "restaurant-recommendation",
      productName: "Baan Ying",
      variantIndex: 1,
      previousGenerationMemories: [MEMORY],
      contentLanguage: "zh-CN",
      requiredLocationPlacement: "inline",
      requiredLocationFormat: "",
      brandName: "Baan Ying",
      productCategory: "Thai Restaurant / Food & Dining",
      productDescription: "",
    }),
  );
  const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: form }));
  const body = (await response.json()) as { caption?: string };
  check("route: status 200", response.status === 200, body);
  const record = (sink.get("generation_diagnostics") ?? []).at(-1) as
    | { stages?: Array<{ stage: string; after?: { caption?: string } }> }
    | undefined;
  const stageCaption = (name: string) => (record?.stages ?? []).find((stage) => stage.stage === name)?.after?.caption ?? "";
  for (const stage of ["ensureGenerationVariation", "ensureContentLock", "enforceCustomerEvidence"]) {
    const caption = stageCaption(stage);
    check(`route: ${stage} recorded`, Boolean(caption), record?.stages?.map((item) => item.stage));
    check(`route: ${stage} adds no 就在${store.mall}上班`, !clause.test(caption), caption);
  }

  const finalCaption = story(body.caption ?? "");
  const finalKeys = sentenceKeys(finalCaption);
  check("route: final caption does not end with the clause", !/就在[^。！？]*上班[。！？]?$/.test(finalCaption), finalCaption);
  check("route: final caption has the clause nowhere", !clause.test(finalCaption), finalCaption);
  const at = placements(MODEL_CAPTION, finalCaption);
  check("route: every model sentence is in the final caption exactly once", at.every((index) => index >= 0), { at, finalCaption });
  check(
    "route: model sentences keep their order",
    at.every((index, position) => position === 0 || index > (at[position - 1] ?? -1)),
    { at, finalCaption },
  );
  check("route: no sentence added or dropped", finalKeys.length === sentenceKeys(MODEL_CAPTION).length, { finalKeys });
  const finalParagraphs = paragraphsOf(finalCaption);
  check("route: model paragraph count kept", finalParagraphs.length === MODEL_PARAGRAPHS.length, finalCaption);
  check(
    "route: each model paragraph stays in its own paragraph",
    MODEL_PARAGRAPHS.every((paragraph, index) =>
      sentenceKeys(paragraph).every((key) => keyOf(finalParagraphs[index] ?? "").includes(key)),
    ),
    finalParagraphs,
  );
  check(
    "route: the work-nearby fact is still told in the opening",
    /上班/.test(finalParagraphs[0] ?? "") && /就在/.test(finalParagraphs[0] ?? ""),
    finalParagraphs[0],
  );
  check(
    "route: the mall is still named",
    finalCaption.toLowerCase().includes(store.mall.toLowerCase()),
    finalCaption,
  );

  process.stdout.write(`\n${RESULT_PREFIX}${JSON.stringify({ deployment, checks, finalCaption, outcomes })}\n`);
}

function runStore(deployment: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ["MONGODB_URI", "DATABASE_URL", "MONGODB_DB_NAME", "OPENAI_API_KEY", "OPENAI_MODEL", "AI_PROVIDER", "MODELARK_MODEL"]) {
    delete env[key];
  }
  env.CUSTOMER_CLAUSE_CHILD = "1";
  env.GENERATION_DIAGNOSTICS = "1";
  env.DEPLOYMENT_ID = deployment;
  env.NEXT_PUBLIC_DEPLOYMENT_ID = deployment;
  if (deployment !== "baan-ying-centralworld") env.MONGODB_DB_NAME = "customer-clause-test";
  env.MODELARK_API_KEY = "customer-clause-test-placeholder";
  const run = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = run.stdout.split("\n").find((row) => row.startsWith(RESULT_PREFIX));
  if (!line) throw new Error(`${deployment} produced no result:\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as {
    deployment: string;
    checks: Check[];
    finalCaption: string;
    outcomes: Record<string, boolean>;
  };
}

async function main() {
  if (process.env.CUSTOMER_CLAUSE_CHILD === "1") return runChild();
  let failed = 0;
  const results = Object.keys(STORES).map(runStore);
  for (const result of results) {
    const failures = result.checks.filter((item) => !item.ok);
    failed += failures.length;
    console.log(`${result.deployment}: ${result.checks.length - failures.length}/${result.checks.length} checks passed`);
    console.log(`  final caption: ${JSON.stringify(result.finalCaption)}`);
    console.log(`  filled in: ${JSON.stringify(result.outcomes)}`);
    for (const item of failures) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  const [first, ...rest] = results;
  const mismatched = rest.filter((result) => JSON.stringify(result.outcomes) !== JSON.stringify(first?.outcomes));
  if (mismatched.length > 0) {
    failed += mismatched.length;
    console.log(`  FAIL stores disagree on which clauses are filled in: ${mismatched.map((result) => result.deployment).join(", ")}`);
  }
  if (failed > 0) process.exit(1);
  console.log("validate-customer-clause-placement: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
