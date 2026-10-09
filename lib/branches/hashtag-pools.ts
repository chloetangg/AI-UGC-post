export const GENERIC_HASHTAGS = [
  "#泰国",
  "#泰国旅游",
  "#泰国旅游攻略",
  "#泰国美食",
  "#曼谷泰餐推荐",
  "#曼谷",
  "#曼谷美食",
  "#泰国菜",
  "#曼谷打卡",
  "#曼谷探店推荐",
  "#曼谷正宗泰餐",
  "#曼谷泰式家常菜",
  "#曼谷必吃",
] as const;

export const CENTRALWORLD_HASHTAGS = [
  "#centralworld",
  "#曼谷centralworld",
  "#centralworld美食",
  "#centralworld泰餐",
  "#centralworld泰餐推荐",
] as const;

export const SIAM_CENTER_HASHTAGS = [
  "#SiamCenter",
  "#曼谷SiamCenter",
  "#SiamCenter美食",
  "#SiamCenter泰餐",
  "#SiamCenter泰餐推荐",
] as const;

export function hashtagPoolForBranchId(branchId?: string) {
  if (branchId?.includes("siam")) return [...GENERIC_HASHTAGS, ...SIAM_CENTER_HASHTAGS];
  return [...GENERIC_HASHTAGS, ...CENTRALWORLD_HASHTAGS];
}
