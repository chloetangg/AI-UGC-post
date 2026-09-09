import type {
  ContentStrategyLibrary,
  SelectedContentStrategy,
  StrategyEvidence,
  StrategySelectionHistory,
} from "@/lib/content-strategy/types";

type Signals = {
  tourist: boolean;
  local: boolean;
  firstVisit: boolean;
  lightRepeat: boolean;
  confirmedRepeat: boolean;
  hasDishes: boolean;
  dishCount: number;
  authentic: boolean;
  comfort: boolean;
  heritage: boolean;
  friends: boolean;
  family: boolean;
  sharing: boolean;
  shopping: boolean;
  shoppingMention: boolean;
  travel: boolean;
  travelMention: boolean;
  mallBranch: boolean;
  returnIntent: boolean;
  approachable: boolean;
  everyday: boolean;
  tasteWords: boolean;
  photoCount: number;
};

const FRIEND_RE = /朋友|好友|闺蜜|同事|一起吃|聚餐|friend|friends|together/i;
const FAMILY_RE = /家人|家庭|爸妈|父母|孩子|family/i;
const SHARE_RE = /分享|一起点|拼桌|sharing/i;
const SHOP_RE = /逛街|商场|购物|shopping|mall/i;
const TRAVEL_RE = /旅行|旅游|出差|itinerary|sightseeing|trip|travel/i;
const AUTH_RE = /正宗|地道|传统|authentic|traditional/i;
const COMFORT_RE = /家常|舒服|舒适|温暖|安心|comfort|home-?style|warm/i;
const HERITAGE_RE = /家传|祖传|传承|老店|1999|auntie|ying|siam square|heritage|family recipe/i;
const RETURN_RE = /下次还|还会来|再来|回头|常来|return|revisit|again/i;
const EASY_RE = /好入口|不难吃|容易点|好选|easy|approachable|beginner/i;
const OCCASION_RE = /生日|纪念日|求婚|celebration|birthday|anniversary/i;

function unique(ids: string[]) {
  return [...new Set(ids.filter(Boolean))];
}

function noteText(input: StrategyEvidence) {
  return `${input.diningExperienceNote ?? ""} ${input.recommendedDishOther ?? ""}`.trim();
}

export function readStrategySignals(input: StrategyEvidence): Signals {
  const note = noteText(input);
  const enjoy = new Set(input.enjoyMost ?? []);
  const reasons = new Set((input.recommendTo ?? []).map((item) => item.toLowerCase()));
  const dishes = (input.recommendedDishes ?? []).filter((dish) => dish && dish !== "Others");
  const extraDish = Boolean(input.recommendedDishOther?.trim());
  const dishCount = dishes.length + (extraDish ? 1 : 0);
  const mallBranch = Boolean(input.branch && input.branch !== "Baan Ying");
  const tourist = input.customerType === "Tourist";
  const local = input.customerType === "Local";
  const firstVisit = input.visitFrequency === "1st time";
  const lightRepeat = input.visitFrequency === "Not first time";
  const confirmedRepeat = false;
  const friends = FRIEND_RE.test(note);
  const family = FAMILY_RE.test(note);
  const sharing =
    friends ||
    family ||
    SHARE_RE.test(note) ||
    enjoy.has("The variety of dishes");
  const shoppingMention = SHOP_RE.test(note);
  const travelMention = TRAVEL_RE.test(note);
  const shopping = mallBranch || shoppingMention;
  const travel = tourist || travelMention;
  const authentic =
    reasons.has("authentic") || AUTH_RE.test(note) || enjoy.has("The food") || enjoy.has("The flavors");
  const comfort =
    COMFORT_RE.test(note) ||
    enjoy.has("The restaurant atmosphere") ||
    enjoy.has("The overall experience") ||
    enjoy.has("The service");
  const heritage = HERITAGE_RE.test(note);
  const returnIntent = confirmedRepeat || RETURN_RE.test(note);
  const approachable = firstVisit || EASY_RE.test(note);
  const everyday = !OCCASION_RE.test(note) && !confirmedRepeat && !friends && !family;
  const tasteWords = (input.recommendTo ?? []).length > 0 || enjoy.has("The flavors");

  return {
    tourist,
    local,
    firstVisit,
    lightRepeat,
    confirmedRepeat,
    hasDishes: dishCount > 0,
    dishCount,
    authentic,
    comfort,
    heritage,
    friends,
    family,
    sharing,
    shopping,
    shoppingMention,
    travel,
    travelMention,
    mallBranch,
    returnIntent,
    approachable,
    everyday,
    tasteWords,
    photoCount: input.photoCount || 0,
  };
}

function scoreKsp(id: string, s: Signals, variantIndex: number): number {
  switch (id) {
    case "KSP-01":
      return (
        (s.authentic ? 4 : 2) +
        (s.tourist || s.firstVisit ? 3 : 0) +
        (s.tourist && s.firstVisit ? 3 : 0) +
        (s.hasDishes ? 1 : 0)
      );
    case "KSP-02":
      return (s.comfort ? 5 : 0) + (s.everyday ? 1 : 0);
    case "KSP-03":
      if (s.heritage) return 6;
      if (variantIndex % 11 === 10 && s.comfort) return 2;
      return -8;
    case "KSP-04":
      return s.hasDishes ? 4 + s.dishCount * 2 + (s.tasteWords ? 2 : 0) : -6;
    case "KSP-05":
      return (s.friends ? 8 : 0) + (s.family ? 6 : 0) + (s.sharing && !s.friends && !s.family ? 2 : 0);
    case "KSP-06":
      return (
        (s.travelMention ? 5 : s.tourist ? 1 : 0) +
        (s.shoppingMention ? 5 : 0) +
        (s.mallBranch && (s.travelMention || s.shoppingMention) ? 2 : 0)
      );
    case "KSP-07":
      return s.mallBranch ? 3 + (s.shopping ? 1 : 0) : -4;
    case "KSP-08":
      return s.everyday && !s.hasDishes ? 5 : s.everyday ? 3 : 1;
    case "KSP-09":
      return (s.firstVisit ? 4 : 0) + (s.approachable ? 2 : 0) + (s.tourist && s.firstVisit ? 2 : 0);
    case "KSP-10":
      return s.confirmedRepeat ? 8 : s.returnIntent ? 5 : -6;
    default:
      return 0;
  }
}

function scoreStoryline(id: string, s: Signals): number {
  switch (id) {
    case "ST-01":
      return (s.firstVisit || s.tourist ? 4 : 1) + (s.hasDishes ? 1 : 0);
    case "ST-02":
      return s.hasDishes ? 5 + s.dishCount : -3;
    case "ST-03":
      return s.comfort || s.family ? 4 : 0;
    case "ST-04":
      return (s.shopping || s.travel ? 5 : 0) + (s.mallBranch ? 2 : 0);
    case "ST-05":
      return s.friends || s.family ? 6 : -4;
    case "ST-06":
      return s.confirmedRepeat || s.returnIntent ? 6 : s.firstVisit && s.hasDishes ? 2 : -2;
    case "ST-07":
      return s.tourist || s.local ? 3 : 1;
    case "ST-08":
      return s.hasDishes || s.sharing ? 4 : 0;
    case "ST-09":
      return s.everyday ? 5 : 2;
    case "ST-10":
      return s.travel || s.tourist ? 4 : 1;
    default:
      return 0;
  }
}

function scoreAngle(id: string, s: Signals): number {
  switch (id) {
    case "CA-01":
      return s.firstVisit || s.lightRepeat ? 5 : s.confirmedRepeat ? -8 : 1;
    case "CA-02":
      return s.hasDishes ? 6 : -8;
    case "CA-03":
      return s.tasteWords || s.hasDishes ? 5 : 0;
    case "CA-04":
      return s.tourist ? 6 : -8;
    case "CA-05":
      return s.local ? 6 : -8;
    case "CA-06":
      return s.confirmedRepeat ? 8 : s.returnIntent ? 3 : -8;
    case "CA-07":
      return s.friends ? 8 : -8;
    case "CA-08":
      return s.family ? 8 : -8;
    case "CA-09":
      return s.travel && (s.shopping || s.mallBranch) ? 7 : s.travel ? 3 : -4;
    case "CA-10":
      return 3 + (s.hasDishes ? 1 : 0);
    case "CA-11":
      return s.everyday ? 5 : 2;
    case "CA-12":
      return s.travel || s.tourist ? 4 : 1;
    default:
      return 0;
  }
}

function pickScored(
  ids: string[],
  scoreOf: (id: string) => number,
  previous: string | undefined,
  variantIndex: number,
) {
  const eligible = ids.filter((id) => scoreOf(id) > -5);
  const pool = eligible.length > 0 ? eligible : ids;
  const withoutPrevious = previous && pool.length > 1 ? pool.filter((id) => id !== previous) : pool;
  const ranked = [...withoutPrevious].sort((a, b) => {
    const diff = scoreOf(b) - scoreOf(a);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
  if (ranked.length === 0) return ids[0] ?? "";
  if (ranked.length === 1) return ranked[0];
  const topScore = scoreOf(ranked[0]);
  const tied = ranked.filter((id) => scoreOf(id) === topScore);
  return tied[variantIndex % tied.length] ?? ranked[0];
}

function pickKeyword(
  library: ContentStrategyLibrary,
  storylineId: string,
  angleId: string,
  previousKeywords: string[] = [],
  variantIndex = 0,
) {
  const mapped =
    library.compatibility.storylineAngleToKeywords[`${storylineId}+${angleId}`] ??
    library.searchKeywords.primary;
  const previous = new Set(previousKeywords.filter(Boolean));
  const fresh = mapped.filter((keyword) => !previous.has(keyword));
  const pool = fresh.length > 0 ? fresh : mapped;
  return pool[variantIndex % pool.length] ?? library.searchKeywords.primary[0] ?? "曼谷美食";
}

export function eligibleKspIds(library: ContentStrategyLibrary, input: StrategyEvidence) {
  const signals = readStrategySignals(input);
  return library.ksps
    .map((item) => item.id)
    .filter((id) => scoreKsp(id, signals, input.variantIndex) > -5);
}

export function pickSuggestedStrategy(
  library: ContentStrategyLibrary,
  input: StrategyEvidence,
  history: StrategySelectionHistory = {},
): SelectedContentStrategy {
  const signals = readStrategySignals(input);
  const kspId = pickScored(
    library.ksps.map((item) => item.id),
    (id) => scoreKsp(id, signals, input.variantIndex),
    history.previousKspId,
    input.variantIndex,
  );
  const preferredStorylines = library.compatibility.kspToStorylines[kspId] ?? library.storylines.map((item) => item.id);
  const storylineId = pickScored(
    unique(preferredStorylines),
    (id) => scoreStoryline(id, signals),
    history.previousStorylineId,
    input.variantIndex,
  );
  const preferredAngles =
    library.compatibility.storylineToAngles[storylineId] ?? library.contentAngles.map((item) => item.id);
  const contentAngleId = pickScored(
    unique(preferredAngles),
    (id) => scoreAngle(id, signals),
    history.previousContentAngleId,
    input.variantIndex,
  );
  const searchKeyword = pickKeyword(
    library,
    storylineId,
    contentAngleId,
    history.previousTitleKeywords ?? (history.previousSearchKeyword ? [history.previousSearchKeyword] : []),
    input.variantIndex,
  );

  return { kspId, storylineId, contentAngleId, searchKeyword };
}

export function resolveStrategySelection(
  library: ContentStrategyLibrary,
  suggested: SelectedContentStrategy,
  actual?: Partial<SelectedContentStrategy>,
): SelectedContentStrategy {
  const kspIds = new Set(library.ksps.map((item) => item.id));
  const storylineIds = new Set(library.storylines.map((item) => item.id));
  const angleIds = new Set(library.contentAngles.map((item) => item.id));
  const keywords = new Set([...library.searchKeywords.primary, ...library.searchKeywords.secondary]);

  return {
    kspId: actual?.kspId && kspIds.has(actual.kspId) ? actual.kspId : suggested.kspId,
    storylineId:
      actual?.storylineId && storylineIds.has(actual.storylineId) ? actual.storylineId : suggested.storylineId,
    contentAngleId:
      actual?.contentAngleId && angleIds.has(actual.contentAngleId)
        ? actual.contentAngleId
        : suggested.contentAngleId,
    searchKeyword:
      actual?.searchKeyword && keywords.has(actual.searchKeyword)
        ? actual.searchKeyword
        : suggested.searchKeyword,
  };
}

export function photoSelectionHint(contentAngleId: string) {
  switch (contentAngleId) {
    case "CA-02":
    case "CA-03":
      return "Prefer a strong food close-up if one exists. Do not invent plating.";
    case "CA-07":
    case "CA-08":
      return "Prefer a group / table photo if one exists. Do not invent companions.";
    case "CA-09":
    case "CA-04":
      return "A wider scene or contextual photo is allowed if it exists. Do not invent interiors or crowds.";
    default:
      return "Pick the strongest real cover photo among the uploads. Do not invent photo content.";
  }
}
