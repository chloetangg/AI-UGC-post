import { formatCoverTitleRules, shouldUseCoverLocation, type CoverTitleContext } from "./cover-rules";

export const COVER_HOOK_FAMILIES = [
  "HOOK-01",
  "HOOK-02",
  "HOOK-03",
  "HOOK-04",
  "HOOK-05",
  "HOOK-06",
  "HOOK-07",
  "HOOK-08",
] as const;

export type CoverHookFamily = (typeof COVER_HOOK_FAMILIES)[number];

const DISH_ANGLES = new Set(["CA-02", "CA-03"]);
const TRAVEL_IDS = new Set(["KSP-06", "ST-04", "CA-04", "CA-09"]);
const SHARE_IDS = new Set(["KSP-05", "ST-05", "CA-07", "CA-08"]);
const WARM_IDS = new Set(["KSP-02", "ST-03", "ST-09", "CA-11", "CA-12"]);

export function suggestCoverHookFamily(input: {
  kspId?: string;
  storylineId?: string;
  contentAngleId?: string;
  hasDishes?: boolean;
  customerType?: string;
  previousCoverHadDish?: boolean | null;
  variantIndex?: number;
  branch?: string;
}): CoverHookFamily {
  const ksp = input.kspId ?? "";
  const story = input.storylineId ?? "";
  const angle = input.contentAngleId ?? "";
  const variant = input.variantIndex ?? 0;
  const ids = new Set([ksp, story, angle]);

  if (
    shouldUseCoverLocation({
      branch: input.branch,
      variantIndex: input.variantIndex,
      kspId: ksp,
      contentAngleId: angle,
      dishes: input.hasDishes ? ["dish"] : [],
    })
  ) {
    return "HOOK-08";
  }

  if (DISH_ANGLES.has(angle) && input.hasDishes && input.previousCoverHadDish !== true) {
    return "HOOK-06";
  }
  if (SHARE_IDS.has(ksp) || SHARE_IDS.has(story) || SHARE_IDS.has(angle)) {
    return variant % 2 === 0 ? "HOOK-04" : "HOOK-07";
  }
  if ([...ids].some((id) => TRAVEL_IDS.has(id))) {
    return variant % 2 === 0 ? "HOOK-01" : "HOOK-04";
  }
  if ([...ids].some((id) => WARM_IDS.has(id))) {
    return variant % 2 === 0 ? "HOOK-07" : "HOOK-02";
  }
  if (input.customerType === "Local" && variant % 6 === 5) {
    return "HOOK-05";
  }
  if (variant % 8 === 7) return "HOOK-08";

  const rotation: CoverHookFamily[] = ["HOOK-01", "HOOK-03", "HOOK-02", "HOOK-04", "HOOK-07"];
  return rotation[variant % rotation.length] ?? "HOOK-01";
}

export function formatCoverHookRules(context: CoverTitleContext = {}) {
  return `${formatCoverTitleRules(context)}

HOOK FAMILIES — pick from evidence after the coverTitle keyword + subtitle-from-customer rules are satisfied. Do not copy these exact sentences:
HOOK-01 Search mood in the title: 曼谷必吃 / 曼谷美食 — still at least one pool keyword, never a keyword dump
HOOK-02 Adjective only if the meal supports it, prefer it in subTitle
HOOK-03 Reaction belongs in subTitle, not as a 3-character mainTitle
HOOK-04 Soft CTA lives in caption
HOOK-05 Local identity ONLY with evidence. Never invent 泰国人爱吃.
HOOK-06 Dish-led subtitle from a real selected dish or the dining note
HOOK-07 Warm home-style feeling in subTitle when the note supports it
HOOK-08 Location in the title only when it is the hook, e.g. centralwOrld泰餐推荐. Never force centralwOrld.

DIVERSITY: do not repeat the previous coverTitle/subTitle formula. Changing only 推荐/泰菜 is NOT enough.`;
}
