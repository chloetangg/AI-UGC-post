/**
 * Checks that the /api/generate prompts rank evidence the same way for OpenAI and ModelArk:
 * the customer's note first, then the dishes and reasons they selected, then questionnaire tags.
 * A tag never speaks over the note, a complaint is never turned into the hero, and a selected
 * dish is not a taste review. Builds prompts only: no model request, no database.
 * Each store runs in its own child process, because a process loads exactly one deployment.
 * Run: npx tsx scripts/validate-prompt-evidence-priority.ts
 * PRINT_PROMPT_HASHES=1 prints the ModelArk prompt hashes for the negative-feedback fixtures.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const STORES = {
  "baan-ying-centralworld": "Baan Ying (centralwOrld, 3rd Floor)",
  "baan-ying-siam-center": "Baan Ying (Siam Center, 2nd Floor)",
} as const;
type StoreId = keyof typeof STORES;

const RESULT_PREFIX = "PROMPT_EVIDENCE_RESULT ";
const PROVIDERS = ["openai", "modelark"] as const;

type Check = { name: string; ok: boolean; detail?: string };
type ChildResult = { deployment: string; checks: Check[]; hashes: Record<string, string> };
type Answers = { note: string; dishes?: string[]; enjoyMost?: string[]; recommendTo?: string[] };

type Case = {
  label: string;
  answers: Answers;
  /** Fact ids or dish names the note itself supports; the plan must lead with one of them. */
  noteLed?: string[];
  primaryContent?: RegExp;
  primaryExperience?: RegExp;
  /** Text that must not appear in the evidence blocks derived from the answers. */
  absent?: RegExp;
};

const CASES: Case[] = [
  {
    label: "positive note over a dish and an unrelated tag",
    answers: { note: "老板很帅，服务很好", dishes: ["Crab Meat Curry"], enjoyMost: ["食物味道正宗美味"], recommendTo: [] },
    noteLed: ["handsome-owner", "good-service"],
    primaryContent: /^老板很帅$/,
    primaryExperience: /^(handsome-owner|good-service) /,
  },
  {
    label: "positive service note over a food tag",
    answers: { note: "服务很好", dishes: ["Mango Sticky Rice"], enjoyMost: ["食物味道正宗美味"], recommendTo: [] },
    noteLed: ["good-service"],
    primaryContent: /^服务很好$/,
    primaryExperience: /^good-service /,
  },
  {
    label: "negative service note against a service tag",
    answers: { note: "服务有点慢，不过菠萝炒饭配料很足", dishes: ["Pineapple Fried Rice"], enjoyMost: ["店员服务热情周到"], recommendTo: [] },
    noteLed: ["菠萝炒饭", "customer-words"],
    primaryContent: /^菠萝炒饭$/,
    absent: /good-service|热情|周到|服务或老板/,
  },
  {
    label: "negative dish note against a food tag",
    answers: { note: "价格有点贵，冬阴功一般，服务很好", dishes: ["Mango Sticky Rice", "River Prawn Tom Yum"], enjoyMost: ["食物味道正宗美味"], recommendTo: [] },
    noteLed: ["good-service"],
    primaryContent: /^服务很好$/,
    absent: /authentic-taste|正宗/,
  },
  {
    label: "negative atmosphere note against an atmosphere tag",
    answers: { note: "环境有点吵，芒果糯米饭很好吃", dishes: ["Mango Sticky Rice"], enjoyMost: ["餐厅风格有满满的家庭式温馨氛围"], recommendTo: [] },
    noteLed: ["芒果糯米饭", "featured-dish", "customer-words"],
    primaryContent: /^芒果糯米饭$/,
    absent: /comfortable|温馨|环境舒适/,
  },
  {
    label: "complained dish is never the hero",
    answers: { note: "冬阴功一般", dishes: ["River Prawn Tom Yum", "Mango Sticky Rice"], enjoyMost: [], recommendTo: [] },
    primaryContent: /^(?!.*冬阴功)/,
  },
  {
    label: "selected dishes only",
    answers: { note: "", dishes: ["Crab Meat Curry", "Mango Sticky Rice"], enjoyMost: [], recommendTo: [] },
    absent: /真香|必吃|好吃|customer-words/,
  },
  {
    label: "tags only",
    answers: { note: "", dishes: [], enjoyMost: ["店员服务热情周到", "餐厅风格有满满的家庭式温馨氛围"], recommendTo: [] },
    absent: /customer-words|吃得很舒服|圈粉|服务真的很好/,
  },
];

const HEADERS = {
  allowed: "ALLOWED TITLE MATERIAL THIS VISIT: ",
  primaryExperience: "PRIMARY EXPERIENCE: ",
  secondaryExperience: "SECONDARY EXPERIENCE: ",
  foodAngle: "FOOD / DISH ANGLE: ",
  primaryContent: "Primary Content: ",
  supporting: "Supporting Content: ",
  strongest: "strongestExperience: ",
  favoriteDish: "favoriteDish: ",
  enjoyed: "enjoyedMost: ",
  atmosphere: "atmosphere: ",
  service: "service: ",
  customerWords: "customerWords (Tier 1, keep the core meaning): ",
  priority: "THIS ROUND INFORMATION PRIORITY (describe these 2–5 only; skip the rest): ",
} as const;

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

function field(prompt: string, header: string) {
  const line = prompt.split("\n").find((row) => row.startsWith(header));
  return line === undefined ? undefined : line.slice(header.length).trim();
}

function factGroups(prompt: string) {
  const lines = prompt.split("\n");
  const start = lines.findIndex((row) => row.startsWith("THIS ROUND FACT GROUPS"));
  if (start < 0) return undefined;
  const out: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const row = lines[index]!;
    if (row.startsWith("GROUP ") || row.startsWith("- ")) out.push(row);
    else if (row.trim() === "" && lines[index + 1]?.startsWith("GROUP ")) continue;
    else break;
  }
  return out.join("\n");
}

async function runChild(): Promise<ChildResult> {
  const deployment = process.env.DEPLOYMENT_ID as StoreId;
  const branch = STORES[deployment];
  if (!branch) throw new Error(`Unknown store ${deployment}`);
  const { getDeploymentConfig } = await import("../lib/deployment/config");
  const { buildSystemPrompt, buildUserPrompt } = await import("../lib/generate-prompt");
  const { pickBrandSpelling } = await import("../lib/brand-spelling");
  const { resolveGenerationContext } = await import("../lib/generation/context");
  const { planLocationTime } = await import("../lib/locations");
  const { BAAN_YING_BRAND_CONTEXT } = await import("../lib/brand/baan-ying-context");
  const { BAAN_YING_CONTENT_STRATEGY } = await import("../lib/brand/baan-ying-strategy");
  type Body = Parameters<typeof buildUserPrompt>[0];
  type Provider = Parameters<typeof buildUserPrompt>[2];

  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) =>
    checks.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });

  function payload(answers: Answers): Body {
    const body = {
      branch,
      customerType: "Tourist",
      visitFrequency: "1st time",
      totalMealExpense: 900,
      mealExpenseRange: "฿800-1,000",
      enjoyMost: answers.enjoyMost ?? ["食物味道正宗美味"],
      enjoyMostOther: "",
      recommendedDishes: answers.dishes ?? ["Mango Sticky Rice", "River Prawn Tom Yum"],
      recommendedDishOther: "",
      recommendTo: answers.recommendTo ?? ["Delicious", "Fresh"],
      recommendToOther: "",
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
    return buildSystemPrompt(BAAN_YING_CONTENT_STRATEGY, BAAN_YING_BRAND_CONTEXT, branch, provider);
  }

  function userFor(answers: Answers, provider: Provider) {
    const body = payload(answers);
    const context = resolveGenerationContext({ branch: body.branch });
    Math.random = seeded(7);
    return buildUserPrompt(body, pickBrandSpelling(context.branch), provider);
  }

  const loaded = getDeploymentConfig();
  check("process loaded this store's deployment", loaded.deploymentId === deployment, loaded.deploymentId);

  const hashes: Record<string, string> = {
    "modelark-system": sha(systemFor("modelark")),
    "modelark-user-positive": sha(userFor({ note: "菜很好吃服务也很好", dishes: ["Mango Sticky Rice", "River Prawn Tom Yum"], enjoyMost: ["食物味道正宗美味"], recommendTo: ["Delicious", "Fresh"] }, "modelark")),
    "modelark-user-negative": sha(userFor({ note: "价格有点贵，冬阴功一般，服务很好", dishes: ["Mango Sticky Rice", "River Prawn Tom Yum"], enjoyMost: ["食物味道正宗美味"], recommendTo: ["Delicious", "Fresh"] }, "modelark")),
  };

  for (const provider of PROVIDERS) {
    const system = systemFor(provider);
    const tag = `[${provider}] system`;
    check(`${tag} carries EVIDENCE PRIORITY once`, count(system, "EVIDENCE PRIORITY —") === 1, count(system, "EVIDENCE PRIORITY —"));
    const p1 = field(system, "Priority 1 — ") ?? "";
    const p2 = field(system, "Priority 2 — ") ?? "";
    const p3 = field(system, "Priority 3 — ") ?? "";
    check(`${tag} priority 1 is the customer's own words and is never overridden`, /dining note/.test(p1) && /Never override/.test(p1), p1);
    check(`${tag} priority 2 is selected dishes and reasons`, /selected dishes/.test(p2) && !/enjoy-most/.test(p2), p2);
    check(`${tag} a selected dish is not a taste review`, /not that they described its taste/.test(p2), p2);
    check(`${tag} priority 3 is tags, which never override the note`, /enjoy-most/.test(p3) && /never override the note/.test(p3) && /not lived experience/.test(p3), p3);
    check(`${tag} own inference is never customer experience`, system.includes("Your own inference is never a customer experience."));
    check(`${tag} no longer ranks enjoy-most tags above dishes`, !system.includes("Priority 2 — customer-selected restaurant highlights"));
  }

  for (const testCase of CASES) {
    for (const provider of PROVIDERS) {
      const user = userFor(testCase.answers, provider);
      const tag = `[${provider}] ${testCase.label}`;
      const values = Object.fromEntries(Object.entries(HEADERS).map(([key, header]) => [key, field(user, header)])) as Record<keyof typeof HEADERS, string | undefined>;
      const groups = factGroups(user);
      const missing = Object.entries(values).filter(([, value]) => value === undefined).map(([key]) => key);
      check(`${tag}: evidence blocks present`, missing.length === 0 && groups !== undefined, { missing, groups: groups !== undefined });
      const plan = (values.priority ?? "").split(" → ").filter((item) => item && item !== "none");
      if (testCase.noteLed) {
        check(`${tag}: information priority leads with the note`, testCase.noteLed.some((id) => plan[0] === id || (plan[0] ?? "").includes(id)), plan);
      }
      if (testCase.primaryContent) {
        check(`${tag}: Primary Content follows the note`, testCase.primaryContent.test(values.primaryContent ?? ""), values.primaryContent);
      }
      if (testCase.primaryExperience) {
        check(`${tag}: PRIMARY EXPERIENCE is the note's point`, testCase.primaryExperience.test(values.primaryExperience ?? ""), values.primaryExperience);
      }
      if (testCase.absent) {
        const derived = [
          values.allowed, values.primaryExperience, values.secondaryExperience, values.foodAngle,
          values.primaryContent, values.supporting, values.strongest, values.favoriteDish, values.enjoyed,
          values.atmosphere, values.service, values.customerWords, values.priority, groups,
        ].join("\n");
        const hits = derived.match(new RegExp(testCase.absent.source, "g")) ?? [];
        check(`${tag}: no contradicted or invented evidence`, hits.length === 0, [...new Set(hits)]);
      }
      if (/冬阴功一般/.test(testCase.answers.note)) {
        check(`${tag}: favoriteDish is not the dish they called 一般`, !/冬阴功/.test(values.favoriteDish ?? ""), values.favoriteDish);
      }
      check(`${tag}: no undefined in evidence blocks`, !/undefined/.test(Object.values(values).join("\n")), values);
    }
  }

  return { deployment, checks, hashes };
}

function runStore(deployment: StoreId) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ["MONGODB_URI", "DATABASE_URL", "MONGODB_DB_NAME", "OPENAI_API_KEY", "OPENAI_MODEL", "AI_PROVIDER", "MODELARK_MODEL", "MODELARK_API_KEY", "GENERATION_DIAGNOSTICS"]) {
    delete env[key];
  }
  env.PROMPT_EVIDENCE_CHILD = "1";
  env.DEPLOYMENT_ID = deployment;
  env.NEXT_PUBLIC_DEPLOYMENT_ID = deployment;
  const run = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = run.stdout.split("\n").find((row) => row.startsWith(RESULT_PREFIX));
  if (!line) throw new Error(`${deployment} produced no result:\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as ChildResult;
}

async function main() {
  if (process.env.PROMPT_EVIDENCE_CHILD === "1") {
    process.stdout.write(`\n${RESULT_PREFIX}${JSON.stringify(await runChild())}\n`);
    return;
  }
  const results = (Object.keys(STORES) as StoreId[]).map(runStore);
  if (process.env.PRINT_PROMPT_HASHES) {
    console.log(JSON.stringify(Object.fromEntries(results.map((result) => [result.deployment, result.hashes])), null, 2));
  }
  let failed = 0;
  for (const result of results) {
    const failures = result.checks.filter((item) => !item.ok);
    failed += failures.length;
    console.log(`${result.deployment}: ${result.checks.length - failures.length}/${result.checks.length} checks passed`);
    for (const item of failures) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  }
  if (failed > 0) process.exit(1);
  console.log("validate-prompt-evidence-priority: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
