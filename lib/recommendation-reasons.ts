import {
  type RecommendedDish,
  type MealExpenseRange,
  MEAL_EXPENSE_RANGES,
} from "@/types/content";

export const DISH_RECOMMENDATION_REASONS = {
  "Crab Meat Curry": ["蟹肉咖喱味道很浓郁", "蟹肉咖喱很下饭", "蟹肉咖喱份量很足"],
  "Stir-Fried Morning Glory": ["炒空心菜很脆甜", "炒空心菜有点辣辣的风味", "炒空心菜味道和平常家里的不一样"],
  "Mango Sticky Rice": ["芒果糯米饭芒果很新鲜", "芒果糯米饭粘度适中", "芒果糯米饭香甜可口"],
  "River Prawn Tom Yum": ["河虾冬阴功汤大头虾大只量足", "河虾冬阴功汤浓浓的奶香味", "河虾冬阴功汤河虾很新鲜"],
  "Garlic Shrimp Egg Rice": ["蒜炒虾仁滑蛋饭虾仁Q弹", "蒜炒虾仁滑蛋饭超级香，风味十足", "蒜炒虾仁滑蛋饭搭配蒜很有层次感"],
  "Curry Crab Claws": ["咖喱蟹脚很下饭", "咖喱蟹脚很新鲜", "咖喱蟹脚量超足"],
  "Sweet and Sour River Prawns": ["酸甜酱炒河虾味道搭配均衡", "酸甜酱炒河虾酱料很下饭", "酸甜酱炒河虾虾个头很大"],
  "Green Curry Beef": ["青咖喱牛肉很浓郁正宗", "青咖喱牛肉很软烂", "青咖喱牛肉很香很下饭"],
  "Pineapple Fried Rice": ["菠萝炒饭很香有锅气", "菠萝炒饭配料很足", "菠萝炒饭菠萝很清爽解腻"],
  "Lemon Sea Bass": ["柠檬鲈鱼特别开胃", "柠檬鲈鱼刺少好吃", "柠檬鲈鱼做法很特别"],
} as const satisfies Record<Exclude<RecommendedDish, "Others">, readonly [string, string, string]>;

export type RecommendationReason =
  (typeof DISH_RECOMMENDATION_REASONS)[keyof typeof DISH_RECOMMENDATION_REASONS][number];

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
  return reasons.filter((reason) => allowed.has(reason));
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
