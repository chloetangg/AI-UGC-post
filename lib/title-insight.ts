const DISH =
  /粉红奶|芒果糯米饭|蒜炒虾仁|咖喱蟹肉|青咖喱牛肉|菠萝炒饭|滑蛋饭|河虾冬阴功汤|冬阴功|青柠蒸鲈鱼|炒空心菜|泰奶|[\p{Script=Han}]{2,6}(?:饭|奶|虾仁|蟹肉|汤)/u;

const TRAIT =
  /甜度刚刚好|甜度很顺口|粘度适中|粘度刚好|不会太甜|很Q弹|蒜香很足|很?好喝|很?好吃|很帅|服务很好|很放松|很舒服/;

const FRAME = /这次我最喜欢|我最喜欢|最喜欢|这次比较喜欢|比较喜欢|这次点的|吃完还想再点|还想再点|这次/;

function hanKey(text: string) {
  return text.replace(/\p{Extended_Pictographic}/gu, "").replace(/[^\p{Script=Han}a-zA-Z0-9]/gu, "");
}

function clauses(note: string) {
  return note
    .split(/[。！？!?\n；;]+/)
    .map((item) => item.trim())
    .filter((item) => hanKey(item).length >= 4);
}

/** A title that still is the customer's sentence, or that sentence with a few words swapped. */
export function isCopiedCustomerLine(line: string, note: string) {
  const title = hanKey(line);
  if (title.length < 4 || !note.trim()) return false;
  const framed = FRAME.test(line);
  for (const clause of clauses(note)) {
    const key = hanKey(clause);
    if (!key) continue;
    if (title === key) return true;
    if (title.includes(key) && key.length >= 8) return true;
    if (key.includes(title) && title.length >= 6 && (title.length / key.length >= 0.55 || framed)) return true;
  }
  const noteKey = hanKey(note);
  return Boolean(noteKey.includes(title) && title.length >= 8 && title.length / noteKey.length >= 0.72);
}

export function distillCustomerHook(clause: string, index = 0) {
  const dish = (clause.match(DISH)?.[0] ?? "").replace(/^(?:这次|我|最|比较|喜欢)+/, "");
  const trait = clause.match(TRAIT)?.[0] ?? "";
  const options: string[] = [];
  if (dish && trait && !trait.includes(dish)) {
    const stronger = trait.startsWith("很") ? `真的${trait}` : /^好[吃喝]$/.test(trait) ? `真的很${trait}` : trait;
    options.push(`${dish}${trait === stronger ? trait : stronger}`);
    if (trait !== stronger) options.push(`${dish}${trait}`);
    if (/^很?好[吃喝]$/.test(trait)) {
      options.push(`${dish.endsWith("奶") ? "这杯" : "这道"}${dish}真的很可以`);
    }
  }
  if (dish && /喜欢|还想再/.test(clause)) {
    options.push(`${dish}真的很难不爱`, `${dish}吃完还想再点`);
  }
  if (/老板/.test(clause) && /帅/.test(clause)) {
    options.push("这家泰餐老板真的很帅", "曼谷泰餐遇到帅老板");
  }
  if (/服务/.test(clause) && /好|热情|周到/.test(clause)) {
    options.push("这家服务让人记得住", "服务好到吃饭很轻松");
  }
  if (dish && options.length === 0) options.push(`${dish}是这顿记得住的`);
  const stripped = clause
    .replace(FRAME, "")
    .replace(/吃完还想再点|还想再点/g, "")
    .replace(/[，,。！？\s]/g, "");
  if (
    stripped.length >= 4 &&
    stripped.length <= 16 &&
    hanKey(stripped) !== hanKey(clause) &&
    !/^喜欢/.test(stripped)
  ) {
    options.push(stripped);
  }
  const unique = [...new Set(options)].filter((item) => item && !isCopiedCustomerLine(item, clause));
  if (unique.length > 0) return unique[Math.abs(index) % unique.length] ?? unique[0];
  if (dish) return `${dish}是这顿记得住的`;
  return stripped || clause;
}

export function separateHeadlinesFromNote(input: {
  titles: [string, string, string];
  coverTitle: string;
  coverSubtitle: string;
  note: string;
}) {
  const used = new Set<string>();
  const titles = input.titles.map((title, index) => {
    if (!isCopiedCustomerLine(title, input.note) && !used.has(hanKey(title))) {
      used.add(hanKey(title));
      return title;
    }
    const source = clauses(input.note).find((clause) => isCopiedCustomerLine(title, clause)) ?? input.note;
    let next = distillCustomerHook(source, index);
    if (used.has(hanKey(next))) next = distillCustomerHook(source, index + 1);
    used.add(hanKey(next));
    const flag = title.trimStart().startsWith("🇹🇭") && !next.startsWith("🇹🇭") ? "🇹🇭" : "";
    return `${flag}${next.replace(/^🇹🇭/, "")}`;
  }) as [string, string, string];
  const coverTitle = isCopiedCustomerLine(input.coverTitle, input.note)
    ? distillCustomerHook(input.note, 1)
    : input.coverTitle;
  const coverSubtitle = isCopiedCustomerLine(input.coverSubtitle, input.note)
    ? distillCustomerHook(input.note, 2)
    : input.coverSubtitle;
  return { titles, coverTitle, coverSubtitle };
}
