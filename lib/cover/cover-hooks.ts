import { formatCoverTitleRules, shouldUseCoverLocation, type CoverTitleContext } from "./cover-rules";
import type { CoverHookType } from "@/lib/content-evidence";

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
  diningNote?: string;
  previousCoverHookType?: CoverHookType;
}): CoverHookFamily {
  const ksp = input.kspId ?? "";
  const story = input.storylineId ?? "";
  const angle = input.contentAngleId ?? "";
  const variant = input.variantIndex ?? 0;
  const ids = new Set([ksp, story, angle]);
  const note = input.diningNote?.trim() ?? "";
  const previousHook = input.previousCoverHookType;

  if (/老板|服务/.test(note) && !/没有.{0,8}服务/.test(note)) {
    return variant % 2 === 0 ? "HOOK-03" : "HOOK-02";
  }
  if (/逛完|逛街/.test(note)) {
    return "HOOK-08";
  }
  if (/(舒服|放松|温馨)/.test(note)) {
    return "HOOK-07";
  }
  if (previousHook === "discovery") {
    if (input.hasDishes) return "HOOK-06";
    return variant % 2 === 0 ? "HOOK-07" : "HOOK-02";
  }
  if (previousHook === "food") {
    return variant % 2 === 0 ? "HOOK-07" : "HOOK-03";
  }

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

HOOK FAMILIES — pick from evidence after the coverTitle keyword + one-evidence subtitle rules are satisfied. Do not copy these exact sentences:
HOOK-01 Search keyword is SEO only: weave 曼谷/泰餐/美食 into an experience hook. Never output 曼谷美食发现 / 曼谷泰餐推荐 / 曼谷美食推荐 as the whole cover.
HOOK-02 Adjective only if the meal supports it, prefer it in subTitle as the ONE core reason
HOOK-03 Reaction belongs in subTitle, not as a 3-character mainTitle. Do not invent 让人惊艳. Person/service facts from the dining note belong here.
HOOK-04 Soft CTA lives in caption
HOOK-05 Local identity ONLY with evidence. Never invent 泰国人爱吃.
HOOK-06 Dish-led subtitle from a real selected dish or the dining note, using the approved cover short (冬阴功 not 河虾冬阴功汤; 青柠蒸鲈鱼 not 鲈鱼). Prefer a curiosity/scene hook over 菜名+很好吃. One dish reason only — never glue dish + price + first-visit. Use this when the dining note is actually about food.
HOOK-07 Warm home-style / comfortable atmosphere in subTitle when the note supports it
HOOK-08 Location or mall-stop in the title only when it is the hook, e.g. 逛街后来吃. Never force centralwOrld.

DIVERSITY: do not repeat the previous coverTitle/subTitle formula. Changing only 推荐/泰菜 is NOT enough. Discovery is one family among many — never the default.`;
}
