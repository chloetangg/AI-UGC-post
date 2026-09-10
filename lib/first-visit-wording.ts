const ADVENTURE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/开启了?(?:我的)?第一次美食冒险(?:之旅)?/g, "第一次来尝试Baan Ying"],
  [/第一次美食冒险(?:之旅)?/g, "第一次来尝试Baan Ying"],
  [/第一次味蕾冒险(?:之旅)?/g, "第一次来尝试Baan Ying"],
  [/第一次泰餐冒险(?:之旅)?/g, "第一次来尝试Baan Ying"],
  [/第一次美食探险(?:之旅)?/g, "第一次来尝试Baan Ying"],
  [/第一次冒险(?:之旅)?/g, "第一次来尝试Baan Ying"],
  [/(?:一场)?美食冒险(?:之旅)?/g, "来尝试Baan Ying"],
  [/(?:一场)?味蕾冒险(?:之旅)?/g, "来尝试Baan Ying"],
  [/(?:一场)?泰餐冒险(?:之旅)?/g, "来尝试Baan Ying"],
  [/(?:一场)?美食探险(?:之旅)?/g, "来尝试Baan Ying"],
];

/** First-visit copy should say 第一次来尝试Baan Ying, not a food-adventure metaphor. */
export function rewriteFirstVisitWording(text: string) {
  let next = text;
  for (const [pattern, replacement] of ADVENTURE_REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  return next;
}
