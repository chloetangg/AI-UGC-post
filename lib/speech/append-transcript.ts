const CJK_CHAR = /[\u3400-\u9fff\uf900-\ufaff]/;
const PUNCT_CHAR = /[，。！？、,.!?;；：:…]/;

function lastChar(value: string) {
  return value.slice(-1);
}

function firstChar(value: string) {
  return value.slice(0, 1);
}

/** Append a spoken transcript to existing textarea text without overwriting it. */
export function appendSpokenText(existing: string, spoken: string) {
  const next = spoken.replace(/\s+/g, " ").trim();
  if (!next) return existing;

  const prev = existing.replace(/\s+$/u, "");
  if (!prev) return next;

  const prevTail = lastChar(prev);
  const nextHead = firstChar(next);

  if (PUNCT_CHAR.test(nextHead) || PUNCT_CHAR.test(prevTail)) {
    return `${prev}${next}`;
  }

  if (CJK_CHAR.test(prevTail) && CJK_CHAR.test(nextHead)) {
    return `${prev}，${next}`;
  }

  return `${prev} ${next}`;
}
