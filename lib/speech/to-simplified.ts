import { Converter } from "opencc-js";

const toSimplified = Converter({ from: "t", to: "cn" });

/** Character conversion only — does not rewrite the spoken wording. */
export function toSimplifiedChinese(text: string) {
  return toSimplified(text);
}
