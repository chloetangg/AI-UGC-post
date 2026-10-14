import { addsNoNewPoint, headlinesSharePoint, sameTitleAngle } from "@/lib/headline-overlap";
import { isNegativeClause } from "@/lib/evidence-priority";

const DISH =
  /粉红奶|芒果糯米饭|蒜炒虾仁|咖喱蟹肉|青咖喱牛肉|菠萝炒饭|滑蛋饭|河虾冬阴功汤|冬阴功汤|冬阴功|青柠蒸鲈鱼|炒空心菜|泰奶|[\p{Script=Han}]{2,6}(?:饭|奶|虾仁|蟹肉|汤)/u;

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
  return stripped || clause;
}

function noteParts(note: string) {
  return note
    .split(/[。！？!?\n；;，,]+/)
    .map((item) => item.trim())
    .filter((item) => hanKey(item).length >= 4);
}

/** Headline material only. A negative clause is never rewritten into a title or the cover. */
function positiveNoteParts(note: string) {
  return noteParts(note)
    .filter((part) => !isNegativeClause(part))
    .map((part) => part.replace(/^(?:不过|但是|可是|但|而且)/, ""))
    .filter((part) => hanKey(part).length >= 4);
}

function bigramOverlap(left: string, right: string) {
  const grams = (text: string) => {
    const key = hanKey(text);
    return new Set([...key].slice(0, -1).map((char, index) => `${char}${key[index + 1]}`));
  };
  const a = grams(left);
  return [...grams(right)].filter((gram) => a.has(gram)).length;
}

/** Same customer point in other words. Only the customer's own dish, trait, or scene words are reused. */
function titleHookOptions(part: string) {
  const options: string[] = [];
  const dish = (part.match(DISH)?.[0] ?? "").replace(/^(?:这次|我|最|比较|喜欢)+/, "");
  if (dish) {
    const rest = part.slice(part.indexOf(dish) + dish.length).replace(/[，,。！？!?\s]/g, "").replace(/^的/, "");
    const split = rest.match(/^(\p{Script=Han}{1,3}?)(?:也|还)?(?:很|超|特别)(\p{Script=Han}{1,3})$/u);
    if (split?.[1] && split[2]) options.push(`${dish}的${split[1]}是真的${split[2]}`);
    const whole = rest.match(/^(?:也|还)?(?:很|超|特别|真的很)(\p{Script=Han}{1,3})$/u);
    if (whole?.[1]) {
      options.push(`${dish}是真的${whole[1]}`, `${dish.endsWith("奶") ? "这杯" : "这道"}${dish}很${whole[1]}`);
    }
  } else {
    const plain = part.replace(/^(?:结果|其实|而且|然后|就是|还有)/, "").replace(/[，,。！？!?\s]/g, "");
    const said = plain.match(/^(\p{Script=Han}{1,4}?)(?:也|还)?很(\p{Script=Han}{1,3})$/u);
    if (said && !/[我你他她它们]/.test(said[1])) options.push(`${said[1]}是真的${said[2]}`);
  }
  const staff = part.match(/(?:服务员|店员|服务)\p{Script=Han}{0,2}?(热情|耐心|周到|贴心)/u)?.[1];
  if (staff) options.push(`店员${staff === "周到" ? "照顾得很周到" : `一直很${staff}`}`);
  const who = part.match(/老婆|老公|爸妈|家人|朋友|同事|闺蜜/)?.[0];
  if (who && /说|觉得/.test(part) && /好吃|好喝|不错/.test(part)) options.push(`${who}说${part.match(/好吃|好喝|不错/)?.[0]}的那家`);
  if (who && /推荐|介绍/.test(part)) options.push(`${who}推荐的这家`);
  if (who && /一直在拍|拍个不停|一直拍/.test(part)) options.push(`${who}拍照停不下来`);
  if (/带着?一家人|带家人|一家人/.test(part)) options.push("带一家人来吃的这顿");
  if (/环境|氛围|店里/.test(part) && /舒服|放松|安静|温馨/.test(part)) {
    options.push(`店里坐着${part.match(/舒服|放松|安静|温馨/)?.[0] === "温馨" ? "很温馨" : "很舒服"}`);
  }
  options.push(distillCustomerHook(part, 0), distillCustomerHook(part, 1));
  return [...new Set(options)].filter((option) => option && !/记得住/.test(option));
}

const DISH_YUMMY_TITLE = new RegExp(`(?:${DISH.source})\\p{Script=Han}{0,4}(?:好吃|好喝)\\p{Extended_Pictographic}?$`, "u");

const WORN_OPENER = /^(🇹🇭)?\s*(?:终于|不得不说[，,]?|POV[：:]?\s*|Must[-\s]?have的?)/i;
const COLD_TEMPLATE_TITLE = /^(?:🇹🇭)?曼谷泰餐\p{Script=Han}{1,10}很满足$|^(?:🇹🇭)?曼谷泰餐的\p{Script=Han}{1,10}值得点$|是这顿记得住的$/u;

/** Two dishes the customer named, said plainly. Only for a cold template that has nothing better. */
function orderedDishPair(note: string) {
  const named = new RegExp(DISH.source.replace(/\|\[\\p\{Script=Han\}\]\{2,6\}.*$/, ""), "gu");
  const dishes = [...new Set([...note.matchAll(named)].map((match) => match[0]))];
  return dishes.length >= 2 ? `${dishes[0]}和${dishes[1]}都点了` : undefined;
}

/** One of the customer's short clauses, word for word. */
function echoesNoteClause(line: string, note: string) {
  const key = hanKey(line);
  return key.length >= 6 && noteParts(note).some((part) => hanKey(part) === key);
}

function dropWornOpener(title: string) {
  if (!WORN_OPENER.test(title)) return title;
  const rest = title.replace(WORN_OPENER, "$1").replace(/Must[-\s]?have的?|POV[：:]?/gi, "").trim();
  return hanKey(rest).length >= 5 ? rest : "";
}

/**
 * A title is replaced only when it copies the note, repeats the point of a title already kept,
 * is a cold template, or is nothing but a worn opener. A worn opener on an otherwise fine title is just dropped.
 * The replacement keeps the copied clause's point when it can, and is never another title's point.
 */
function distinctTitles(input: [string, string, string], note: string): [string, string, string] {
  const titles = input.map((title) => dropWornOpener(title)) as [string, string, string];
  const kept: string[] = [];
  const parts = positiveNoteParts(note);
  const repeats = (line: string, others: string[]) =>
    others.some((other) => hanKey(other) === hanKey(line) || sameTitleAngle(other, line) || headlinesSharePoint(other, line));
  const unusable = (title: string) =>
    !title || isCopiedCustomerLine(title, note) || echoesNoteClause(title, note) || COLD_TEMPLATE_TITLE.test(title);
  const result = titles.map((title, index) => {
    const others = titles.slice(index + 1).filter((other) => !unusable(other));
    if (!unusable(title) && !repeats(title, kept)) {
      kept.push(title);
      return title;
    }
    const ordered = [...parts].sort((a, b) => bigramOverlap(title, b) - bigramOverlap(title, a));
    const options = ordered.flatMap(titleHookOptions).filter((option) => hanKey(option).length >= 4 && !unusable(option));
    const neighbours = [...kept, ...others];
    const rephrase = () =>
      title && !repeats(title, kept)
        ? options.find((option) =>
            neighbours.every((other) => hanKey(other) !== hanKey(option) && !sameTitleAngle(other, option)),
          )
        : undefined;
    const plainOrder = () => {
      if (!COLD_TEMPLATE_TITLE.test(title)) return undefined;
      const pair = orderedDishPair(note);
      return pair && neighbours.every((other) => hanKey(other) !== hanKey(pair)) ? pair : undefined;
    };
    const next =
      options.find((option) => !repeats(option, neighbours) && !addsNoNewPoint(option, neighbours)) ??
      rephrase() ??
      plainOrder();
    if (!next) {
      const fallback = title || input[index];
      kept.push(fallback);
      return fallback;
    }
    kept.push(next);
    const flag = title.trimStart().startsWith("🇹🇭") && !next.startsWith("🇹🇭") ? "🇹🇭" : "";
    return `${flag}${next.replace(/^🇹🇭/, "")}`;
  }) as [string, string, string];
  if (result.every((title) => DISH_YUMMY_TITLE.test(title.replace(/^🇹🇭/u, "")))) {
    const angle = parts
      .flatMap(titleHookOptions)
      .find((option) => !DISH.test(option) && !unusable(option) && !repeats(option, result));
    if (angle) result[2] = angle;
  }
  return result;
}

/** A copied cover main line becomes the customer's point in other words, short enough for the cover. */
function coverHook(note: string, others: string[]) {
  const options = positiveNoteParts(note)
    .flatMap(titleHookOptions)
    .filter((option) => {
      const key = hanKey(option);
      return key.length >= 4 && key.length <= 10 && !isCopiedCustomerLine(option, note) && !echoesNoteClause(option, note);
    });
  const lines = others.filter(Boolean);
  return (
    options.find((option) => !lines.some((line) => headlinesSharePoint(line, option))) ??
    options.find((option) => lines.every((line) => hanKey(line) !== hanKey(option)))
  );
}

export function separateHeadlinesFromNote(input: {
  titles: [string, string, string];
  coverTitle: string;
  coverSubtitle: string;
  note: string;
}) {
  const titles = distinctTitles(input.titles, input.note);
  const ownWords = positiveNoteParts(input.note).join("，");
  const coverTitle = isCopiedCustomerLine(input.coverTitle, input.note)
    ? coverHook(input.note, [input.coverSubtitle, ...titles]) ??
      (ownWords ? distillCustomerHook(ownWords, 1) : input.coverTitle)
    : input.coverTitle;
  const coverSubtitle = isCopiedCustomerLine(input.coverSubtitle, input.note)
    ? ownWords
      ? distillCustomerHook(ownWords, 2)
      : input.coverSubtitle
    : input.coverSubtitle;
  return { titles, coverTitle, coverSubtitle };
}
