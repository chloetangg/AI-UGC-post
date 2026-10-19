/**
 * Code-level checks for the two-step rating flow. No database or network call is made.
 * Run: npx tsx scripts/validate-rating-flow.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyticsEventId } from "../lib/analytics/events";
import { NextRequest } from "next/server";
import { parseStarRating, ratingEventMetadata, sanitizeEventMetadata } from "../lib/analytics/types";
import { newRatingPath } from "../lib/entry-rating";
import { translations } from "../lib/i18n";

for (const value of ["1", "2", "3", "4", "5", 3, " 4 "]) {
  assert.equal(parseStarRating(value), Number(String(value).trim()), `valid star ${value}`);
}
for (const value of ["0", "6", "2.5", "-1", "abc", "", "１", "10", undefined, null, 3.5, ["2"]]) {
  assert.equal(parseStarRating(value), null, `invalid star ${String(value)}`);
}

assert.equal(ratingEventMetadata({ rating: "9", band: "rating_low" }), null, "out of range rating is rejected");
assert.equal(ratingEventMetadata({ band: "rating_positive" }), null, "missing rating is rejected");

const low = ratingEventMetadata({ rating: "2", band: "rating_positive", campaignId: "c", feedback: "  slow service " });
assert.deepEqual(low, { rating: "2", band: "rating_low", campaignId: "c", feedback: "slow service" }, "low keeps trimmed feedback, band follows rating");

const lowEmpty = ratingEventMetadata({ rating: "1", campaignId: "c", feedback: "   " });
assert.deepEqual(lowEmpty, { rating: "1", band: "rating_low", campaignId: "c" }, "empty feedback is not stored");

const high = ratingEventMetadata({ rating: "4", band: "rating_low", campaignId: "c", feedback: "stale text" });
assert.deepEqual(high, { rating: "4", band: "rating_positive", campaignId: "c" }, "3–5 stars never store feedback");

const longHigh = ratingEventMetadata(sanitizeEventMetadata({ rating: "5", feedback: "x".repeat(2000) }));
assert.ok(longHigh && !("feedback" in longHigh), "5 stars drop feedback even when sent");
const longLow = ratingEventMetadata(sanitizeEventMetadata({ rating: "1", feedback: "x".repeat(2000) }));
assert.equal(longLow?.feedback.length, 1000, "low feedback is capped by the existing limit");

assert.equal(
  analyticsEventId("rating_submitted", "session-1", "rating_submitted:review-1"),
  "rating_submitted:review-1",
  "client eventId is kept, so the unique index drops a repeated submit",
);

type ResolveHook = (
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context: unknown) => unknown,
) => unknown;
const headersStub = pathToFileURL(fileURLToPath(new URL("./stubs/next-headers.cjs", import.meta.url))).href;
(nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void }).registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/headers") return { url: headersStub, shortCircuit: true, format: "commonjs" };
    return nextResolve(specifier, context);
  },
});

async function postEvent(body: unknown) {
  const { POST } = await import("../app/api/analytics/events/route");
  const response = await POST(
    new Request("http://localhost/api/analytics/events", { method: "POST", body: JSON.stringify(body) }),
  );
  return { status: response.status, json: (await response.json()) as { ok?: boolean; error?: string } };
}

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

function fnBody(code: string, name: string) {
  const start = code.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  return code.slice(start, code.indexOf("\n}\n", start) + 2);
}

async function checkNewRound(client: string, step1: string) {
  assert.equal(newRatingPath("c1"), "/c/c1/rating?new=1");

  const { GET } = await import("../app/qr/[qrCodeId]/route");
  const response = await GET(new NextRequest("http://localhost/qr/baan-ying-centralworld?stars=4&draw=1"), {
    params: Promise.resolve({ qrCodeId: "baan-ying-centralworld" }),
  });
  const location = new URL(response.headers.get("location") ?? "");
  assert.equal(location.pathname, "/c/baan-ying-centralworld/rating");
  assert.equal(location.search, "?new=1", "a QR scan starts a new round and drops old stars/draw params");

  for (const path of ["../app/page.tsx", "../app/c/[campaignId]/page.tsx", "../app/c/[campaignId]/layout.tsx"]) {
    assert.match(source(path), /redirect\(newRatingPath\(/, `${path} enters through a new round`);
  }
  assert.match(
    source("../components/campaign/CampaignShell.tsx"),
    /router\.replace\(`\/c\/\$\{campaignId\}\/rating`\)/,
    "the mid-flow rating gate resumes the current round",
  );

  const page = source("../app/c/[campaignId]/rating/page.tsx");
  assert.match(page, /const stars = newRound \? null :/, "a new round never preselects stars from the URL");
  assert.match(page, /newRound=\{newRound\}/);

  const reset = fnBody(client, "resetRatingFlow");
  for (const key of ["storageKey", "submittedKey"]) {
    assert.match(reset, new RegExp(`removeStorage\\(${key}\\(campaignId\\)\\)`), `reset clears ${key}`);
  }
  assert.match(reset, /clearReviewId\(campaignId\)/, "reset drops the review id, so the next round gets a new one");
  assert.match(reset, /thankYouInThisVisit = false/);
  assert.doesNotMatch(client, /sessionStorage\.clear\(/, "never wipes unrelated sessionStorage");
  assert.equal(client.match(/resetRatingFlow\(campaignId\)/g)?.length, 2, "only the new-round entry and Rate again reset");
  assert.equal(client.match(/removeStorage\(/g)?.length, 3, "keys are removed only inside resetRatingFlow");

  assert.match(step1, /if \(!newRound\) return;\s*resetRatingFlow\(campaignId\);/, "reset only runs on an explicit new round");
  assert.match(fnBody(step1.replace(/^  /gm, ""), "rateAgain"), /resetRatingFlow\(campaignId\);\s*setDraw\(false\);\s*setRating\(null\);/);
  assert.match(step1, /onClick=\{rateAgain\}/, "the thank-you page offers Rate again");
  assert.match(step1, /readStorage\(submittedKey\(campaignId\)\) !== ""/, "refreshing the thank-you page keeps the finished round");

  for (const language of ["en", "zh", "th"] as const) {
    assert.ok(translations[language].rating.rateAgain.trim(), `${language} has a Rate again label`);
    assert.ok(translations[language].rating.showToStaff.trim(), `${language} has the show-to-staff line`);
  }
  assert.equal(translations.zh.rating.showToStaff, "感谢你的评价，请向店员出示此页面");
  const drawView = step1.slice(step1.indexOf("if (draw && onDrawUrl)"), step1.indexOf("return (\n    <RatingLayout"));
  assert.match(drawView, /subtitle=\{t\.rating\.showToStaff\}/);
  assert.doesNotMatch(client, /drawCta|openLuckyDraw|LUCKY_DRAW_URL/, "the thank-you page no longer offers or opens the lucky draw");
  assert.equal(drawView.match(/<Button/g)?.length, 1, "Rate again is the only button on the thank-you page");
}

async function main() {
  const round = { campaignId: "baan-ying-centralworld", reviewId: "11111111-2222-4333-8444-555555555555" };
  for (const rating of ["0", "6", "9", "2.5", "x"]) {
    const result = await postEvent({ eventType: "rating_submitted", metadata: { ...round, rating } });
    assert.equal(result.status, 400, `backend rejects rating ${rating}`);
    assert.equal(result.json.ok, false);
  }
  const missing = await postEvent({ eventType: "rating_submitted", metadata: round });
  assert.equal(missing.status, 400, "backend rejects a rating event without stars");
  const noReview = await postEvent({ eventType: "rating_submitted", metadata: { campaignId: round.campaignId, rating: "4" } });
  assert.equal(noReview.status, 400, "backend rejects a rating without a review id");

  const client = readFileSync(new URL("../app/c/[campaignId]/rating/rating-page-client.tsx", import.meta.url), "utf8");
  const step1 = client.slice(client.indexOf("export function RatingPageClient"), client.indexOf("export function RatingReviewClient"));
  const step2 = client.slice(client.indexOf("export function RatingReviewClient"));
  assert.doesNotMatch(step1, /trackAnalyticsEvent|sendFunnelEvent|Textarea/, "step 1 shows no feedback box and only submits through submitRating");
  assert.match(step1, /disabled=\{rating == null \|\| submitting\}/, "continue is disabled until a star is chosen and while sending");
  const continueFn = fnBody(step1.replace(/^  /gm, ""), "continueToReview");
  assert.match(
    continueFn,
    /if \(isLowRating\(rating\)\) \{[\s\S]*?router\.push\(`\/c\/\$\{campaignId\}\/rating\/review\?stars=\$\{rating\}`\);\s*return;\s*\}/,
    "1–2 stars go to the feedback step without submitting",
  );
  assert.match(
    continueFn,
    /inFlight\.current = true;[\s\S]*const reviewId = await submitRating\(campaignId, rating, ""\);\s*if \(!reviewId \|\| !\(await submitFormStart\(campaignId, reviewId\)\)\) \{[\s\S]*?setSaveFailed\(true\);\s*return;\s*\}\s*markEntryRatingPassed\(campaignId\);\s*router\.push\(campaignPath\(campaignId, "experience"\)\);/,
    "3–5 stars open the experience page only after the rating and form_submit are both saved",
  );
  const submit = fnBody(client, "submitRating");
  assert.match(submit, /reviewId,/, "the rating carries this round's review id; the server builds the eventId from it");
  assert.match(submit, /if \(submitted !== marker\) \{/, "a round already recorded with these stars is not sent again");
  assert.match(submit, /if \(!saved\) return null;\s*writeStorage\(submittedKey\(campaignId\), marker\);/, "the round is marked sent only after MongoDB saved it");
  assert.match(submit, /submitted && submitted !== `\$\{reviewId\}:\$\{rating\}`[\s\S]*?clearReviewId\(campaignId\);/, "changed stars after a saved round start a new round");
  assert.match(fnBody(client, "submitFormStart"), /eventType: "form_submit"/);
  assert.match(step2, /if \(!\(await submitRating\(campaignId, rating, note\)\)\) \{[\s\S]*?setSaveFailed\(true\);\s*return;\s*\}/, "a failed review stays on the page");
  assert.match(step2, /\{saveFailed \? \([\s\S]*?t\.rating\.saveFailed/, "a failed review shows the save error");
  for (const language of ["en", "zh", "th"] as const) {
    assert.ok(translations[language].rating.saveFailed.trim(), `${language} has a save error`);
  }
  assert.match(step2, /const note = low \? feedback\.trim\(\) : ""/, "feedback is only sent for 1–2 stars");
  assert.match(step2, /if \(inFlight\.current \|\| \(low && !note\)\) return;/, "1–2 stars cannot submit without feedback");
  assert.match(step2, /disabled=\{submitting \|\| \(low && !feedback\.trim\(\)\)\}/, "submit stays disabled until feedback is typed");
  assert.match(step2, /<Textarea[\s\S]*?required/, "the feedback box is marked required");
  assert.match(step2, /\{low \? \(/, "the feedback box renders only for 1–2 stars");
  assert.match(step2, /disabled=\{submitting\}/, "Back is locked while sending");

  assert.match(step1, /useState<number \| null>\(\(\) => stepOneRatings\.get\(campaignId\) \?\? null\)/, "step 1 never restores stars from the URL");
  assert.match(fnBody(step1.replace(/^  /gm, ""), "selectRating"), /stepOneRatings\.set\(campaignId, next\)/);
  assert.match(fnBody(step2.replace(/^  /gm, ""), "goBack"), /stepOneRatings\.set\(campaignId, rating\);/, "Back keeps the chosen stars");
  assert.match(fnBody(client, "resetRatingFlow"), /stepOneRatings\.delete\(campaignId\)/);
  assert.doesNotMatch(source("../app/c/[campaignId]/rating/page.tsx"), /initialRating/, "the server no longer preselects step-1 stars");

  const review = readFileSync(new URL("../app/c/[campaignId]/rating/review/page.tsx", import.meta.url), "utf8");
  assert.match(
    review,
    /if \(rating == null \|\| rating > 2\) \{\s*redirect\(`\/c\/\$\{campaignId\}\/rating`\)/,
    "only 1–2 stars use the feedback step",
  );

  await checkNewRound(client, step1);

  console.log("validate-rating-flow: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
