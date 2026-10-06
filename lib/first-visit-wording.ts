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

/** True only when the customer themselves said this was a first Thai meal. */
export function customerSaidFirstThaiMeal(note: string) {
  return /第一次吃泰餐|第一次吃泰国菜|第一次尝试泰国菜|第一次尝试泰餐|第一次品尝泰餐|第一次吃到泰餐|从来没吃过泰餐|没吃过泰餐|第一顿泰餐|第一餐泰餐|first time trying Thai|first Thai meal|never (?:had|eaten|tried) Thai/i.test(
    note,
  );
}

const UNSUPPORTED_FIRST_THAI: Array<[RegExp, string]> = [
  [/第一次来曼谷吃泰餐/g, "来曼谷吃泰餐"],
  [/到曼谷第一餐泰餐/g, "来曼谷吃泰餐"],
  [/曼谷第一餐泰餐/g, "来曼谷吃泰餐"],
  [/第一次尝试泰国菜/g, "这次尝试泰国菜"],
  [/第一次尝试泰餐/g, "这次尝试泰餐"],
  [/第一次品尝泰餐/g, "这次吃泰餐"],
  [/第一次吃到泰餐/g, "这次吃到泰餐"],
  [/第一次吃泰国菜/g, "这次吃泰国菜"],
  [/第一次吃泰餐/g, "这次吃泰餐"],
  [/从来没吃过泰餐/g, "这次吃泰餐"],
  [/没吃过泰餐/g, "这次吃泰餐"],
  [/第一顿泰餐/g, "这顿泰餐"],
  [/第一餐泰餐/g, "这顿泰餐"],
];

/** visitFrequency = 1st time is first time at Baan Ying, not a first Thai meal. */
export function stripUnsupportedFirstThaiMeal(text: string, note = "") {
  if (!text || customerSaidFirstThaiMeal(note)) return text;
  let next = text;
  for (const [pattern, replacement] of UNSUPPORTED_FIRST_THAI) {
    next = next.replace(pattern, replacement);
  }
  return next;
}
