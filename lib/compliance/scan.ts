import {
  allPhraseRules,
  COMPILED_SEMANTIC_PATTERNS,
  REQUIRED_SAFE_HASHTAGS,
  type ComplianceCategory,
} from "./lexicon";
import { findHarshNegativeHits, NEGATIVE_FEEDBACK_CATEGORY } from "./negative-feedback";

export type ComplianceField =
  | "title"
  | "caption"
  | "hashtag"
  | "coverTitle"
  | "coverSubtitle"
  | "angle"
  | "generic";

export type ComplianceHit = {
  field: ComplianceField;
  phrase: string;
  category: ComplianceCategory;
  replacement: string;
};

export type ScanOptions = {
  field?: ComplianceField;
  allowExact?: string[];
};

function defaultAllowlist(field?: ComplianceField) {
  if (field === "hashtag") return [...REQUIRED_SAFE_HASHTAGS];
  return [] as string[];
}

const COVER_ALLOWED_PHRASES = new Set(["必吃", "曼谷必吃", "曼谷必吃泰餐"]);

function skipPhraseOnCover(field: ComplianceField, phrase: string) {
  return (field === "coverTitle" || field === "coverSubtitle") && COVER_ALLOWED_PHRASES.has(phrase);
}

function maskAllowlist(text: string, allow: string[]) {
  let masked = text;
  for (const item of [...allow].sort((a, b) => b.length - a.length)) {
    if (!item) continue;
    masked = masked.split(item).join("\u0001".repeat(item.length));
  }
  return masked;
}

export function scanCompliance(text: string, options: ScanOptions = {}): ComplianceHit[] {
  const field = options.field ?? "generic";
  const allow = [...defaultAllowlist(field), ...(options.allowExact ?? [])];
  const masked = maskAllowlist(text, allow);
  const hits: ComplianceHit[] = [];
  const seen = new Set<string>();

  for (const rule of allPhraseRules()) {
    if (skipPhraseOnCover(field, rule.phrase)) continue;
    if (!rule.phrase || !masked.includes(rule.phrase)) continue;
    const key = `${rule.category}:${rule.phrase}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      field,
      phrase: rule.phrase,
      category: rule.category,
      replacement: rule.replacement,
    });
  }

  for (const rule of COMPILED_SEMANTIC_PATTERNS) {
    rule.pattern.lastIndex = 0;
    const match = rule.pattern.exec(masked);
    if (!match?.[0]) continue;
    const key = `${rule.category}:${match[0]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      field,
      phrase: match[0],
      category: rule.category,
      replacement: rule.replacement,
    });
  }

  for (const hit of findHarshNegativeHits(masked)) {
    const key = `${NEGATIVE_FEEDBACK_CATEGORY}:${hit.phrase}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({
      field,
      phrase: hit.phrase,
      category: NEGATIVE_FEEDBACK_CATEGORY,
      replacement: hit.replacement,
    });
  }

  return hits;
}

export function isCompliantText(text: string, options: ScanOptions = {}) {
  return scanCompliance(text, options).length === 0;
}
