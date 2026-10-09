import { ensureCaptionEmojis } from "../lib/caption-emoji";
import { arrangeDiningStory, paragraphSentenceCounts } from "../lib/caption-story";
import type { HumanStyleId } from "../lib/human-style/library";
import { selectHumanStyle } from "../lib/human-style/select";

const note =
  "菠萝炒饭、河虾冬阴功汤、芒果糯米饭。粉红奶很好喝。味道很正宗，熟悉的泰式风味。店里坐着很舒服，整个人放松下来。这次还会想再点。";
const dishes = ["菠萝炒饭", "河虾冬阴功汤", "芒果糯米饭"];
const bad = [
  "菠萝炒饭是我这次还会想再点的一道。",
  "河虾冬阴功汤是我这次还会想再点的一道。",
  "芒果糯米饭是我这次还会想再点的一道。",
  "味道很正宗，吃起来就是很熟悉的泰式风味。",
  "店里坐着很舒服。",
  "整个人都放松下来了。",
  "再配上一杯粉红奶，这顿饭也就更完整了。",
].join("");

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

let previousStyle: HumanStyleId | undefined;
const styles: string[] = [];
const modes: string[] = [];
const openings: string[] = [];

for (let index = 0; index < 5; index += 1) {
  const style = selectHumanStyle({
    diningNote: note,
    dishes,
    enjoyMost: ["食物味道正宗美味", "环境"],
    customerType: "Tourist",
    visitFrequency: "Not first time",
    contentAngleId: "CA-02",
    variantIndex: index,
    previousStyle,
  });
  previousStyle = style.primaryStyle;
  styles.push(style.primaryStyle);
  modes.push(style.emojiMode);
  openings.push(style.variant.opening);
  const caption = ensureCaptionEmojis(arrangeDiningStory(bad, note), style);
  const counts = paragraphSentenceCounts(caption);
  const clones = caption.match(/是我这次还会想再点的一道/g)?.length ?? 0;
  console.log(`\n#${index + 1} ${style.primaryStyle} / ${style.emojiMode}`);
  console.log(`opening: ${style.variant.opening}`);
  console.log(caption);
  console.log(`sentences per paragraph: ${counts.join(", ")}`);
  assert(!counts.some((count) => count > 3), `paragraph longer than 3: ${counts.join(",")}`);
  assert(clones < 2, `repeated dish frame survived: ${caption}`);
  assert(/\p{Extended_Pictographic}/u.test(caption), `caption has no emoji: ${caption}`);
  assert(caption.includes("菠萝炒饭") && caption.includes("芒果糯米饭"), `a named dish was dropped: ${caption}`);
}

assert(!styles.every((style) => style === "foodie"), `food evidence locked Foodie: ${styles.join(" → ")}`);
assert(new Set(styles).size >= 2, `style never moved: ${styles.join(" → ")}`);
assert(new Set(openings).size >= 3, `telling did not change: ${openings.join(" | ")}`);

const natural =
  "这次点的几道里，我比较喜欢菠萝炒饭和河虾冬阴功汤。芒果糯米饭也不错，最后配一杯粉红奶刚刚好。店里坐着很舒服。";
const kept = ensureCaptionEmojis(
  natural,
  selectHumanStyle({
    diningNote: note,
    dishes,
    variantIndex: 1,
    previousStyle: "casual",
    contentAngleId: "CA-02",
  }),
);
assert(!/是我这次还会想再点的一道/.test(kept), `natural caption was rewritten into the dish frame: ${kept}`);
assert(kept.includes("菠萝炒饭") && kept.includes("河虾冬阴功汤"), `natural caption lost a dish: ${kept}`);
const naturalCounts = paragraphSentenceCounts(kept);
assert(naturalCounts.length > 0, `natural caption was emptied: ${naturalCounts.join(",")}`);
const mallArrival = "逛完centralwOrld后来到Baan Ying享用泰式美食。芒果糯米饭很好吃。";
const recommended = ensureCaptionEmojis(
  mallArrival,
  selectHumanStyle({ diningNote: "跟着同事的推荐过来的太好吃啦", dishes: ["芒果糯米饭"], variantIndex: 1, previousStyle: "casual" }),
  "跟着同事的推荐过来的太好吃啦",
);
assert(/逛完/.test(recommended), `emoji deleted the visit: ${recommended}`);
assert(!recommended.includes("跟着同事的推荐过来的太好吃啦"), `emoji replaced the caption with the note: ${recommended}`);
assert(/芒果糯米饭/.test(recommended), `emoji dropped the dish: ${recommended}`);
console.log(`\ncolleague kept:\n${recommended}`);
console.log(`\nnatural kept:\n${kept}`);
console.log(`\nstyles: ${styles.join(" → ")}`);
console.log(`emoji: ${modes.join(" → ")}`);
console.log("human style variation ok");
