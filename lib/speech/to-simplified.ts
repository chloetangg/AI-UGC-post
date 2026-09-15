import { Converter } from "opencc-js";

const toSimplified = Converter({ from: "t", to: "cn" });

export function hasChineseCharacters(text: string) {
  return /[\u3400-\u9fff]/.test(text);
}

/** Character conversion only — does not rewrite the spoken wording. */
export function toSimplifiedChinese(text: string) {
  return toSimplified(text);
}

export function simplifyChineseIfPresent(text: string) {
  return hasChineseCharacters(text) ? toSimplifiedChinese(text) : text;
}
