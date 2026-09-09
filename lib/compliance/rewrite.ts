import { allPhraseRules, COMPILED_SEMANTIC_PATTERNS, REQUIRED_SAFE_HASHTAGS } from "./lexicon";
import { neutralizeHarshNegatives } from "./negative-feedback";
import { scanCompliance, type ComplianceField } from "./scan";

const COVER_ALLOWED_PHRASES = new Set(["必吃", "曼谷必吃", "曼谷必吃泰餐"]);

function skipPhraseOnCover(field: ComplianceField, phrase: string) {
  return (field === "coverTitle" || field === "coverSubtitle") && COVER_ALLOWED_PHRASES.has(phrase);
}

function preserveRequiredHashtags<T>(text: string, fn: (input: string) => T): T {
  const tokens = REQUIRED_SAFE_HASHTAGS.map((tag, index) => {
    const placeholder = `\uE000${index}\uE000`;
    return { tag, placeholder };
  });
  let masked = text;
  for (const item of tokens) {
    masked = masked.split(item.tag).join(item.placeholder);
  }
  let next = fn(masked) as string;
  if (typeof next !== "string") return next;
  for (const item of tokens) {
    next = next.split(item.placeholder).join(item.tag);
  }
  return next as T;
}

export function rewriteCompliantText(text: string, field: ComplianceField = "generic") {
  if (!text) return text;
  const allowHashtags = field === "hashtag" || field === "caption";
  const apply = (input: string) => {
    let next = input;
    for (const rule of COMPILED_SEMANTIC_PATTERNS) {
      next = next.replace(rule.pattern, rule.replacement);
    }
    for (const rule of allPhraseRules()) {
      if (!rule.phrase) continue;
      if (skipPhraseOnCover(field, rule.phrase)) continue;
      next = next.split(rule.phrase).join(rule.replacement);
    }
    next = neutralizeHarshNegatives(next);
    return next;
  };
  const rewritten = allowHashtags ? preserveRequiredHashtags(text, apply) : apply(text);
  const still = scanCompliance(rewritten, { field });
  if (still.length === 0) return rewritten;
  let fallback = rewritten;
  for (const hit of still) {
    fallback = fallback.split(hit.phrase).join(hit.replacement || "比较喜欢");
  }
  return fallback;
}

export function rewriteHashtag(tag: string) {
  const formatted = tag.startsWith("#") ? tag : `#${tag}`;
  if ((REQUIRED_SAFE_HASHTAGS as readonly string[]).includes(formatted)) return formatted;
  const rewritten = rewriteCompliantText(formatted.replace(/^#/, ""), "hashtag");
  const cleaned = rewritten.replace(/\s+/g, "");
  return cleaned ? `#${cleaned.replace(/^#/, "")}` : "";
}
