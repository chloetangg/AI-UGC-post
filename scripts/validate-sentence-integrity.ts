import { ensureCaptionEmojis } from "../lib/caption-emoji";
import { paragraphSentenceCounts } from "../lib/caption-story";
import { HUMAN_STYLE_IDS, type HumanStyleId } from "../lib/human-style/library";
import { formatHumanStyleInstance } from "../lib/human-style/prompt";
import { selectHumanStyle, type HumanStyleSelection } from "../lib/human-style/select";
import { ensureTitleFormats } from "../lib/title-formats";
import { fixFruitEmojisInTitles } from "../lib/caption-emoji";
import { parseGeneratedContent } from "../lib/parse-generated";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function styleOf(id: HumanStyleId, variation = 0.2): HumanStyleSelection {
  const selected = selectHumanStyle({
    diningNote: "芒果糯米饭粘度刚好",
    dishes: ["芒果糯米饭"],
    variantIndex: 1,
    previousStyle: id,
  });
  return { ...selected, primaryStyle: id, variation };
}

function dangling(text: string) {
  return /比较喜欢。|最喜欢。|几道里面。|的是。/.test(text);
}

const liked = "点的几道里面，我比较喜欢芒果糯米饭，粘度刚好。";
const likedNote = "芒果糯米饭粘度刚好";
for (const id of HUMAN_STYLE_IDS) {
  const caption = ensureCaptionEmojis(liked, styleOf(id, id === "playful" ? 0.4 : 0.1), likedNote);
  assert(!dangling(caption), `${id} split the liking sentence: ${caption}`);
  assert(caption.includes("芒果糯米饭") && caption.includes("粘度刚好"), `${id} dropped the fact: ${caption}`);
  assert(!/甜度|香气|份量|价格|排队|环境|楼/.test(caption), `${id} invented a detail: ${caption}`);
  assert(!/🥭芒果糯米饭。$/.test(caption.trim()) || caption.includes("粘度"), `${id} left the dish as its own sentence: ${caption}`);
}

const arrived = ensureCaptionEmojis("来了centralworld的Baan Ying。", styleOf("travel"), "来了centralworld的Baan Ying。");
assert(arrived.includes("centralworld") && /Baan Ying/i.test(arrived), `arrival was dropped: ${arrived}`);
assert(!/排队|价格|甜度|10:00|3楼|吃了一顿/.test(arrived), `arrival was expanded: ${arrived}`);
assert(!dangling(arrived), `arrival was split: ${arrived}`);

const family = ensureCaptionEmojis("带家人来吃大家都很喜欢", styleOf("emotional"), "带家人来吃大家都很喜欢");
assert(/带家人/.test(family) && /喜欢/.test(family), `family line was dropped: ${family}`);
assert(!/芒果|冬阴功|排队|价格|楼|正宗/.test(family), `family line gained a dish or a stock line: ${family}`);
assert(!dangling(family), `family line was split: ${family}`);

const fragment = ensureCaptionEmojis("点的几道里面，我比较喜欢。", styleOf("casual"), "点的几道里面，我比较喜欢。");
assert(!/芒果|冬阴功|菠萝|鲈鱼/.test(fragment), `a dish was invented for a fragment: ${fragment}`);

const fullNote =
  "朋友之前提过的 centralworld 的 baan ying，这次总算约上一起过来。河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。青柠蒸鲈鱼特别开胃。店员服务也很热情周到。";
const full =
  "朋友之前提过。这次总算约上一起过来。\n\n河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。青柠蒸鲈鱼特别开胃。\n\n店员服务也很热情周到。";
const kept = ensureCaptionEmojis(full, styleOf("story"), fullNote);
assert(kept.includes("\n\n"), `blank lines were flattened: ${JSON.stringify(kept)}`);
assert(paragraphSentenceCounts(kept).every((count) => count <= 3), `paragraph cap: ${paragraphSentenceCounts(kept).join(",")}`);
assert(kept.indexOf("总算约上") < kept.indexOf("河虾冬阴功汤"), `arrival was moved after the meal: ${kept}`);
assert(kept.indexOf("河虾冬阴功汤") < kept.indexOf("菠萝炒饭") && kept.indexOf("菠萝炒饭") < kept.indexOf("青柠蒸鲈鱼"), `dish order changed: ${kept}`);
assert(!dangling(kept), `full caption was split: ${kept}`);

const many = "🍤河虾冬阴功汤的虾真的很新鲜。\n\n🍍不该出现。菠萝炒饭配料给得很足😋。青柠蒸鲈鱼特别开胃🐟。";
const keptEmoji = ensureCaptionEmojis(many, styleOf("playful"), fullNote);
const marks = keptEmoji.replace(/🇹🇭/g, "").match(/\p{Extended_Pictographic}/gu) ?? [];
assert(marks.length >= 2, `emojis were compressed to ${marks.length}: ${keptEmoji}`);

const paragraphs = parseGeneratedContent(
  JSON.stringify({
    titles: ["虾很新鲜", "配料很足", "鲈鱼开胃"],
    captionParagraphs: ["朋友之前提过，这次总算约上。", "河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。"],
    hashtags: ["#a", "#b", "#c", "#d", "#e"],
    mainTitle: "主标题",
    subTitle: "副标题",
    selectedPhotoIndex: 0,
    selectedPhotoIndexes: [0],
    photoSelectionReason: "",
    remainingPhotoOrder: [],
    remainingOrderPattern: "",
  }),
).caption;
assert(paragraphs.includes("\n\n"), paragraphs);
const fromParagraphs = ensureCaptionEmojis(paragraphs, styleOf("casual"), fullNote);
assert(fromParagraphs.includes("\n\n"), `paragraph join was flattened: ${JSON.stringify(fromParagraphs)}`);
assert(fromParagraphs.includes("总算约上") && fromParagraphs.includes("河虾冬阴功汤"), fromParagraphs);

const titles = fixFruitEmojisInTitles(
  ensureTitleFormats(["虾很新鲜", "炒饭配料很足", "鲈鱼开胃"], [], {
    style: "foodie",
    note: fullNote,
    caption: kept,
  }),
);
assert(titles.some((title) => /\p{Extended_Pictographic}/u.test(title)), `titles lost emoji: ${titles.join(" | ")}`);
assert(titles.some((title) => !/\p{Extended_Pictographic}/u.test(title.replace(/^🇹🇭/, ""))), "every title got an emoji");

const outputs = HUMAN_STYLE_IDS.map((id) => ensureCaptionEmojis(full, styleOf(id, 0.15 + HUMAN_STYLE_IDS.indexOf(id) / 20), fullNote));
assert(outputs.every((caption) => caption.includes("新鲜") && caption.includes("配料") && caption.includes("开胃")), "a style dropped a dish fact");
assert(new Set(outputs.map((caption) => caption.replace(/\p{Extended_Pictographic}/gu, ""))).size >= 1, "styles erased the shared facts");
const prompts = HUMAN_STYLE_IDS.map((id) => formatHumanStyleInstance(styleOf(id)));
assert(new Set(prompts).size === HUMAN_STYLE_IDS.length, "two Human Styles share the same prompt text");

console.log("--- liked ---");
console.log(ensureCaptionEmojis(liked, styleOf("foodie"), likedNote));
console.log("--- arrived ---");
console.log(arrived);
console.log("--- family ---");
console.log(family);
console.log("--- fragment ---");
console.log(fragment);
console.log("--- full ---");
console.log(kept);
console.log("validate-sentence-integrity: ok");
