import {
  type RecommendedDish,
  type MealExpenseRange,
  MEAL_EXPENSE_RANGES,
} from "@/types/content";

export const DISH_RECOMMENDATION_REASONS = {
  "Crab Meat Curry": ["咖喱蟹肉味道很浓郁", "咖喱蟹肉很下饭", "咖喱蟹肉份量很足"],
  "Stir-Fried Morning Glory": ["炒空心菜很脆甜", "炒空心菜微辣很清新", "炒空心菜有放虾酱，吃起来很特别"],
  "Mango Sticky Rice": ["芒果糯米饭芒果很新鲜", "芒果糯米饭粘度适中", "芒果糯米饭香甜可口"],
  "River Prawn Tom Yum": ["河虾冬阴功汤大头虾大只量足", "河虾冬阴功汤浓浓的奶香味", "河虾冬阴功汤河虾很新鲜"],
  "Scrambled Egg Rice": ["滑蛋饭很嫩滑", "滑蛋饭适合儿童", "滑蛋饭可以DIY配料"],
  "Garlic Shrimp": ["蒜炒虾仁很Q弹", "蒜炒虾仁蒜香味很足", "蒜炒虾仁蒜沫酥脆可口"],
  "Sweet and Sour River Prawns": ["酸甜酱炒河虾味道搭配均衡", "酸甜酱炒河虾酱料很下饭", "酸甜酱炒河虾虾个头很大"],
  "Green Curry Beef": ["青咖喱牛肉椰香味很足", "青咖喱牛肉辣度后劲足，但不腻口", "青咖喱牛肉很香很下饭"],
  "Pineapple Fried Rice": ["菠萝炒饭很香有锅气", "菠萝炒饭配料很足", "菠萝炒饭菠萝很清爽解腻"],
  "Lemon Sea Bass": ["青柠蒸鲈鱼特别开胃", "青柠蒸鲈鱼刺少好吃", "青柠蒸鲈鱼酱料搭配鱼肉很好吃"],
} as const satisfies Record<Exclude<RecommendedDish, "Others">, readonly [string, string, string]>;

export type RecommendationReason =
  (typeof DISH_RECOMMENDATION_REASONS)[keyof typeof DISH_RECOMMENDATION_REASONS][number];

export const RECOMMENDATION_REASON_OTHER = "其他";

const RECOMMENDATION_REASON_SET = new Set<string>(
  Object.values(DISH_RECOMMENDATION_REASONS).flat(),
);

export function isRecommendationReason(value: string): value is RecommendationReason {
  return RECOMMENDATION_REASON_SET.has(value);
}

export function reasonsForDish(dish: RecommendedDish) {
  if (dish === "Others") return [] as const;
  return DISH_RECOMMENDATION_REASONS[dish];
}

export function allowedRecommendationReasons(dishes: RecommendedDish[]) {
  const allowed = new Set<string>();
  for (const dish of dishes) {
    if (dish === "Others") continue;
    for (const reason of DISH_RECOMMENDATION_REASONS[dish]) allowed.add(reason);
  }
  return allowed;
}

export function pruneRecommendationReasons(reasons: string[], dishes: RecommendedDish[]) {
  const allowed = allowedRecommendationReasons(dishes);
  return reasons.filter((reason) => reason === RECOMMENDATION_REASON_OTHER || allowed.has(reason));
}

export function isMealExpenseRange(value: string): value is MealExpenseRange {
  return (MEAL_EXPENSE_RANGES as readonly string[]).includes(value);
}

export function midpointForMealExpenseRange(range: MealExpenseRange) {
  if (range === "฿2,000+") return 2000;
  const [start, end] = range
    .replace(/฿/g, "")
    .replace(/,/g, "")
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  if (!Number.isFinite(start) || !Number.isFinite(end)) return start || 0;
  return Math.round((start + end) / 2);
}
