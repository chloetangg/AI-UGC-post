/**
 * Evidence order for copy repair: the customer's own note, then the dishes and reasons they selected,
 * then questionnaire tags. A tag never speaks over the note, and a selected dish is not a taste review.
 */
export type EvidenceSource = "note" | "selection" | "tag";

export type NoteAspect = "food" | "service" | "atmosphere";

export const EVIDENCE_SOURCE_RANK: Record<EvidenceSource, number> = { note: 0, selection: 1, tag: 2 };

const NEGATIVE_CUE =
  /(?:不太|不怎么|不够|不是很|不算|没那么|没有那么|不)(?:好吃|好喝|好|新鲜|正宗|合口味|入味|热情|周到|耐心|礼貌|舒服|干净|满意|推荐)|难吃|一般|普通|(?<!不)差(?!不多)|(?<![慢不])慢(?!慢)|(?<!不)(?<!不会)(?<!不觉得)(?<!不会觉得)(?:吵|挤)|拥挤|脏|闷|失望|踩雷|(?<!不会)(?<!不)太(?:酸|甜|咸|辣|油|淡|腻|贵|小|热|吵|挤|慢)|有点(?:酸|甜|咸|辣|油|淡|腻|贵|小|热|吵|挤|慢|闷)|偏(?:咸|油|贵)|拉肚子|头发|没有.{0,8}服务/;

const ASPECT_WORDS: Record<NoteAspect, RegExp> = {
  food: /好吃|好喝|难吃|味|酸|甜|咸|辣|油|淡|腻|新鲜|正宗|口感|入味|食物|食材|菜|汤|饭|咖喱|冬阴功|糯米|空心菜|鲈鱼|虾|蟹|拉肚子|头发|份量|分量/,
  service: /服务|店员|服务员|上菜|态度|等位|等了|催/,
  atmosphere: /环境|氛围|店里|座位|空间|装修|吵|挤|闷|脏|热|人多/,
};

const GENERAL_NEGATIVE = /一般|失望|踩雷|不满意|不推荐|不会再来|不值/;

export function isNegativeClause(text: string) {
  return NEGATIVE_CUE.test(text);
}

function noteClauses(note: string) {
  return note
    .split(/[。！？!?\n；;，,、]+|不过|但是|可是|但/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitEvidence(text: string) {
  return text
    .split(/[。！？!?\n，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Customer lines a headline repair may reuse word for word: the note without its negative clauses,
 * then reasons and tags the note does not contradict.
 */
export function headlineEvidenceLines(input: { note?: string; recommendTo?: string[]; enjoyMost?: string[] }) {
  const negative = negativeNoteAspects(input.note ?? "");
  const contradicted = (line: string) =>
    [...negative].some((aspect) => ASPECT_WORDS[aspect].test(line));
  return [
    ...splitEvidence(input.note ?? "").filter((line) => !isNegativeClause(line)),
    ...[...(input.recommendTo ?? []), ...(input.enjoyMost ?? [])].flatMap(splitEvidence).filter((line) => !contradicted(line)),
  ];
}

/** A reason or tag the note speaks against, e.g. 店员服务热情周到 after 服务有点慢. */
export function contradictsNote(line: string, note = "") {
  return [...negativeNoteAspects(note)].some((aspect) => ASPECT_WORDS[aspect].test(line));
}

/** The note without its complaint clauses, for rules that read the note as praise. */
export function positiveNoteText(note = "") {
  return noteClauses(note)
    .filter((clause) => !isNegativeClause(clause))
    .join("，");
}

/** The customer's own good word about the owner, the staff, or the room, e.g. 老板很帅 or 服务很好. */
export function noteExperienceLine(note = "") {
  const clauses = noteClauses(note).filter((clause) => !isNegativeClause(clause));
  return (
    clauses.find((clause) => /老板/.test(clause)) ??
    clauses.find(
      (clause) =>
        !ASPECT_WORDS.food.test(clause) &&
        (ASPECT_WORDS.service.test(clause) || ASPECT_WORDS.atmosphere.test(clause) || /舒服|放松|温馨|翻新|安静/.test(clause)),
    ) ??
    ""
  );
}

/** Parts of the visit the customer spoke about negatively. A general complaint covers every part. */
export function negativeNoteAspects(note = "") {
  const aspects = new Set<NoteAspect>();
  for (const clause of noteClauses(note)) {
    if (!isNegativeClause(clause)) continue;
    const hits = (Object.keys(ASPECT_WORDS) as NoteAspect[]).filter((aspect) => ASPECT_WORDS[aspect].test(clause));
    if (hits.length > 0) hits.forEach((aspect) => aspects.add(aspect));
    else if (GENERAL_NEGATIVE.test(clause)) (["food", "service", "atmosphere"] as const).forEach((aspect) => aspects.add(aspect));
  }
  return aspects;
}
