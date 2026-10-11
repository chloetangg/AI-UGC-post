/**
 * Runs the real /api/generate route once per deployment with the same survey and the same model reply,
 * then requires both branches to send the same prompts and return the same post apart from their own mall facts.
 * ModelArk is mocked. Any other network call fails the run.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

type Spelling = "canonical" | "lowercase";

type Place = {
  deployment: string;
  branch: string;
  mall: string;
  mallZh: string;
  floor: string;
  floorEn: string;
  hours: string;
  mallPattern: RegExp;
  /** Facts that belong to the other branch and must never appear in this one's output. */
  foreign: RegExp;
};

const SPELLINGS: Record<Spelling, Record<string, string>> = {
  canonical: { "baan-ying-centralworld": "centralwOrld", "baan-ying-siam-center": "Siam Center" },
  lowercase: { "baan-ying-centralworld": "centralworld", "baan-ying-siam-center": "siam center" },
};

const PLACES: Record<string, Omit<Place, "mall">> = {
  "baan-ying-centralworld": {
    deployment: "baan-ying-centralworld",
    branch: "Baan Ying (centralwOrld, 3rd Floor)",
    mallZh: "尚泰世界购物中心",
    floor: "3楼",
    floorEn: "3rd Floor",
    hours: "10:00–22:00",
    mallPattern: /central\s*world/gi,
    foreign: /siam\s*center|暹罗中心|10:30–21:00|(?<![0-9０-９])2楼/i,
  },
  "baan-ying-siam-center": {
    deployment: "baan-ying-siam-center",
    branch: "Baan Ying (Siam Center, 2nd Floor)",
    mallZh: "暹罗中心",
    floor: "2楼",
    floorEn: "2nd Floor",
    hours: "10:30–21:00",
    mallPattern: /siam\s*center/gi,
    foreign: /central\s*world|尚泰世界|10:00–22:00|(?<![0-9０-９])3楼/i,
  },
};

function place(deployment: string, spelling: Spelling): Place {
  return { ...PLACES[deployment], mall: SPELLINGS[spelling][deployment] };
}

type Case = {
  id: string;
  placement: "inline" | "standalone";
  format?: "A" | "B" | "C" | "D" | "E";
  /** Dishes the model invented. They must not survive post-processing on either branch. */
  invented?: RegExp;
  extra?: (p: Place) => Record<string, unknown>;
  input: (p: Place) => {
    note: string;
    dishes: string[];
    enjoyMost: string[];
    recommendTo: string[];
  };
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

const CASES: Case[] = [
  {
    id: "mall-shopping-inline",
    placement: "inline",
    input: (p) => ({
      note: `朋友介绍来的，在${p.mall}逛完来吃饭很方便，店里环境很舒服，服务很好`,
      dishes: ["Pineapple Fried Rice", "Mango Sticky Rice"],
      enjoyMost: ["店员服务热情周到"],
      recommendTo: ["菠萝炒饭配料很足", "芒果糯米饭芒果很新鲜"],
    }),
    model: (p) => ({
      titles: ["朋友介绍来的泰餐", "菠萝炒饭配料很足", `${p.mall}逛完顺便吃的泰餐`],
      captionParagraphs: [
        `朋友介绍来的，在${p.mall}逛完来Baan Ying吃饭很方便。`,
        "菠萝炒饭配料很足，芒果糯米饭的芒果很新鲜。",
        "店里环境很舒服，服务员也很热情。",
        `刚好在${p.mall}，下次还会来。`,
      ],
      hashtags: tags(p),
      mainTitle: "朋友推荐的泰餐",
      subTitle: "菠萝炒饭配料很足",
    }),
  },
  {
    id: "no-mall-standalone-invented",
    placement: "standalone",
    format: "A",
    invented: /冬阴功/,
    input: () => ({
      note: "咖喱蟹肉很下饭，店员服务很热情",
      dishes: ["Crab Meat Curry"],
      enjoyMost: ["店员服务热情周到"],
      recommendTo: ["咖喱蟹肉很下饭"],
    }),
    model: (p) => ({
      titles: ["咖喱蟹肉超级下饭🦀", "店员服务真的很热情", "冬阴功汤也必点"],
      captionParagraphs: [
        "咖喱蟹肉很下饭，拌饭超香，不知不觉就多吃了半碗。",
        "冬阴功汤酸辣开胃，价格也很实惠。",
        "店员服务很热情。味道很正宗，吃起来就是很熟悉的泰式风味。",
        `📍 ${p.mallZh}（${p.mall}）${p.floor}`,
      ],
      hashtags: tags(p),
      mainTitle: "咖喱蟹肉太下饭了",
      subTitle: "店员服务很热情",
    }),
  },
  {
    id: "mall-title-without-note",
    placement: "inline",
    input: () => ({
      note: "这家店我比较喜欢，青咖喱牛肉分量很足",
      dishes: ["Green Curry Beef"],
      enjoyMost: ["店里氛围很舒服"],
      recommendTo: ["青咖喱牛肉分量很足"],
    }),
    model: (p) => ({
      titles: [`在${p.mall}吃泰餐`, "青咖喱牛肉分量很足", "店里氛围很舒服"],
      captionParagraphs: [
        "这家店我比较喜欢。",
        "青咖喱牛肉分量很足，店里氛围很舒服。",
        `这次在${p.mall}的Baan Ying吃了一顿饭。`,
      ],
      hashtags: tags(p),
      mainTitle: `${p.mall}这家泰餐`,
      subTitle: "青咖喱牛肉分量很足",
    }),
  },
  {
    id: "address-hours-in-body",
    placement: "standalone",
    format: "B",
    input: (p) => ({
      note: `在${p.mall}逛街累了进来吃饭，菠萝炒饭配料很足`,
      dishes: ["Pineapple Fried Rice"],
      enjoyMost: ["在购物商场里的泰餐连锁"],
      recommendTo: ["菠萝炒饭配料很足"],
    }),
    model: (p) => ({
      titles: ["逛街累了进来吃饭", "菠萝炒饭配料很足", `${p.mall}商场里的泰餐`],
      captionParagraphs: [
        `在${p.mall}逛街累了，进来Baan Ying吃饭。`,
        "菠萝炒饭配料很足。",
        `Baan Ying就在${p.mallZh}（${p.mall}）${p.floor}，营业时间是${p.hours}。`,
        `刚好在${p.mall}，整体用餐很舒服。`,
      ],
      hashtags: tags(p),
      mainTitle: "逛街累了吃泰餐",
      subTitle: "菠萝炒饭配料很足",
    }),
  },
  {
    id: "mall-convenience-ending",
    placement: "inline",
    input: (p) => ({
      note: `在${p.mall}逛完顺便吃，芒果糯米饭芒果很新鲜，服务员很热情`,
      dishes: ["Mango Sticky Rice", "Pineapple Fried Rice"],
      enjoyMost: ["店员服务热情周到", "在购物商场里的泰餐连锁"],
      recommendTo: ["芒果糯米饭芒果很新鲜"],
    }),
    model: (p) => ({
      titles: [`${p.mall}逛完顺便吃`, "芒果糯米饭芒果很新鲜🥭", "服务员很热情"],
      captionParagraphs: [
        `在${p.mall}逛完顺便来吃，Baan Ying位置很方便。`,
        "芒果糯米饭的芒果很新鲜，菠萝炒饭也点了。",
        "服务员很热情。",
        `这家店就在${p.mallZh}，商场里吃泰餐很方便，刚好在${p.mall}。`,
      ],
      hashtags: tags(p),
      mainTitle: `${p.mall}逛完吃泰餐`,
      subTitle: "芒果糯米饭芒果很新鲜",
    }),
  },
  {
    id: "chinese-mall-name-in-note",
    placement: "inline",
    input: (p) => ({
      note: `在${p.mallZh}逛街，顺便来吃，咖喱蟹肉很下饭`,
      dishes: ["Crab Meat Curry"],
      enjoyMost: ["在购物商场里的泰餐连锁"],
      recommendTo: ["咖喱蟹肉很下饭"],
    }),
    model: (p) => ({
      titles: [`${p.mallZh}逛街顺便吃`, "咖喱蟹肉很下饭🦀", "商场里的泰餐"],
      captionParagraphs: [
        `在${p.mallZh}逛街，顺便来Baan Ying吃饭。`,
        "咖喱蟹肉很下饭。",
        `${p.mall}商场里吃泰餐很方便。`,
      ],
      hashtags: tags(p),
      mainTitle: "逛街顺便吃泰餐",
      subTitle: "咖喱蟹肉很下饭",
    }),
  },
  {
    id: "invented-mall-ending",
    placement: "standalone",
    format: "C",
    input: () => ({
      note: "朋友推荐来吃的，服务员态度都很好",
      dishes: ["Pineapple Fried Rice"],
      enjoyMost: ["店员服务热情周到"],
      recommendTo: ["菠萝炒饭配料很足"],
    }),
    model: (p) => ({
      titles: ["朋友推荐来吃的泰餐", "菠萝炒饭配料很足", `${p.mall}的宝藏泰餐`],
      captionParagraphs: [
        "朋友推荐来吃的。",
        "菠萝炒饭配料很足，服务员态度都很好。",
        `刚好在${p.mall}，整体用餐很舒服。喜欢泰餐的快来${p.mall}试试吧！`,
      ],
      hashtags: tags(p),
      mainTitle: `${p.mall}宝藏泰餐`,
      subTitle: "服务员态度都很好",
    }),
  },
  {
    id: "regenerate-variant-1",
    placement: "inline",
    extra: (p) => ({
      variantIndex: 1,
      previousTitles: [`第一次来${p.mall}吃泰餐`, "芒果糯米饭很新鲜", "菠萝炒饭配料足"],
      previousCaption: `第一次来${p.mall}。芒果糯米饭很新鲜。`,
      previousLocationPlacement: "standalone",
      previousCoverTitle: `第一次来${p.mall} / 芒果很新鲜`,
    }),
    input: (p) => ({
      note: `第一次来${p.mall}，芒果糯米饭的芒果很新鲜，菠萝炒饭配料很足`,
      dishes: ["Mango Sticky Rice", "Pineapple Fried Rice"],
      enjoyMost: ["食物味道正宗美味"],
      recommendTo: ["芒果糯米饭芒果很新鲜", "菠萝炒饭配料很足"],
    }),
    model: (p) => ({
      titles: [`第一次来${p.mall}`, "芒果糯米饭的芒果很新鲜", "菠萝炒饭配料很足"],
      captionParagraphs: [
        `第一次来到${p.mall}，就在Baan Ying吃了一顿。`,
        "芒果糯米饭的芒果很新鲜，菠萝炒饭配料很足。",
        "味道很正宗，下次还会再来。",
      ],
      hashtags: tags(p),
      mainTitle: `第一次来${p.mall}`,
      subTitle: "芒果糯米饭的芒果很新鲜",
    }),
  },
];

const SEEDS = [20261011, 7];
const OUTPUT_FIELDS = [
  "titles",
  "caption",
  "hashtags",
  "coverTitle",
  "coverSubtitle",
  "locationPlacement",
  "locationFormat",
  "selectedTemplateId",
  "error",
] as const;

function canon(text: string, p: Place) {
  return (
    text
      .replace(new RegExp(p.mallPattern.source, "gi"), "<MALL>")
      .split(p.mallZh)
      .join("<MALL_ZH>")
      .split(p.floorEn)
      .join("<FLOOR_EN>")
      .replace(new RegExp(`(?<![0-9０-９])${p.floor}`, "g"), "<FLOOR>")
      .split(p.hours)
      .join("<HOURS>")
      // The marker is the first 8 characters of the note, so it ends at a different word when the mall name is longer.
      .replace(/customer-words: [^;\n]*/g, "customer-words: <WORDS>")
  );
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

type CaseResult = {
  id: string;
  status: number;
  body: Record<string, unknown>;
  modelArkCalls: Array<{ label: string; system: string; user: string }>;
  otherFetches: string[];
};

type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context: unknown) => unknown,
) => unknown;

async function runChild() {
  const spelling = (process.env.PARITY_SPELLING ?? "canonical") as Spelling;
  const p = place(process.env.DEPLOYMENT_ID ?? "", spelling);
  const stub = pathToFileURL(fileURLToPath(new URL("./stubs/next-headers.cjs", import.meta.url))).href;
  const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void };
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "next/headers") return { url: stub, shortCircuit: true, format: "commonjs" };
      return nextResolve(specifier, context);
    },
  });

  let current: CaseResult | null = null;
  let pendingModel: string | null = null;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    if (!target.includes("bytepluses.com/api/v3/responses")) {
      current?.otherFetches.push(target);
      throw new Error(`unexpected fetch ${target}`);
    }
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      input: Array<{ role: string; content: Array<{ type: string; text?: string }> }>;
      text?: { format?: { name?: string } };
    };
    const textOf = (role: string) =>
      body.input
        .filter((message) => message.role === role)
        .flatMap((message) => message.content.map((part) => part.text ?? ""))
        .join("\n");
    const label = body.text?.format?.name ?? "";
    current?.modelArkCalls.push({ label, system: textOf("system"), user: textOf("user") });
    const output = label === "xiaohongshu_ugc_post" ? pendingModel : null;
    if (!output) throw new Error(`unexpected ModelArk call ${label}`);
    return new Response(
      JSON.stringify({
        status: "completed",
        model: "parity-model",
        output: [{ type: "message", content: [{ type: "output_text", text: output }] }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  const { POST } = await import("../app/api/generate/route");
  const results: CaseResult[] = [];
  for (const seed of SEEDS) for (const testCase of CASES) {
    Math.random = mulberry32(seed);
    const bytes = mulberry32(seed ^ 0x5bd1e995);
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
      selectedPhotoIndex: 0,
      selectedPhotoIndexes: [0],
      photoSelectionReason: "",
      remainingPhotoOrder: [],
      remainingOrderPattern: "1",
    });
    current = { id: `${testCase.id}@${seed}`, status: 0, body: {}, modelArkCalls: [], otherFetches: [] };
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
      variantIndex: 0,
      contentLanguage: "zh-CN",
      requiredLocationPlacement: testCase.placement,
      requiredLocationFormat: testCase.format ?? "",
      brandName: "Baan Ying",
      productCategory: "Thai Restaurant / Food & Dining",
      productDescription: "",
      ...testCase.extra?.(p),
    };
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    const response = await POST(new Request("http://localhost/api/generate", { method: "POST", body: form }));
    current.status = response.status;
    current.body = (await response.json()) as Record<string, unknown>;
    results.push(current);
  }
  process.stdout.write(`\nPARITY_RESULT ${JSON.stringify(results)}\n`);
}

function runDeployment(deployment: string, spelling: Spelling): CaseResult[] {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of [
    "MONGODB_URI",
    "DATABASE_URL",
    "MONGODB_DB_NAME",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "AI_PROVIDER",
    "MODELARK_MODEL",
    "GENERATION_DIAGNOSTICS",
  ]) {
    delete env[key];
  }
  env.PARITY_CHILD = "1";
  env.PARITY_SPELLING = spelling;
  env.DEPLOYMENT_ID = deployment;
  env.NEXT_PUBLIC_DEPLOYMENT_ID = deployment;
  env.MODELARK_API_KEY = "parity-test-placeholder";
  const run = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = run.stdout.split("\n").find((row) => row.startsWith("PARITY_RESULT "));
  if (!line) throw new Error(`${deployment} produced no result:\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(line.slice("PARITY_RESULT ".length)) as CaseResult[];
}

function lineDiff(a: string, b: string, cw: Place, siam: Place) {
  const left = a.split("\n");
  const right = b.split("\n");
  const same = (x: string, y: string) => x === y || canon(x, cw) === canon(y, siam);
  const table = Array.from({ length: left.length + 1 }, () => new Array<number>(right.length + 1).fill(0));
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      table[i][j] = same(left[i], right[j]) ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && same(left[i], right[j])) {
      i += 1;
      j += 1;
    } else if (j < right.length && (i === left.length || table[i][j + 1] >= table[i + 1][j])) {
      out.push(`    siam+ ${right[j].slice(0, 200)}`);
      j += 1;
    } else {
      out.push(`    cw+   ${left[i].slice(0, 200)}`);
      i += 1;
    }
  }
  return out;
}

function postText(body: Record<string, unknown>) {
  return [
    ...((body.titles as string[] | undefined) ?? []),
    String(body.caption ?? ""),
    String(body.coverTitle ?? ""),
    String(body.coverSubtitle ?? ""),
    ...((body.hashtags as string[] | undefined) ?? []),
  ].join("\n");
}

function checkSpelling(spelling: Spelling, dump: Record<string, unknown>) {
  const cwPlace = place("baan-ying-centralworld", spelling);
  const siamPlace = place("baan-ying-siam-center", spelling);
  const cw = runDeployment(cwPlace.deployment, spelling);
  const siam = runDeployment(siamPlace.deployment, spelling);
  dump[spelling] = { cw, siam };
  const failures: string[] = [];
  const fail = (id: string, message: string) => failures.push(`[${spelling}] ${id}: ${message}`);

  if (cw.length !== siam.length) fail("run", `case count cw=${cw.length} siam=${siam.length}`);
  for (let i = 0; i < Math.min(cw.length, siam.length); i += 1) {
    const a = cw[i];
    const b = siam[i];
    const testCase = CASES[i % CASES.length];
    for (const [name, result, own] of [
      ["cw", a, cwPlace],
      ["siam", b, siamPlace],
    ] as const) {
      if (result.status !== 200) fail(a.id, `${name} status ${result.status} ${JSON.stringify(result.body.error ?? "")}`);
      if (result.otherFetches.length) fail(a.id, `${name} called ${result.otherFetches.join(", ")}`);
      if (result.modelArkCalls.length === 0) fail(a.id, `${name} made no ModelArk call`);
      const text = postText(result.body);
      const leaked = text.match(own.foreign);
      if (leaked) fail(a.id, `${name} output names the other branch: ${leaked[0]}`);
      if (testCase.invented && testCase.invented.test(text)) fail(a.id, `${name} kept an invented dish`);
    }
    const labels = (r: CaseResult) => r.modelArkCalls.map((call) => call.label).join(",");
    if (labels(a) !== labels(b)) fail(a.id, `ModelArk calls cw=[${labels(a)}] siam=[${labels(b)}]`);
    for (const [index, call] of a.modelArkCalls.entries()) {
      const other = b.modelArkCalls[index];
      if (!other) continue;
      const sys = lineDiff(call.system, other.system, cwPlace, siamPlace);
      const usr = lineDiff(call.user, other.user, cwPlace, siamPlace);
      if (sys.length) fail(a.id, `[${call.label}] system prompt differs:\n${sys.join("\n")}`);
      if (usr.length) fail(a.id, `[${call.label}] user prompt differs:\n${usr.join("\n")}`);
    }
    for (const field of OUTPUT_FIELDS) {
      const left = canon(JSON.stringify(a.body[field] ?? null), cwPlace);
      const right = canon(JSON.stringify(b.body[field] ?? null), siamPlace);
      if (left !== right) fail(a.id, `${field} differs\n    cw:   ${left}\n    siam: ${right}`);
    }
  }
  return { failures, runs: cw.length + siam.length };
}

function runParent() {
  const dump: Record<string, unknown> = {};
  const failures: string[] = [];
  let runs = 0;
  for (const spelling of ["canonical", "lowercase"] as const) {
    const result = checkSpelling(spelling, dump);
    failures.push(...result.failures);
    runs += result.runs;
  }
  if (process.env.PARITY_DUMP) writeFileSync(process.env.PARITY_DUMP, JSON.stringify(dump, null, 2));
  if (failures.length) {
    console.error(failures.join("\n"));
    console.error(`\nbranch parity: ${failures.length} failure(s) across ${runs} generations`);
    process.exit(1);
  }
  console.log(
    `branch parity: ok — ${runs} generations (${CASES.length} cases × ${SEEDS.length} seeds × 2 spellings × 2 branches), same prompts, same post-processing, ModelArk only`,
  );
}

if (process.env.PARITY_CHILD === "1") {
  runChild().catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  runParent();
}
