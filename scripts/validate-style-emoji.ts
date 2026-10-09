import { readFileSync } from "node:fs";
import { ensureCaptionEmojis } from "../lib/caption-emoji";
import { paragraphSentenceCounts } from "../lib/caption-story";
import { formatHumanStyleInstance } from "../lib/human-style/prompt";
import { HUMAN_STYLE_IDS, type HumanStyleId } from "../lib/human-style/library";
import { selectHumanStyle, type HumanStyleSelection } from "../lib/human-style/select";
import { analyzeTitleFormat, ensureTitleFormats } from "../lib/title-formats";
import { fixFruitEmojisInTitles } from "../lib/caption-emoji";

const note =
  "朋友之前提过的 centralworld 的 baan ying，这次总算约上一起过来。河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。青柠蒸鲈鱼特别开胃，酸香的味道刚好提鲜。店员服务也很热情周到。";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function styleOf(id: HumanStyleId, variation = 0.2): HumanStyleSelection {
  return selectHumanStyle({
    diningNote: note,
    dishes: ["河虾冬阴功汤", "菠萝炒饭", "青柠蒸鲈鱼"],
    variantIndex: 1,
    previousStyle: id,
  }).primaryStyle === id
    ? { ...selectHumanStyle({ diningNote: note, variantIndex: 1, previousStyle: id }), variation, primaryStyle: id }
    : {
        ...selectHumanStyle({ diningNote: note, variantIndex: 1, previousStyle: id }),
        primaryStyle: id,
        variation,
      };
}

function emojiCount(text: string) {
  return text.replace(/🇹🇭/g, "").match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
}

function titlesOf(titles: [string, string, string], id: HumanStyleId, caption = "", diningNote = note) {
  return fixFruitEmojisInTitles(
    ensureTitleFormats(titles, [], { style: id, note: diningNote, caption }),
  );
}

function decorativeCount(titles: string[]) {
  return titles.filter((title) => analyzeTitleFormat(title).hasNonFlagEmoji).length;
}

const meal =
  "河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。青柠蒸鲈鱼特别开胃。";
const close = "店员服务也很热情周到。";
const markers: Record<HumanStyleId, { caption: string; titles: [string, string, string]; mark: string }> = {
  foodie: {
    mark: "一口就能吃出来",
    titles: ["虾的鲜味很清楚", "炒饭配料给得很足", "鲈鱼特别开胃"],
    caption: `朋友之前提过。这次总算约上一起过来。\n\n河虾冬阴功汤的虾真的很新鲜，一口就能吃出来。菠萝炒饭配料给得很足。青柠蒸鲈鱼特别开胃。\n\n${close}`,
  },
  chatty: {
    mark: "然后",
    titles: ["总算约上了", "虾是真的新鲜", "服务也挺周到"],
    caption: `朋友之前提过。这次总算约上一起过来。\n\n然后${meal}\n\n${close}`,
  },
  casual: {
    mark: "刚好",
    titles: ["这顿真的很好吃", "河虾冬阴功汤的虾很新鲜", "店员服务周到"],
    caption: `朋友之前提过。这次刚好总算约上。\n\n${meal}\n\n${close}`,
  },
  story: {
    mark: "坐下来之后",
    titles: ["坐下来才点的虾", "炒饭配料很足", "鲈鱼特别开胃"],
    caption: `朋友之前提过。坐下来之后，这次总算约上一起过来。\n\n${meal}\n\n${close}`,
  },
  short: {
    mark: "就这些",
    titles: ["虾很新鲜", "配料很足", "鲈鱼开胃"],
    caption: `朋友之前提过。这次总算约上。\n\n就这些。河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。\n\n青柠蒸鲈鱼特别开胃。\n\n${close}`,
  },
  playful: {
    mark: "也太鲜了",
    titles: ["这虾也太鲜了", "炒饭配料给得很足", "鲈鱼开胃"],
    caption: `朋友之前提过。这次总算约上一起过来。\n\n河虾冬阴功汤的虾真的很新鲜，也太鲜了。菠萝炒饭配料给得很足。青柠蒸鲈鱼特别开胃。\n\n${close}`,
  },
  travel: {
    mark: "这一天",
    titles: ["这一天吃到的虾", "炒饭配料很足", "鲈鱼开胃"],
    caption: `朋友之前提过。这一天总算约上一起过来。\n\n${meal}\n\n${close}`,
  },
  local: {
    mark: "还是老样子",
    titles: ["虾还是很新鲜", "炒饭配料很足", "鲈鱼开胃"],
    caption: `朋友之前提过。这次总算约上，还是老样子。\n\n${meal}\n\n${close}`,
  },
  emotional: {
    mark: "挺高兴的",
    titles: ["总算约上挺高兴", "虾很新鲜", "鲈鱼开胃"],
    caption: `朋友之前提过。这次总算约上一起过来，挺高兴的。\n\n${meal}\n\n${close}`,
  },
};

const finished = HUMAN_STYLE_IDS.map((id) => {
  const item = markers[id];
  const selection = styleOf(id);
  const caption = ensureCaptionEmojis(item.caption, selection, note);
  const titles = titlesOf(item.titles, id, caption);
  return { id, caption, titles, mark: item.mark };
});

assert(new Set(finished.map((item) => item.caption.replace(/\p{Extended_Pictographic}/gu, ""))).size === 9, "A captions collapsed to one voice");
for (const item of finished) {
  assert(item.caption.includes(item.mark), `A ${item.id} lost its wording: ${item.caption}`);
  assert(item.caption.includes("朋友") && item.caption.includes("总算约上"), `A ${item.id} lost the reason`);
  assert(item.caption.includes("河虾冬阴功汤") && item.caption.includes("菠萝炒饭") && item.caption.includes("青柠蒸鲈鱼"), `A ${item.id} lost a dish`);
  assert(item.caption.includes("店员服务"), `A ${item.id} lost the service`);
  assert(!/排队|等了|价格|人均|这顿味道很正宗|吃着很满足/.test(item.caption), `A ${item.id} invented or stocked: ${item.caption}`);
  assert(paragraphSentenceCounts(item.caption).every((count) => count <= 3), `A ${item.id} paragraph too long`);
  assert(decorativeCount(item.titles) >= 1 && decorativeCount(item.titles) <= 2, `A ${item.id} title emoji ${decorativeCount(item.titles)}`);
  const prompt = formatHumanStyleInstance(styleOf(item.id));
  assert(prompt.includes(item.id === "foodie" ? "Foodie" : item.id[0]?.toUpperCase() + item.id.slice(1) || item.id), `A prompt missed ${item.id}`);
  assert(prompt.includes("TITLES, same person"), `A titles are not tied to ${item.id}`);
  assert(!/light = one|emoji mode/i.test(prompt), `A ${item.id} prompt still has a count tier`);
}

const bare = titlesOf(["虾很新鲜", "炒饭配料很足", "鲈鱼开胃"], "casual");
assert(decorativeCount(bare) === 1, `B zero emoji stayed empty: ${bare.join(" | ")}`);
assert(bare.filter((title) => !analyzeTitleFormat(title).hasNonFlagEmoji).length >= 1, "B no plain title");

const one = titlesOf(["🍤虾很新鲜", "炒饭配料很足", "服务周到"], "casual");
assert(decorativeCount(one) === 1 && one.some((title) => title.includes("🍤")), `B added or dropped the existing emoji: ${one.join(" | ")}`);

const two = titlesOf(["🍤虾很新鲜", "🥭芒果甜度刚好", "服务周到"], "playful");
assert(decorativeCount(two) === 2, `B two emojis became ${decorativeCount(two)}: ${two.join(" | ")}`);
const twoPlacements = two
  .map((title) => analyzeTitleFormat(title).emojiPlacement)
  .filter((placement) => placement === "start" || placement === "end");
assert(new Set(twoPlacements).size === 2, `B same emoji position: ${two.join(" | ")}`);

const glued = titlesOf(["河虾冬阴功汤🍤真的新鲜", "炒饭配料很足", "服务周到"], "foodie");
assert(!/汤🍤真/.test(glued.join("")), `B emoji stayed on the dish: ${glued.join(" | ")}`);
assert(glued.some((title) => analyzeTitleFormat(title).emojiPlacement === "start" || analyzeTitleFormat(title).emojiPlacement === "end"), "B emoji has no edge");

const copied = titlesOf(["🍤虾很新鲜", "炒饭配料很足", "服务周到"], "foodie", "🍤河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。");
const copiedTitle = copied.find((title) => title.includes("🍤")) ?? "";
assert(analyzeTitleFormat(copiedTitle).emojiPlacement === "end", `B copied the caption placement: ${copiedTitle}`);

const foodieTitles = titlesOf(["这顿真的很好吃", "河虾冬阴功汤的虾很新鲜", "店员服务周到"], "foodie");
const casualTitles = titlesOf(["这顿真的很好吃", "河虾冬阴功汤的虾很新鲜", "店员服务周到"], "casual");
assert(foodieTitles.some((title) => title.includes("🍤")), `B foodie missed the dish emoji: ${foodieTitles.join(" | ")}`);
assert(casualTitles.some((title) => title.includes("😋")), `B casual missed the mild emoji: ${casualTitles.join(" | ")}`);
assert(foodieTitles.join("|") !== casualTitles.join("|"), "B foodie and casual titles were identical");

const bannedNote = `${note} 不要表情`;
const bannedTitles = titlesOf(["🍤虾很新鲜", "🥭芒果甜", "🐟鲈鱼开胃"], "playful", "", bannedNote);
assert(decorativeCount(bannedTitles) === 0, `B ban still has title emoji: ${bannedTitles.join(" | ")}`);
const bannedCaption = ensureCaptionEmojis(markers.foodie.caption, styleOf("foodie"), bannedNote);
assert(emojiCount(bannedCaption) === 0, `B ban added a caption emoji: ${bannedCaption}`);

const wrong = titlesOf(["青柠蒸鲈鱼很开胃🥭", "炒饭配料很足", "服务周到"], "foodie");
assert(!wrong.some((title) => title.includes("🥭")), `B kept a mango emoji on fish: ${wrong.join(" | ")}`);
assert(wrong.some((title) => title.includes("🐟")), `B did not correct the fish emoji: ${wrong.join(" | ")}`);

for (const id of HUMAN_STYLE_IDS) {
  const caption = finished.find((item) => item.id === id)?.caption ?? "";
  const foods = ["河虾冬阴功汤", "菠萝炒饭", "青柠蒸鲈鱼"].filter((dish) => caption.includes(dish));
  const foodWithEmoji = foods.filter((dish) => new RegExp(`${dish}\\p{Extended_Pictographic}`, "u").test(caption) || caption.includes(`${dish}`));
  assert(emojiCount(caption) >= 1, `C ${id} defaulted to no emoji: ${caption}`);
  assert(emojiCount(caption) < foods.length + 2, `C ${id} stacked emojis: ${caption}`);
  assert(!foods.every((dish) => new RegExp(`${dish}.{0,2}\\p{Extended_Pictographic}|\\p{Extended_Pictographic}${dish}`, "u").test(caption)), `C ${id} put one emoji on every dish`);
  assert(!/🥭/.test(caption) || /芒果/.test(caption), `C ${id} mismatched mango`);
  assert(!/🐟.*安心|安心.*🐟/.test(caption), `C ${id} moved fish emoji onto 安心`);
  void foodWithEmoji;
}

const already = ensureCaptionEmojis("🍤河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。青柠蒸鲈鱼特别开胃。", styleOf("local"), note);
assert(emojiCount(already) === 1, `C added a second emoji: ${already}`);
assert(already.includes("🍤"), "C removed the model's emoji");

const serviceOnly = ensureCaptionEmojis("店员服务也很热情周到。这次总算约上一起过来。", styleOf("short"), note);
assert(emojiCount(serviceOnly) === 0, `C invented an emoji: ${serviceOnly}`);

const wifeNote = "老婆上次来就说很好吃，这次就带着一家人来了";
const wifeSource = "在centralwOrld吃了一顿正宗泰餐。这顿味道很正宗。吃着很满足。";
const wife = ensureCaptionEmojis(wifeSource, styleOf("story"), wifeNote);
assert(/central\s*world/i.test(wife), `D emoji deleted the store sentence: ${wife}`);
assert(!wife.includes(wifeNote), `D emoji replaced the caption with the note: ${wife}`);

const friendSource =
  "河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。青柠蒸鲈鱼特别开胃。店员服务也很热情周到。这顿味道很正宗。吃着很满足。";
const friend = ensureCaptionEmojis(friendSource, styleOf("casual"), note);
assert(!friend.includes("朋友之前提过"), `D emoji pasted the note: ${friend}`);
assert(friend.indexOf("河虾冬阴功汤") < friend.indexOf("菠萝炒饭") && friend.indexOf("菠萝炒饭") < friend.indexOf("青柠蒸鲈鱼"), `D dish order changed: ${friend}`);
assert(friend.includes("店员服务"), `D service was dropped: ${friend}`);

const stayed = selectHumanStyle({ diningNote: note, variantIndex: 1, previousStyle: "casual" });
assert(stayed.primaryStyle === "casual", `memory did not keep casual: ${stayed.primaryStyle}`);
const switched = selectHumanStyle({ diningNote: note, variantIndex: 3, previousStyle: "casual" });
assert(switched.variant.opening.length > 0, "memory switch lost the telling");

const route = readFileSync(new URL("../app/api/generate/route.ts", import.meta.url), "utf8");
const shared = route.slice(route.indexOf("const formatted = fixFruitEmojisInTitles"));
assert(shared.includes("ensureCaptionEmojis") && shared.includes("ensureTitleFormats"), "E shared cleanup missing");
assert(!/if \(provider === "openai"\)/.test(shared) && !/if \(provider === "modelark"\)/.test(shared), "E emoji path depends on provider");
assert(!shared.includes("compose-cover") && !shared.includes("createModelArkResponse"), "E cleanup calls another model or the cover composer");
assert(route.includes("withModelArkJsonRetry") && route.includes("withModelArkTitleCheck"), "E retry handling was removed");

console.log("validate-style-emoji: ok");
