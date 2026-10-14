/**
 * Evidence priority: the customer's note > selected dishes and reasons > questionnaire tags.
 * Post-processing must not add a tag-only experience, reverse a stated opinion, or invent a taste.
 * Checks the helpers directly and the real /api/generate route (first generation and regeneration)
 * with a mocked ModelArk reply. Each store runs in its own child process. No real model request;
 * MongoDB is an in-memory stub.
 * Run: npx tsx scripts/validate-evidence-priority.ts
 */
import { spawnSync } from "node:child_process";
import * as nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const STORES: Record<string, { branch: string; mall: string }> = {
  "baan-ying-centralworld": { branch: "Baan Ying (centralwOrld, 3rd Floor)", mall: "centralwOrld" },
  "baan-ying-siam-center": { branch: "Baan Ying (Siam Center, 2nd Floor)", mall: "Siam Center" },
};
const RESULT_PREFIX = "EVIDENCE_PRIORITY_RESULT ";
const SEED = 20261013;
const INVENTED_TASTE = /很香|很满足|合口味|比预期|还想再点|记得住|很难不爱/;

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
  /** Phrases the final caption must still carry, because the model wrote them from the note. */
  keepInCaption: string[];
  /** Words that must not appear anywhere in the output unless the model reply or the note had them. */
  mustNotAdd: RegExp;
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

const ROUTE_CASES: RouteCase[] = [
  {
    id: "positive note + tags of another style",
    note: "芒果糯米饭甜度刚刚好，很喜欢",
    dishes: ["Mango Sticky Rice"],
    enjoyMost: ["店员服务热情周到", "餐厅风格有满满的家庭式温馨氛围"],
    recommendTo: ["Delicious"],
    titles: ["芒果糯米饭甜度刚刚好", "这道甜品我很喜欢", "饭后来一份芒果糯米饭"],
    caption: ["点了芒果糯米饭，甜度刚刚好，我很喜欢。"],
    main: "芒果糯米饭",
    sub: "甜度刚刚好很喜欢",
    keepInCaption: ["芒果糯米饭", "甜度刚刚好"],
    mustNotAdd: /服务|店员|温馨|舒服|放松|氛围/,
  },
  {
    id: "negative note + positive tags",
    note: "冬阴功对我来说太酸了，店里有点吵",
    dishes: ["River Prawn Tom Yum"],
    enjoyMost: ["食物味道正宗美味", "餐厅风格有满满的家庭式温馨氛围"],
    recommendTo: [],
    titles: ["冬阴功对我来说偏酸", "店里人多比较热闹", "这次点了冬阴功"],
    caption: ["这次点了冬阴功，对我来说偏酸了一点。", "店里人比较多，有点热闹。"],
    main: "冬阴功偏酸",
    sub: "店里人多比较热闹",
    keepInCaption: ["偏酸", "热闹"],
    mustNotAdd: /正宗|温馨|舒服|放松|很香|很满足|合口味|好吃/,
  },
  {
    id: "empty note, dishes and reasons only",
    note: "",
    dishes: ["Crab Meat Curry", "Mango Sticky Rice"],
    enjoyMost: [],
    recommendTo: ["Rich", "Satisfying"],
    titles: ["这次点了咖喱蟹肉", "芒果糯米饭也点了", "两道菜一起吃"],
    caption: ["这次点了咖喱蟹肉和芒果糯米饭。"],
    main: "咖喱蟹肉",
    sub: "还点了芒果糯米饭",
    keepInCaption: ["咖喱蟹肉"],
    mustNotAdd: new RegExp(`${INVENTED_TASTE.source}|服务|舒服|放松|温馨|第一次|朋友|家人`),
  },
  {
    id: "style tags without a matching experience",
    note: "",
    dishes: ["Pineapple Fried Rice"],
    enjoyMost: ["在购物商场里的泰餐连锁", "餐厅风格有满满的家庭式温馨氛围"],
    recommendTo: [],
    titles: ["这次点了菠萝炒饭", "商场里的一家泰餐", "菠萝炒饭端上来了"],
    caption: ["这次点了菠萝炒饭。", "店在商场里面。"],
    main: "菠萝炒饭",
    sub: "商场里的泰餐店",
    keepInCaption: ["菠萝炒饭"],
    mustNotAdd: /逛街|逛完|温馨|舒服|放松|很香|很满足/,
  },
  {
    id: "note names dishes without judging them",
    note: "这次点了冬阴功和咖喱蟹肉，和朋友一起来的",
    dishes: ["River Prawn Tom Yum", "Crab Meat Curry"],
    enjoyMost: [],
    recommendTo: [],
    titles: ["和朋友一起来吃泰餐", "点了冬阴功和咖喱蟹肉", "朋友约饭选了这家"],
    caption: ["这次和朋友一起来，点了冬阴功和咖喱蟹肉。"],
    main: "和朋友来吃泰餐",
    sub: "点了冬阴功和咖喱蟹肉",
    keepInCaption: ["朋友", "冬阴功"],
    mustNotAdd: new RegExp(`${INVENTED_TASTE.source}|好吃|下饭|入味|鲜甜|浓郁`),
  },
  {
    id: "stated opinion vs a contrary service tag",
    note: "服务有点慢，不过菠萝炒饭配料很足",
    dishes: ["Pineapple Fried Rice"],
    enjoyMost: ["店员服务热情周到"],
    recommendTo: [],
    titles: ["菠萝炒饭配料很足", "上菜稍微慢了一点", "这盘菠萝炒饭分量很实在"],
    caption: ["菠萝炒饭配料很足。", "上菜稍微慢了一点。"],
    main: "菠萝炒饭配料足",
    sub: "上菜稍微慢一点",
    keepInCaption: ["配料很足", "慢了一点"],
    mustNotAdd: /服务很|服务真|服务也|服务到位|热情|周到/,
  },
];

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
  const { collectCustomerEvidence, enforceCustomerEvidence } = await import("../lib/customer-evidence");
  const { evidenceFactsForCopy } = await import("../lib/content-evidence");
  const { distillCustomerHook, separateHeadlinesFromNote } = await import("../lib/title-insight");
  const { separateOverlappingHeadlines } = await import("../lib/headline-overlap");
  const { isNegativeClause, negativeNoteAspects } = await import("../lib/evidence-priority");

  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) =>
    checks.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });
  check("process loaded this store's deployment", getDeploymentConfig().deploymentId === deployment, getDeploymentConfig().deploymentId);

  for (const text of ["冬阴功不好吃", "服务不太好", "环境不舒服", "冬阴功太酸了", "店里有点吵", "服务有点慢", "上菜很慢", "味道一般"]) {
    check(`negative clause detected: ${text}`, isNegativeClause(text));
  }
  for (const text of ["芒果糯米饭甜度刚刚好", "不会太甜", "坐着不觉得挤", "很适合慢慢吃", "服务很好", "味道不错", "菠萝炒饭配料很足"]) {
    check(`positive clause not flagged: ${text}`, !isNegativeClause(text));
  }
  const aspects = negativeNoteAspects("冬阴功对我来说太酸了，店里有点吵，服务有点慢");
  check("negative aspects: food, atmosphere, service", aspects.has("food") && aspects.has("atmosphere") && aspects.has("service"), [...aspects]);

  const negativeNote = "冬阴功不好吃，服务不太好，环境不舒服";
  const pool = collectCustomerEvidence({ note: negativeNote, dishes: ["River Prawn Tom Yum"], branch: store.branch }).customer;
  check("negative clauses do not enter the customer pool", pool.length === 0, pool.map((point) => point.titleHook));
  const enforced = enforceCustomerEvidence({
    titles: ["这次点了河虾冬阴功汤", "店里人比较多", "Baan Ying这顿泰餐"],
    caption: "这次来Baan Ying吃饭。点了一份汤。",
    coverTitle: "这顿泰餐",
    coverSubtitle: "点了一份汤",
    note: negativeNote,
    dishes: ["River Prawn Tom Yum"],
    enjoyMost: ["店员服务热情周到"],
    branch: store.branch,
  });
  const enforcedText = [...enforced.titles, enforced.caption, enforced.coverTitle, enforced.coverSubtitle].join(" ");
  check(
    "enforceCustomerEvidence does not reverse a negative note into praise",
    !/真的很好吃|服务真的很好|环境很舒服|热情周到/.test(enforcedText),
    enforcedText,
  );
  check("enforceCustomerEvidence does not paste the raw complaint", !/不好吃|不太好|不舒服/.test(enforced.caption), enforced.caption);

  const positivePool = collectCustomerEvidence({ note: "芒果糯米饭的芒果很新鲜，服务也很热情", dishes: ["Mango Sticky Rice"], branch: store.branch }).customer;
  check(
    "a positive note still fills the customer pool",
    positivePool.some((point) => point.category === "CUSTOMER_FOOD") && positivePool.some((point) => point.category === "CUSTOMER_SERVICE"),
    positivePool.map((point) => point.category),
  );

  for (const clause of ["冬阴功太酸了", "这次点了冬阴功和咖喱蟹肉"]) {
    const hook = distillCustomerHook(clause, 0);
    check(`distillCustomerHook adds no evaluation to "${clause}"`, !/记得住|好吃|很香|很满足/.test(hook), hook);
  }

  const separated = separateHeadlinesFromNote({
    titles: ["菠萝炒饭配料很足", "上菜稍微慢了一点", "这盘菠萝炒饭分量很实在"],
    coverTitle: "菠萝炒饭配料很足",
    coverSubtitle: "上菜稍微慢一点",
    note: "服务有点慢，不过菠萝炒饭配料很足",
  });
  check("separateHeadlinesFromNote never puts the raw complaint on the cover", !/服务有点慢/.test(separated.coverTitle), separated);
  check("separateHeadlinesFromNote keeps the clause's own point", /菠萝炒饭|配料/.test(separated.coverTitle), separated);

  const overlap = separateOverlappingHeadlines({
    titles: ["菠萝炒饭配料足", "上菜稍微慢了一点", "这盘菠萝炒饭分量很实在"],
    coverTitle: "菠萝炒饭配料足",
    coverSubtitle: "上菜稍微慢一点",
    note: "服务有点慢，不过菠萝炒饭配料很足",
    enjoyMost: ["店员服务热情周到"],
  });
  check(
    "separateOverlappingHeadlines takes neither the raw complaint nor the contradicted tag",
    !/服务有点慢|热情周到/.test(`${overlap.coverTitle}${overlap.coverSubtitle}`),
    overlap,
  );

  const contradicted = evidenceFactsForCopy({
    diningNote: "冬阴功对我来说太酸了，店里有点吵，服务有点慢",
    dishes: ["River Prawn Tom Yum"],
    enjoyMost: ["食物味道正宗美味", "餐厅风格有满满的家庭式温馨氛围", "店员服务热情周到"],
    branch: store.branch,
  });
  check(
    "copy facts drop tags the note contradicts",
    !contradicted.some((fact) => ["authentic-taste", "comfortable", "good-service"].includes(fact.id)),
    contradicted.map((fact) => fact.id),
  );
  check(
    "copy facts never turn a negative clause into a hook",
    !contradicted.some((fact) => fact.id === "customer-words" && isNegativeClause(fact.captionLine)),
    contradicted.map((fact) => fact.captionLine),
  );
  const ranked = evidenceFactsForCopy({
    diningNote: "老板很帅，服务很好",
    dishes: ["Crab Meat Curry"],
    enjoyMost: ["餐厅风格有满满的家庭式温馨氛围"],
    branch: store.branch,
  });
  const rank = { note: 0, selection: 1, tag: 2 } as const;
  check(
    "copy facts rank note, then selected dish, then tag",
    ranked.every((fact, index) => index === 0 || rank[ranked[index - 1].source ?? "tag"] <= rank[fact.source ?? "tag"]) &&
      ranked[0]?.source === "note",
    ranked.map((fact) => `${fact.id}:${fact.source}`),
  );
  const dishOnly = ranked.find((fact) => fact.id === "featured-dish");
  check(
    "a selected dish carries no invented taste",
    Boolean(dishOnly) && ![...(dishOnly?.titleHooks ?? []), ...(dishOnly?.coverSubs ?? []), dishOnly?.captionLine ?? ""].some((line) => INVENTED_TASTE.test(line)),
    dishOnly,
  );
  const tagOnly = ranked.find((fact) => fact.id === "comfortable");
  check(
    "a tag is restated, not turned into a feeling",
    Boolean(tagOnly) && !/放松|坐着很舒服/.test([...(tagOnly?.titleHooks ?? []), ...(tagOnly?.coverSubs ?? []), tagOnly?.captionLine ?? ""].join(" ")),
    tagOnly,
  );

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
    for (const regenerate of [false, true]) {
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
                previousCoverTitle: `${testCase.main} / ${testCase.sub}`,
              }
            : {}),
        }),
      );
      const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: form }));
      const body = (await response.json()) as { titles?: string[]; caption?: string; coverTitle?: string; coverSubtitle?: string };
      check(`${label}: status 200`, response.status === 200, body);
      check(`${label}: exactly one mocked ModelArk call`, modelCalls === 1, modelCalls);
      const caption = body.caption ?? "";
      const output = [...(body.titles ?? []), caption, body.coverTitle ?? "", body.coverSubtitle ?? ""].join(" ");
      const given = [testCase.note, ...testCase.titles, ...testCase.caption, testCase.main, testCase.sub].join(" ");
      const added = [...new Set(output.match(new RegExp(testCase.mustNotAdd.source, "g")) ?? [])].filter((word) => !given.includes(word));
      check(`${label}: nothing added from tags or invented`, added.length === 0, { added, output });
      const cover = `${body.coverTitle ?? ""}${body.coverSubtitle ?? ""}`;
      const rawComplaints = testCase.note.split(/[，,。]/).filter((clause) => clause && isNegativeClause(clause));
      check(`${label}: no raw complaint on the cover`, rawComplaints.every((clause) => !cover.includes(clause)), { rawComplaints, cover });
      if (testCase.note) {
        check(
          `${label}: caption keeps the customer's own points`,
          testCase.keepInCaption.every((phrase) => caption.includes(phrase)),
          { keep: testCase.keepInCaption, caption },
        );
      } else {
        check(`${label}: caption still names a selected dish`, testCase.keepInCaption.some((phrase) => output.includes(phrase)), output);
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
  env.EVIDENCE_PRIORITY_CHILD = "1";
  env.DEPLOYMENT_ID = deployment;
  env.NEXT_PUBLIC_DEPLOYMENT_ID = deployment;
  if (deployment !== "baan-ying-centralworld") env.MONGODB_DB_NAME = "evidence-priority-test";
  env.MODELARK_API_KEY = "evidence-priority-test-placeholder";
  const run = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = run.stdout.split("\n").find((row) => row.startsWith(RESULT_PREFIX));
  if (!line) throw new Error(`${deployment} produced no result:\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as { deployment: string; checks: Check[] };
}

async function main() {
  if (process.env.EVIDENCE_PRIORITY_CHILD === "1") return runChild();
  let failed = 0;
  for (const deployment of Object.keys(STORES)) {
    const result = runStore(deployment);
    const failures = result.checks.filter((item) => !item.ok);
    failed += failures.length;
    console.log(`${result.deployment}: ${result.checks.length - failures.length}/${result.checks.length} checks passed`);
    for (const item of failures) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  if (failed > 0) process.exit(1);
  console.log("validate-evidence-priority: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
