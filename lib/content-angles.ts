import { BAAN_YING_CONTENT_STRATEGY } from "@/lib/brand/baan-ying-strategy";
import { pickSuggestedStrategy } from "@/lib/content-strategy/select";
import type { GeneratePostInput } from "@/types/content";

/** @deprecated Use lib/content-strategy CA-01…CA-12. Kept as a compatibility shim. */
export const CONTENT_ANGLE_IDS = BAAN_YING_CONTENT_STRATEGY.contentAngles.map(
  (item) => item.id,
) as [string, ...string[]];

export type ContentAngleId = (typeof BAAN_YING_CONTENT_STRATEGY.contentAngles)[number]["id"];

export const CONTENT_ANGLE_LABELS: Record<string, string> = Object.fromEntries(
  BAAN_YING_CONTENT_STRATEGY.contentAngles.map((item) => [item.id, item.name]),
);

export function eligibleContentAngles(
  input: Pick<
    GeneratePostInput,
    "customerType" | "visitFrequency" | "enjoyMost" | "recommendedDishes" | "branch"
  >,
): ContentAngleId[] {
  const suggested = pickSuggestedStrategy(BAAN_YING_CONTENT_STRATEGY, {
    ...input,
    recommendTo: [],
    diningExperienceNote: "",
    photoCount: 0,
    variantIndex: 0,
  });
  const fromStoryline =
    BAAN_YING_CONTENT_STRATEGY.compatibility.storylineToAngles[suggested.storylineId] ?? [];
  return [...new Set([suggested.contentAngleId, ...fromStoryline])];
}

export function pickSuggestedContentAngle(
  input: Pick<
    GeneratePostInput,
    "customerType" | "visitFrequency" | "enjoyMost" | "recommendedDishes" | "branch" | "variantIndex"
  >,
  previousAngle?: string,
): ContentAngleId {
  return pickSuggestedStrategy(
    BAAN_YING_CONTENT_STRATEGY,
    {
      ...input,
      recommendTo: [],
      diningExperienceNote: "",
      photoCount: 0,
    },
    { previousContentAngleId: previousAngle },
  ).contentAngleId;
}

export function formatContentAngleLibrary() {
  return BAAN_YING_CONTENT_STRATEGY.contentAngles
    .map((item) => `- ${item.id}: ${item.name}`)
    .join("\n");
}

export function formatEligibleContentAngles(ids: string[]) {
  return ids
    .map((id) => `- ${id}: ${CONTENT_ANGLE_LABELS[id] ?? id}`)
    .join("\n");
}
