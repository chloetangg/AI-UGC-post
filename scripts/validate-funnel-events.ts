/**
 * Funnel events: rating_submitted, form_submit, generate, generation_complete and the /analytics counts.
 * Runs the real /api/analytics/events and /api/generate handlers against an in-memory MongoDB and a mocked
 * ModelArk reply, once per store in its own child process. No real database, model or network request.
 * Run: npx tsx scripts/validate-funnel-events.ts
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const STORES: Record<string, { branch: string; dbName: string; other: string }> = {
  "baan-ying-centralworld": {
    branch: "Baan Ying (centralwOrld, 3rd Floor)",
    dbName: "baan-ying-centralworld",
    other: "baan-ying-siam-center",
  },
  "baan-ying-siam-center": {
    branch: "Baan Ying (Siam Center, 2nd Floor)",
    dbName: "baan-ying-siam-center",
    other: "baan-ying-centralworld",
  },
};
const RESULT_PREFIX = "FUNNEL_EVENTS_RESULT ";

type Check = { name: string; ok: boolean; detail?: string };
type Doc = Record<string, unknown>;
type ResolveHook = (specifier: string, context: unknown, nextResolve: (specifier: string, context: unknown) => unknown) => unknown;

function valueAt(doc: Doc, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Doc)[key] : undefined), doc);
}

/** The query operators the app uses: equality, $ne, $in, $gte, $lte on dotted paths. */
function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([path, condition]) => {
    const value = valueAt(doc, path);
    if (condition && typeof condition === "object" && !(condition instanceof Date) && !Array.isArray(condition)) {
      return Object.entries(condition as Doc).every(([op, expected]) => {
        if (op === "$ne") return value !== expected;
        if (op === "$in") return (expected as unknown[]).includes(value);
        if (op === "$gte") return (value as Date) >= (expected as Date);
        if (op === "$lte") return (value as Date) <= (expected as Date);
        throw new Error(`fake Mongo: unsupported operator ${op}`);
      });
    }
    return value === condition;
  });
}

function groupKey(doc: Doc, id: unknown, ymd: (date: Date, timeZone: string) => string) {
  if (id == null) return null;
  if (typeof id === "string" && id.startsWith("$")) return valueAt(doc, id.slice(1)) ?? null;
  const spec = (id as { $dateToString?: { format: string; date: string; timezone: string } }).$dateToString;
  if (spec?.format === "%Y-%m-%d") return ymd(valueAt(doc, spec.date.slice(1)) as Date, spec.timezone);
  throw new Error(`fake Mongo: unsupported $group _id ${JSON.stringify(id)}`);
}

/** $match, $facet, $group ($sum: 1), $count, $sort, $limit: the stages the dashboard query uses. */
function runPipeline(input: Doc[], pipeline: Doc[], ymd: (date: Date, timeZone: string) => string): Doc[] {
  let rows = input;
  for (const stage of pipeline) {
    const [op, spec] = Object.entries(stage)[0] as [string, Doc];
    if (op === "$match") rows = rows.filter((doc) => matches(doc, spec));
    else if (op === "$facet") {
      rows = [Object.fromEntries(Object.entries(spec).map(([key, sub]) => [key, runPipeline(rows, sub as Doc[], ymd)]))];
    } else if (op === "$group") {
      const groups = new Map<string, Doc>();
      for (const doc of rows) {
        const key = groupKey(doc, spec._id, ymd);
        const mapKey = JSON.stringify(key);
        const group = groups.get(mapKey) ?? { _id: key };
        for (const [field, accumulator] of Object.entries(spec)) {
          if (field === "_id") continue;
          if ((accumulator as Doc).$sum !== 1) throw new Error("fake Mongo: only $sum: 1 is supported");
          group[field] = ((group[field] as number) ?? 0) + 1;
        }
        groups.set(mapKey, group);
      }
      rows = [...groups.values()];
    } else if (op === "$count") rows = rows.length ? [{ [spec as unknown as string]: rows.length }] : [];
    else if (op === "$sort") {
      const [[field, direction]] = Object.entries(spec) as [[string, number]];
      rows = [...rows].sort((a, b) => {
        const left = valueAt(a, field) as number | Date;
        const right = valueAt(b, field) as number | Date;
        return (left > right ? 1 : left < right ? -1 : 0) * direction;
      });
    } else if (op === "$limit") rows = rows.slice(0, spec as unknown as number);
    else throw new Error(`fake Mongo: unsupported stage ${op}`);
  }
  return rows;
}

class FakeMongo {
  readonly stores = new Map<string, Map<string, Doc[]>>();
  failWrites = false;

  constructor(private readonly ymd: (date: Date, timeZone: string) => string) {}

  rows(dbName: string, collection: string) {
    const db = this.stores.get(dbName) ?? new Map<string, Doc[]>();
    this.stores.set(dbName, db);
    const rows = db.get(collection) ?? [];
    db.set(collection, rows);
    return rows;
  }

  client() {
    return {
      db: (dbName: string) => ({
        databaseName: dbName,
        collection: (name: string) => this.collection(dbName, name),
      }),
    };
  }

  private collection(dbName: string, name: string) {
    const rows = () => this.rows(dbName, name);
    const failIfDown = () => {
      if (this.failWrites) throw new Error("bad auth : Authentication failed.");
    };
    return {
      createIndex: async () => "ok",
      insertOne: async (doc: Doc) => {
        failIfDown();
        if (name === "analytics_events" && rows().some((row) => row.eventId === doc.eventId)) {
          throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
        }
        rows().push(structuredClone(doc));
        return { acknowledged: true, insertedId: doc.eventId ?? rows().length };
      },
      findOne: async (filter: Doc) => {
        failIfDown();
        return rows().find((row) => matches(row, filter)) ?? null;
      },
      updateOne: async () => {
        failIfDown();
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
      },
      replaceOne: async () => ({ acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 }),
      aggregate: (pipeline: Doc[]) => ({ toArray: async () => runPipeline(rows(), pipeline, this.ymd) }),
    };
  }
}

async function runChild() {
  const deployment = process.env.DEPLOYMENT_ID ?? "";
  const store = STORES[deployment];
  if (!store) throw new Error(`Unknown store ${deployment}`);
  const stub = pathToFileURL(fileURLToPath(new URL("./stubs/next-headers.cjs", import.meta.url))).href;
  (nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void }).registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "next/headers") return { url: stub, shortCircuit: true, format: "commonjs" };
      return nextResolve(specifier, context);
    },
  });
  const { ymdInTimeZone } = await import("../lib/analytics/dates");
  const mongo = new FakeMongo((date, timeZone) => ymdInTimeZone(date, timeZone));
  (globalThis as { _mongoClient?: unknown })._mongoClient = mongo.client();
  const events = () => mongo.rows(store.dbName, "analytics_events");
  const ofType = (eventType: string, reviewId?: string) =>
    events().filter((row) => row.eventType === eventType && (!reviewId || valueAt(row, "metadata.reviewId") === reviewId));

  const checks: Check[] = [];
  const check = (name: string, ok: boolean, detail?: unknown) =>
    checks.push({ name, ok, detail: ok ? undefined : JSON.stringify(detail) });

  const { POST: postEventRoute } = await import("../app/api/analytics/events/route");
  const post = async (eventType: string, metadata: Doc) => {
    const response = await postEventRoute(
      new Request("http://localhost/api/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventType, metadata, sessionId: "funnel-test-session" }),
      }),
    );
    return { status: response.status, body: (await response.json()) as { ok?: boolean; duplicate?: boolean; error?: string } };
  };
  const campaignId = deployment;
  const reviewHigh = "aaaaaaaa-0000-4000-8000-000000000001";
  const reviewLow = "aaaaaaaa-0000-4000-8000-000000000002";
  const reviewOutage = "aaaaaaaa-0000-4000-8000-000000000003";
  const reviewOneStar = "aaaaaaaa-0000-4000-8000-000000000004";

  // 1. 3–5 stars Continue: one rating_submitted and one form_submit.
  const rated = await post("rating_submitted", { campaignId, reviewId: reviewHigh, rating: "4", feedback: "should be dropped" });
  const formed = await post("form_submit", { campaignId, reviewId: reviewHigh });
  check("1. 4 stars: rating saved", rated.status === 200 && rated.body.ok === true, rated);
  check("1. 4 stars: form_submit saved", formed.status === 200 && formed.body.ok === true, formed);
  const highRating = ofType("rating_submitted", reviewHigh);
  check("1. one rating_submitted for the round", highRating.length === 1, highRating);
  check(
    "1. rating row: stars, band, review id, store, session, no feedback",
    highRating[0]?.eventId === `rating_submitted:${reviewHigh}` &&
      valueAt(highRating[0], "metadata.rating") === "4" &&
      valueAt(highRating[0], "metadata.band") === "rating_positive" &&
      valueAt(highRating[0], "metadata.campaignId") === deployment &&
      valueAt(highRating[0], "metadata.branchId") === deployment &&
      highRating[0]?.sessionId === "funnel-test-session" &&
      highRating[0]?.timestamp instanceof Date &&
      valueAt(highRating[0], "metadata.feedback") === undefined,
    highRating[0],
  );
  const form = ofType("form_submit", reviewHigh);
  check(
    "1. one form_submit keyed by the review",
    form.length === 1 && form[0].eventId === `form_submit:${reviewHigh}` && valueAt(form[0], "metadata.source") === "rating_continue",
    form,
  );

  // 2. Same round clicked again or retried: no new rows, still reported as saved.
  for (let i = 0; i < 2; i += 1) {
    const again = await post("rating_submitted", { campaignId, reviewId: reviewHigh, rating: "4" });
    const formAgain = await post("form_submit", { campaignId, reviewId: reviewHigh });
    check(`2. retry ${i + 1}: both answer ok as duplicates`, again.body.ok === true && again.body.duplicate === true && formAgain.body.duplicate === true, { again, formAgain });
  }
  check("2. still one rating and one form_submit", ofType("rating_submitted", reviewHigh).length === 1 && ofType("form_submit", reviewHigh).length === 1);

  // 3. 1–2 stars: the full trimmed feedback is stored with the rating.
  const note = "  上菜有点慢，冬阴功偏咸。\n希望下次能改进  ";
  const low = await post("rating_submitted", { campaignId, reviewId: reviewLow, rating: "2", feedback: note });
  const lowRow = ofType("rating_submitted", reviewLow)[0];
  check("3. 2 stars saved", low.status === 200 && low.body.ok === true, low);
  check(
    "3. low row keeps rating, band and the whole trimmed feedback",
    valueAt(lowRow ?? {}, "metadata.rating") === "2" &&
      valueAt(lowRow ?? {}, "metadata.band") === "rating_low" &&
      valueAt(lowRow ?? {}, "metadata.feedback") === note.trim(),
    lowRow,
  );
  const full = "好".repeat(1000);
  const fullSaved = await post("rating_submitted", { campaignId, reviewId: reviewOneStar, rating: "1", feedback: ` ${full} ` });
  const fullRow = ofType("rating_submitted", reviewOneStar)[0];
  check("3. 1000-character feedback is stored uncut", fullSaved.status === 200 && valueAt(fullRow ?? {}, "metadata.feedback") === full, {
    status: fullSaved.status,
    length: String(valueAt(fullRow ?? {}, "metadata.feedback") ?? "").length,
  });
  for (const [label, feedback] of [
    ["1001 characters", "好".repeat(1001)],
    ["only spaces", "   "],
    ["missing", undefined],
    ["not text", 123],
  ] as const) {
    const id = `bbbbbbbb-0000-4000-8000-${String(label.length).padStart(12, "0")}`;
    const rejected = await post("rating_submitted", { campaignId, reviewId: id, rating: "1", feedback });
    check(`3. low feedback ${label} is rejected with 400`, rejected.status === 400 && rejected.body.ok === false && ofType("rating_submitted", id).length === 0, rejected);
  }
  for (const rating of ["0", "6", "2.5", "x", 3.5, -1]) {
    const rejected = await post("rating_submitted", { campaignId, reviewId: "cccccccc-0000-4000-8000-000000000009", rating });
    check(`3. rating ${JSON.stringify(rating)} is rejected with 400`, rejected.status === 400, rejected);
  }

  // 4. Write failure: the client is told it failed; the retry saves exactly one row.
  mongo.failWrites = true;
  const down = await post("rating_submitted", { campaignId, reviewId: reviewOutage, rating: "1", feedback: "等了很久" });
  mongo.failWrites = false;
  check("4. failed save answers 503 ok:false", down.status === 503 && down.body.ok === false, down);
  check("4. nothing stored while MongoDB failed", ofType("rating_submitted", reviewOutage).length === 0);
  const retried = await post("rating_submitted", { campaignId, reviewId: reviewOutage, rating: "1", feedback: "等了很久" });
  const retriedAgain = await post("rating_submitted", { campaignId, reviewId: reviewOutage, rating: "1", feedback: "等了很久" });
  check("4. retry saves, second retry is a duplicate", retried.body.ok === true && retriedAgain.body.duplicate === true, { retried, retriedAgain });
  check("4. exactly one row after retries", ofType("rating_submitted", reviewOutage).length === 1);

  // 5. 1–2 stars never produce form_submit, generate or generation_complete.
  const lowForm = await post("form_submit", { campaignId, reviewId: reviewLow });
  check("5. form_submit for a 1–2 star review is refused (409)", lowForm.status === 409 && ofType("form_submit", reviewLow).length === 0, lowForm);
  const unknownForm = await post("form_submit", { campaignId, reviewId: "dddddddd-0000-4000-8000-000000000001" });
  check("5. form_submit without any saved rating is refused", unknownForm.status === 409, unknownForm);
  check(
    "5. low reviews have no generate or generation_complete",
    [reviewLow, reviewOutage, reviewOneStar].every((id) => ofType("generate", id).length === 0 && ofType("generation_complete", id).length === 0),
  );

  // 7–8. Generate clicks: each a row with its own action id; a replay of one click is not counted twice.
  const actions = {
    initial: "eeeeeeee-0000-4000-8000-000000000001",
    regen1: "eeeeeeee-0000-4000-8000-000000000002",
    regen2: "eeeeeeee-0000-4000-8000-000000000003",
  };
  const generated = await post("generate", { campaignId, reviewId: reviewHigh, actionId: actions.initial, actionType: "initial" });
  check("7. first Generate saved", generated.body.ok === true, generated);
  check("7. one generate row", ofType("generate", reviewHigh).length === 1);
  for (const id of [actions.regen1, actions.regen2]) {
    await post("generate", { campaignId, reviewId: reviewHigh, actionId: id, actionType: "regenerate", previousGenerationId: "ffffffff-0000-4000-8000-000000000001" });
  }
  const generateRows = ofType("generate", reviewHigh);
  check("8. two Regenerates add two rows", generateRows.length === 3, generateRows.map((row) => row.eventId));
  check(
    "8. every generate row has its own eventId and the same review id",
    new Set(generateRows.map((row) => row.eventId)).size === 3 &&
      generateRows.every((row) => valueAt(row, "metadata.reviewId") === reviewHigh) &&
      generateRows.filter((row) => valueAt(row, "metadata.actionType") === "regenerate").length === 2,
    generateRows,
  );
  const replay = await post("generate", { campaignId, reviewId: reviewHigh, actionId: actions.regen2, actionType: "regenerate" });
  check("11. a replayed click (Strict Mode, network retry) is a duplicate", replay.body.duplicate === true && ofType("generate", reviewHigh).length === 3, replay);
  const badType = await post("generate", { campaignId, reviewId: reviewHigh, actionId: "eeeeeeee-0000-4000-8000-000000000009", actionType: "auto" });
  check("8. unknown actionType is rejected", badType.status === 400, badType);

  // 9–10. /api/generate: failure records nothing; success records one generation_complete per action.
  let modelStatus = 200;
  const modelReply = JSON.stringify({
    titles: ["芒果糯米饭甜度刚刚好", "这道甜品我很喜欢", "饭后来一份芒果糯米饭"],
    captionParagraphs: ["点了芒果糯米饭，甜度刚刚好，我很喜欢。"],
    hashtags: ["#BaanYing曼谷", "#曼谷美食", "#泰国美食", "#曼谷必吃", "#泰国菜"],
    mainTitle: "芒果糯米饭",
    subTitle: "甜度刚刚好很喜欢",
    selectedPhotoIndex: 0,
    selectedPhotoIndexes: [0],
    photoSelectionReason: "",
    remainingPhotoOrder: [],
    remainingOrderPattern: "1",
  });
  globalThis.fetch = (async (url: string | URL | Request) => {
    const target = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    if (!target.includes("bytepluses.com/api/v3/responses")) throw new Error(`unexpected fetch ${target}`);
    if (modelStatus !== 200) {
      return new Response(JSON.stringify({ error: { message: "mock outage" } }), { status: modelStatus });
    }
    return new Response(
      JSON.stringify({
        status: "completed",
        model: "mock-model",
        output: [{ type: "message", content: [{ type: "output_text", text: modelReply }] }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  const { POST: generateRoute } = await import("../app/api/generate/route");
  const generate = async (actionId: string, actionType: string, reviewId = reviewHigh) => {
    const form = new FormData();
    form.append(
      "payload",
      JSON.stringify({
        branch: store.branch,
        campaignId,
        customerType: "",
        visitFrequency: "",
        enjoyMost: [],
        recommendedDishes: ["Mango Sticky Rice"],
        recommendedDishOther: "",
        recommendTo: [],
        diningExperienceNote: "芒果糯米饭甜度刚刚好，很喜欢",
        photoCount: 1,
        contentType: "restaurant-recommendation",
        productName: "Baan Ying",
        variantIndex: 0,
        contentLanguage: "zh-CN",
        requiredLocationPlacement: "standalone",
        brandName: "Baan Ying",
        productCategory: "Thai Restaurant / Food & Dining",
        productDescription: "",
        analyticsSessionId: "funnel-test-session",
        reviewId,
        generationActionId: actionId,
        generationActionType: actionType,
      }),
    );
    const response = await generateRoute(new Request("http://localhost/api/generate", { method: "POST", body: form }));
    return { status: response.status, body: (await response.json()) as { generationId?: string; error?: string } };
  };

  const formBefore = ofType("form_submit").length;
  modelStatus = 500;
  const failed = await generate(actions.initial, "initial");
  check("9. AI failure returns an error", failed.status >= 400, failed);
  check("9. AI failure records no generation_complete", ofType("generation_complete").length === 0, ofType("generation_complete"));
  check("9. the Generate click stays recorded", ofType("generate", reviewHigh).length === 3);

  modelStatus = 200;
  const ok = await generate(actions.regen1, "regenerate");
  const complete = ofType("generation_complete");
  check("10. AI success returns 200", ok.status === 200, ok);
  check(
    "10. one generation_complete tied to the action",
    complete.length === 1 &&
      complete[0].eventId === `generation_complete:${actions.regen1}` &&
      valueAt(complete[0], "metadata.actionId") === actions.regen1 &&
      valueAt(complete[0], "metadata.actionType") === "regenerate" &&
      valueAt(complete[0], "metadata.reviewId") === reviewHigh &&
      valueAt(complete[0], "metadata.generationId") === ok.body.generationId,
    complete,
  );
  await generate(actions.regen1, "regenerate");
  check("10. a second success for the same action is not counted again", ofType("generation_complete").length === 1);
  await generate(actions.regen2, "regenerate");
  check("10. a success for another action is counted", ofType("generation_complete").length === 2);
  check("10. /api/generate no longer writes form_submit", ofType("form_submit").length === formBefore);

  // 12. Store isolation: every write went to this store's database; the other store's campaign is refused.
  const dbNames = [...mongo.stores.keys()];
  check("12. writes land only in this store's database", dbNames.length === 1 && dbNames[0] === store.dbName, dbNames);
  const foreign = await post("rating_submitted", { campaignId: store.other, reviewId: "99999999-0000-4000-8000-000000000001", rating: "5" });
  check("12. the other store's campaignId is refused", foreign.status === 400 && [...mongo.stores.keys()].length === 1, foreign);

  // 13. Dashboard: Form Submission and Generate follow the new definitions; old rows stay apart.
  const now = new Date();
  events().push(
    { eventId: "qr_scan:legacy-1", eventType: "qr_scan", sessionId: "s1", qrCodeId: "baan-ying", timestamp: now, metadata: { source: "rating-page" } },
    { eventId: "form_submit:legacy-1", eventType: "form_submit", sessionId: "s1", qrCodeId: "", timestamp: now, metadata: { source: "generate_api" } },
  );
  const { queryAnalyticsReport } = await import("../lib/analytics/query");
  const report = await queryAnalyticsReport({ range: "all", branchId: deployment });
  const summary = report.summary;
  const expected = {
    qrScans: 1,
    ratingSubmissions: ofType("rating_submitted").length,
    lowRatings: 3,
    formSubmissions: 1,
    legacyFormSubmissions: 1,
    generateActions: 3,
    generations: 2,
  };
  check(
    "13. summary counts follow the new definitions",
    Object.entries(expected).every(([key, value]) => summary[key as keyof typeof summary] === value) && expected.ratingSubmissions === 4,
    { summary, expected },
  );
  const dailyTotal = (key: "formSubmissions" | "generateActions" | "generations" | "ratingSubmissions") =>
    report.daily.reduce((sum, row) => sum + row[key], 0);
  check(
    "13. daily rows add up to the summary",
    dailyTotal("formSubmissions") === 1 && dailyTotal("generateActions") === 3 && dailyTotal("generations") === 2 && dailyTotal("ratingSubmissions") === 4,
    report.daily,
  );
  check("13. Form → Generate uses Generate clicks", report.conversion.formToGenerate === 300 && report.conversion.generateToComplete === 66.7, report.conversion);
  check(
    "13. low-rating list carries the feedback, and no 3–5 star review",
    report.lowRatingFeedback.length === 3 &&
      report.lowRatingFeedback.some((row) => row.rating === 2 && row.feedback === note.trim()) &&
      report.lowRatingFeedback.every((row) => row.rating <= 2 && row.reviewId !== reviewHigh),
    report.lowRatingFeedback,
  );
  const oneStar = await queryAnalyticsReport({ range: "all", branchId: deployment, lowRatingStars: "1" });
  check(
    "13. the stars filter keeps only 1-star feedback",
    oneStar.lowRatingStars === 1 && oneStar.lowRatingFeedback.length === 2 && oneStar.lowRatingFeedback.every((row) => row.rating === 1),
    oneStar.lowRatingFeedback,
  );
  check(
    "13. the dashboard counts events, not sessions",
    summary.uniqueVisitors === 2 && summary.generateActions === 3 && summary.ratingSubmissions === 4,
    summary,
  );

  // Acceptance: one session, one round, first Generate plus three Regenerates, all four succeed.
  // Each attempt is what the browser does: generatePost writes `generate`, then posts /api/generate with the same id.
  let attemptSeq = 0;
  const attempt = async (reviewId: string, actionType: "initial" | "regenerate", succeeds: boolean) => {
    attemptSeq += 1;
    const actionId = `abcdef00-0000-4000-8000-${String(attemptSeq).padStart(12, "0")}`;
    await post("generate", { campaignId, reviewId, actionId, actionType });
    modelStatus = succeeds ? 200 : 500;
    const response = await generate(actionId, actionType, reviewId);
    modelStatus = 200;
    return { actionId, status: response.status };
  };
  const round = async (reviewId: string, outcomes: boolean[]) => {
    await post("rating_submitted", { campaignId, reviewId, rating: "5" });
    await post("form_submit", { campaignId, reviewId });
    const results = [];
    for (const [index, succeeds] of outcomes.entries()) {
      results.push(await attempt(reviewId, index === 0 ? "initial" : "regenerate", succeeds));
    }
    return results;
  };
  const counts = (reviewId: string) => ({
    rating_submitted: ofType("rating_submitted", reviewId).length,
    form_submit: ofType("form_submit", reviewId).length,
    generate: ofType("generate", reviewId).length,
    generation_complete: ofType("generation_complete", reviewId).length,
  });
  const before = report.summary;

  const reviewAll = "abcdef00-1111-4000-8000-000000000001";
  const allOk = await round(reviewAll, [true, true, true, true]);
  const allCounts = counts(reviewAll);
  check(
    "A. 1 rating, 1 form, Generate + 3 Regenerates all succeed → 1 / 1 / 4 / 4",
    allCounts.rating_submitted === 1 && allCounts.form_submit === 1 && allCounts.generate === 4 && allCounts.generation_complete === 4,
    allCounts,
  );
  check("A. every attempt returned 200", allOk.every((item) => item.status === 200), allOk);
  check(
    "A. each generation_complete carries the same id as its generate",
    allOk.every(({ actionId }) => {
      const started = events().filter((row) => row.eventId === `generate:${actionId}`);
      const finished = events().filter((row) => row.eventId === `generation_complete:${actionId}`);
      return started.length === 1 && finished.length === 1 && valueAt(finished[0], "metadata.actionId") === actionId;
    }),
    allOk,
  );
  check(
    "A. all four attempts keep the review id and the session id",
    [...ofType("generate", reviewAll), ...ofType("generation_complete", reviewAll)].every(
      (row) => row.sessionId === "funnel-test-session" && valueAt(row, "metadata.reviewId") === reviewAll,
    ),
  );
  check(
    "A. actionType is initial once, then regenerate three times",
    ofType("generate", reviewAll).filter((row) => valueAt(row, "metadata.actionType") === "initial").length === 1 &&
      ofType("generate", reviewAll).filter((row) => valueAt(row, "metadata.actionType") === "regenerate").length === 3,
  );

  const reviewOneFails = "abcdef00-1111-4000-8000-000000000002";
  const oneFails = await round(reviewOneFails, [true, true, false, true]);
  const failCounts = counts(reviewOneFails);
  check(
    "B. same session, new round, one of four attempts fails → 1 / 1 / 4 / 3",
    failCounts.rating_submitted === 1 && failCounts.form_submit === 1 && failCounts.generate === 4 && failCounts.generation_complete === 3,
    failCounts,
  );
  check(
    "B. the failed attempt has a generate but no generation_complete",
    events().some((row) => row.eventId === `generate:${oneFails[2].actionId}`) &&
      !events().some((row) => row.eventId === `generation_complete:${oneFails[2].actionId}`) &&
      oneFails[2].status >= 400,
    oneFails,
  );

  const reviewThird = "abcdef00-1111-4000-8000-000000000003";
  await post("rating_submitted", { campaignId, reviewId: reviewThird, rating: "3" });
  const thirdForm = await post("form_submit", { campaignId, reviewId: reviewThird });
  check(
    "2. another round in the same session adds its own form_submit",
    thirdForm.body.ok === true && thirdForm.body.duplicate === false && counts(reviewThird).form_submit === 1,
    thirdForm,
  );
  check(
    "2. the session now has one form_submit per round",
    ofType("form_submit").filter((row) => row.sessionId === "funnel-test-session" && valueAt(row, "metadata.source") === "rating_continue").length === 4,
  );

  const after = (await queryAnalyticsReport({ range: "all", branchId: deployment })).summary;
  check(
    "11. the dashboard adds every new event in the same session",
    after.ratingSubmissions - before.ratingSubmissions === 3 &&
      after.formSubmissions - before.formSubmissions === 3 &&
      after.generateActions - before.generateActions === 8 &&
      after.generations - before.generations === 7 &&
      after.uniqueVisitors === before.uniqueVisitors,
    { before, after },
  );
  check("12. the new rounds also stayed in this store's database", [...mongo.stores.keys()].join() === store.dbName, [...mongo.stores.keys()]);

  process.stdout.write(`\n${RESULT_PREFIX}${JSON.stringify({ deployment, checks })}\n`);
}

/** Client wiring that cannot run without a browser: the click handlers and the in-flight guard. */
function sourceChecks(): Check[] {
  const checks: Check[] = [];
  const check = (name: string, ok: boolean) => checks.push({ name, ok });
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
  const experience = read("../app/c/[campaignId]/experience/experience-page-client.tsx");
  const continueNext = experience.slice(experience.indexOf("function continueNext"), experience.indexOf("function patchFeedback"));
  check(
    "6. Experience Continue records generate only after the required-field check",
    /if \(!ready \|\| leaving\) return;[\s\S]*startGenerateAction\("initial"\);[\s\S]*router\.push\(campaignPath\(campaignId, "generating"\)\)/.test(continueNext),
  );
  check("6. generate is recorded exactly once on the Experience page", experience.match(/startGenerateAction\(/g)?.length === 1);
  const result = read("../app/c/[campaignId]/result/page.tsx");
  check(
    "8. Regenerate records generate once per click and locks the button",
    /function regenerate\(\) \{\s*if \(regenerating\) return;\s*setRegenerating\(true\);\s*startGenerateAction\("regenerate"\);/.test(result) &&
      /disabled=\{regenerating\} onClick=\{regenerate\}/.test(result),
  );
  const generating = read("../app/c/[campaignId]/generating/page.tsx");
  const effect = generating.slice(generating.indexOf("useEffect("), generating.indexOf("return (\n"));
  check("11. the Generating page effect never records generate (rerender, Strict Mode, refresh)", !/startGenerateAction/.test(effect));
  check(
    "9. Retry after an AI failure records one generate per failure",
    /if \(!retryArmed\.current\) return;\s*retryArmed\.current = false;\s*startGenerateAction\("retry"\);/.test(generating),
  );
  const provider = read("../components/providers/campaign-flow-provider.tsx");
  check(
    "11. a second generatePost call reuses the request before taking the click",
    /if \(generateInFlightRef\.current\) \{\s*return generateInFlightRef\.current;\s*\}\s*const action = pendingActionRef\.current;\s*pendingActionRef\.current = null;/.test(provider),
  );
  check(
    "7. the request carries the click's action id",
    /generationActionId: action\?\.actionId \?\? ""/.test(provider) && /eventType: "generate"/.test(provider),
  );
  const arm = provider.slice(provider.indexOf("const startGenerateAction"), provider.indexOf("const generatePost"));
  check("7. a click only arms the action; it writes nothing by itself", /pendingActionRef\.current = \{ actionId: createId\(\), actionType \}/.test(arm) && !/sendFunnelEvent/.test(arm));
  const start = provider.slice(provider.indexOf("const generatePost"), provider.indexOf("const run = (async"));
  check(
    "7. generate is written when generatePost starts a request for an armed click",
    /pendingActionRef\.current = null;\s*if \(action\) \{[\s\S]*eventType: "generate"/.test(start),
  );
  const route = read("../app/api/generate/route.ts");
  check("10. /api/generate writes no form_submit or generate", !/trackServerEvent\(\s*"(form_submit|generate)"/.test(route));
  check(
    "10. generation_complete is written after the final output check",
    route.indexOf('"generation_complete"') > route.indexOf("assertDeploymentOutput(") && route.indexOf("assertDeploymentOutput(") > 0,
  );
  return checks;
}

function runStore(deployment: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ["MONGODB_URI", "DATABASE_URL", "MONGODB_DB_NAME", "OPENAI_API_KEY", "OPENAI_MODEL", "AI_PROVIDER", "MODELARK_MODEL"]) {
    delete env[key];
  }
  env.FUNNEL_EVENTS_CHILD = "1";
  env.DEPLOYMENT_ID = deployment;
  env.NEXT_PUBLIC_DEPLOYMENT_ID = deployment;
  if (deployment !== "baan-ying-centralworld") env.MONGODB_DB_NAME = STORES[deployment].dbName;
  env.MODELARK_API_KEY = "funnel-events-test-placeholder";
  const run = spawnSync("npx", ["tsx", fileURLToPath(import.meta.url)], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const line = run.stdout.split("\n").find((row) => row.startsWith(RESULT_PREFIX));
  if (!line) throw new Error(`${deployment} produced no result:\n${run.stdout}\n${run.stderr}`);
  return JSON.parse(line.slice(RESULT_PREFIX.length)) as { deployment: string; checks: Check[] };
}

async function main() {
  if (process.env.FUNNEL_EVENTS_CHILD === "1") return runChild();
  let failed = 0;
  const report = (label: string, checks: Check[]) => {
    const failures = checks.filter((item) => !item.ok);
    failed += failures.length;
    console.log(`${label}: ${checks.length - failures.length}/${checks.length} checks passed`);
    for (const item of failures) console.log(`  FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ""}`);
  };
  report("client wiring", sourceChecks());
  for (const deployment of Object.keys(STORES)) {
    const result = runStore(deployment);
    report(result.deployment, result.checks);
  }
  if (failed > 0) process.exit(1);
  console.log("validate-funnel-events: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
