/**
 * Shared cover-subtitle pipeline for every branch.
 * It only reads the review string passed in. It does not load another branch's data
 * and it does not write back to the stored customer review.
 */

export type SubtitleInvalidReason =
  | "INVALID_EMPTY"
  | "INVALID_LENGTH"
  | "INVALID_MULTIPLE_REVIEWS"
  | "INVALID_TRUNCATED";

export type SubtitleValidation =
  | { ok: true }
  | { ok: false; reason: SubtitleInvalidReason };

const SAFE_SUBTITLE = "这顿吃下来很满足";
const MIN_COMPLETE_UNIT = 4;
const MIN_FREE_SUBTITLE = 6;
const MAX_SUBTITLE = 15;

/** Longer phrases first so 真的很好吃 wins over 很好吃. */
const PREDICATES = [
  "老板娘长得很漂亮",
  "店员服务很好",
  "真的很好吃",
  "真的很好喝",
  "想再回来吃",
  "环境很舒服",
  "服务也很好",
  "长得很漂亮",
  "也很好吃",
  "也很好喝",
  "服务很好",
  "价格合理",
  "很好吃",
  "很好喝",
  "也好吃",
  "也好喝",
  "很喜欢",
  "很舒服",
  "很漂亮",
  "想再来",
  "很帅",
];

type Split = { units: string[]; remainder: string };

function clean(text: string) {
  return text.replace(/\s+/g, "").trim();
}

function lengthUnits(text: string) {
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const rest = text.replace(/\p{Script=Han}/gu, "").replace(/\s/g, "");
  return han + Math.ceil(rest.length / 2);
}

function earliestPredicate(text: string) {
  let index = -1;
  let predicate = "";
  for (const item of PREDICATES) {
    const found = text.indexOf(item);
    if (found < 0) continue;
    if (index < 0 || found < index || (found === index && item.length > predicate.length)) {
      index = found;
      predicate = item;
    }
  }
  return { index, predicate };
}

function splitChunk(chunk: string): Split {
  const units: string[] = [];
  let rest = chunk;
  while (rest) {
    const { index, predicate } = earliestPredicate(rest);
    if (index < 0) return { units, remainder: rest };
    const unit = rest.slice(0, index + predicate.length).trim();
    if (unit) units.push(unit);
    rest = rest.slice(index + predicate.length);
  }
  return { units, remainder: "" };
}

function subjectBeforePredicate(unit: string) {
  for (const predicate of PREDICATES) {
    if (unit.endsWith(predicate)) return unit.slice(0, unit.length - predicate.length);
  }
  return "";
}

function isClippedSubject(unit: string) {
  const subject = subjectBeforePredicate(unit);
  return subject.length === 1;
}

/** Split an unpunctuated review into independent evaluation units. Does not edit the source. */
export function parseReviewIntoEvaluationUnits(text: string) {
  const cleaned = clean(text);
  if (!cleaned) return [];
  const chunks = cleaned.split(/[。！？!?\n；;，,、]+/).filter(Boolean);
  const units: string[] = [];
  for (const chunk of chunks) {
    const split = splitChunk(chunk);
    if (split.units.length > 0 && split.remainder.length < 2) {
      units.push(...split.units);
      continue;
    }
    if (split.units.length > 0) {
      units.push(...split.units);
      if (split.remainder) units.push(split.remainder);
      continue;
    }
    units.push(chunk);
  }
  return units;
}

function analyze(text: string): Split & { consumed: boolean } {
  const cleaned = clean(text);
  if (!cleaned) return { units: [], remainder: "", consumed: true };
  const chunks = cleaned.split(/[。！？!?\n；;，,、]+/).filter(Boolean);
  if (chunks.length > 1) {
    const units = chunks.flatMap((chunk) => {
      const split = splitChunk(chunk);
      if (split.units.length === 0) return [chunk];
      return split.remainder.length >= 2 ? [...split.units, split.remainder] : split.units;
    });
    return { units, remainder: "", consumed: true };
  }
  const split = splitChunk(cleaned);
  if (split.units.length === 0) return { units: [cleaned], remainder: "", consumed: true };
  return { ...split, consumed: split.remainder.length < 2 };
}

function naturalizeUnit(unit: string) {
  if (lengthUnits(unit) >= MIN_FREE_SUBTITLE && !isClippedSubject(unit)) return unit;
  if (/好吃/.test(unit)) return "这顿真的很好吃";
  if (/好喝/.test(unit)) return "这杯真的很好喝";
  if (/喜欢/.test(unit)) return "真的很喜欢这家";
  if (/再回|再来/.test(unit)) return "已经想再回来吃";
  if (/服务|店员/.test(unit)) return "服务真的很好";
  if (/老板娘/.test(unit) && /漂亮/.test(unit)) return "老板娘长得很漂亮";
  if (/老板/.test(unit) && /帅/.test(unit)) return "老板真的很帅";
  if (/舒服|环境/.test(unit)) return "环境真的很舒服";
  return "";
}

function specificity(unit: string) {
  if (/老板娘|老板|粉红奶|泰奶|冬阴功|芒果|环境|服务|店员/.test(unit)) return 0;
  if (/^食物/.test(unit)) return 2;
  return 1;
}

/** One candidate per independent evaluation, plus a same-core naturalization when the unit is too short. */
export function generateSubtitleCandidates(note: string) {
  const units = parseReviewIntoEvaluationUnits(note);
  const candidates: string[] = [];
  for (const unit of units) {
    candidates.push(unit);
    const natural = naturalizeUnit(unit);
    if (natural && natural !== unit) candidates.push(natural);
  }
  return candidates;
}

function shavedFromSource(subtitle: string, source: string) {
  const sourceUnits = parseReviewIntoEvaluationUnits(source);
  if (sourceUnits.includes(subtitle)) return false;
  const cleanedSource = clean(source);
  if (cleanedSource.includes(subtitle) && subtitle !== cleanedSource && subtitle.length + 2 >= cleanedSource.length) {
    return true;
  }
  return sourceUnits.some(
    (unit) => unit.includes(subtitle) && unit !== subtitle && subtitle.length + 2 >= unit.length,
  );
}

export function validateSubtitleCandidate(subtitle: string, source = ""): SubtitleValidation {
  const cleaned = clean(subtitle);
  if (!cleaned) return { ok: false, reason: "INVALID_EMPTY" };
  const parsed = analyze(cleaned);
  if (!parsed.consumed || parsed.units.length !== 1) {
    return { ok: false, reason: "INVALID_MULTIPLE_REVIEWS" };
  }
  const unit = parsed.units[0] ?? "";
  if (unit !== cleaned) return { ok: false, reason: "INVALID_MULTIPLE_REVIEWS" };
  if (isClippedSubject(unit) || (source && shavedFromSource(cleaned, source))) {
    return { ok: false, reason: "INVALID_TRUNCATED" };
  }
  const units = lengthUnits(cleaned);
  const completePredicate = Boolean(subjectBeforePredicate(cleaned) || PREDICATES.some((item) => cleaned === item || cleaned.endsWith(item)));
  const min = completePredicate ? MIN_COMPLETE_UNIT : MIN_FREE_SUBTITLE;
  if (units < min || units > MAX_SUBTITLE) return { ok: false, reason: "INVALID_LENGTH" };
  return { ok: true };
}

export function finalValidateCoverSubtitle(subtitle: string, source = ""): SubtitleValidation {
  return validateSubtitleCandidate(subtitle, source);
}

export function selectOneValidSubtitle(input: { note?: string; preferred?: string; extras?: string[] } = {}) {
  const note = input.note?.trim() ?? "";
  const ranked = generateSubtitleCandidates(note)
    .map((item, index) => ({ item, index }))
    .sort((a, b) => specificity(a.item) - specificity(b.item) || a.index - b.index)
    .map((item) => item.item);
  const pool = [input.preferred ?? "", ...ranked, ...(input.extras ?? []), SAFE_SUBTITLE];
  for (const item of pool) {
    if (finalValidateCoverSubtitle(item, note).ok) return clean(item);
  }
  return SAFE_SUBTITLE;
}
