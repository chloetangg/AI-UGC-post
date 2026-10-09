import { arrangeDiningStory, paragraphSentenceCounts } from "../lib/caption-story";
import { ensureCaptionEmojis } from "../lib/caption-emoji";
import { finalizeOfficialLocationTime } from "../lib/locations";
import { parseGeneratedContent } from "../lib/parse-generated";
import type { HumanStyleSelection } from "../lib/human-style/select";

const sample = `河虾冬阴功汤的虾真的很新鲜

朋友之前提过的centralworld的baan ying。

菠萝炒饭配料给得很足，一口下去口感很丰富。河虾冬阴功汤是这次吃下来印象最深的，河虾吃着很新鲜。青柠蒸鲈鱼特别开胃，酸香的味道刚好提鲜。这次总算约上一起过来。这顿味道很正宗。店员服务也很热情周到。吃着很满足。`;

const note = "朋友之前提过 centralworld 的 Baan Ying，这次总算约上。河虾冬阴功汤的虾很新鲜，菠萝炒饭配料足，青柠蒸鲈鱼开胃。店员服务热情。";
const branch = "Baan Ying (centralwOrld, 3rd Floor)";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function style(mode: "none" | "light" | "natural", variation = 0): HumanStyleSelection {
  return {
    primaryStyle: "casual",
    intensity: 0.6,
    variation,
    emojiMode: mode,
  } as HumanStyleSelection;
}

function emojiCount(text: string) {
  return text.replace(/🇹🇭/g, "").match(/\p{Extended_Pictographic}/gu)?.length ?? 0;
}

function storyOf(caption: string) {
  return caption.replace(/\n*[📍⏰][\s\S]*$/u, "").trim();
}

function deliver(caption: string, diningNote: string, placement: "inline" | "standalone", variation = 0) {
  const prepared = ensureCaptionEmojis(arrangeDiningStory(caption, diningNote), style("none", variation), diningNote);
  return finalizeOfficialLocationTime({
    caption: prepared,
    branch,
    placement,
    format: placement === "standalone" ? "A" : "",
  }).caption;
}

function assertShape(caption: string, label: string) {
  const story = storyOf(caption);
  const counts = paragraphSentenceCounts(story);
  assert(counts.length > 1, `${label} is one block: ${story}`);
  assert(counts.every((count) => count <= 3 && count >= 1), `${label} paragraph counts ${counts.join(",")}`);
  assert(counts.some((count) => count >= 2), `${label} split every sentence: ${counts.join(",")}`);
  assert(story.includes("\n\n"), `${label} has no blank line`);
  assert(!/\n\n\n/.test(story), `${label} has an extra blank line`);
}

const beforeCounts = paragraphSentenceCounts(sample);
assert(beforeCounts.some((count) => count > 3), "fixture should start with a long paragraph");
assert(emojiCount(sample) === 0, "fixture should start without emoji");

const inline = deliver(sample, note, "inline");
const standalone = deliver(sample, note, "standalone");
console.log("--- before ---\n" + sample);
console.log("--- after inline ---\n" + inline);
console.log("--- after standalone ---\n" + standalone);

for (const [label, caption] of [
  ["inline", inline],
  ["standalone", standalone],
] as const) {
  const story = storyOf(caption);
  assertShape(caption, label);
  assert(emojiCount(story) >= 1 && emojiCount(story) <= 2, `${label} emoji count ${emojiCount(story)}`);
  const friend = story.indexOf("朋友");
  const arrived = story.indexOf("总算约上");
  const prawn = story.indexOf("河虾冬阴功汤");
  const rice = story.indexOf("菠萝炒饭");
  const fish = story.indexOf("青柠蒸鲈鱼");
  const service = story.indexOf("店员服务");
  assert(friend >= 0 && arrived > friend, `${label} split the arrival: ${story}`);
  assert(prawn > arrived && rice > arrived && fish > arrived, `${label} meal leads the arrival: ${story}`);
  assert(service > fish, `${label} dropped the service: ${story}`);
  assert((story.match(/新鲜/g) ?? []).length === 1, `${label} repeated 新鲜: ${story}`);
  assert(!/这顿味道很正宗|吃着很满足|印象最深/.test(story), `${label} kept an empty closer: ${story}`);
  assert(!/排队|等了|价格|环境|人均/.test(story), `${label} invented an experience: ${story}`);
  const again = finalizeOfficialLocationTime({
    caption,
    branch,
    placement: label,
    format: label === "standalone" ? "A" : "",
  }).caption;
  assertShape(again, `${label} second pass`);
  assert(storyOf(again).includes("朋友") && storyOf(again).includes("总算约上"), `${label} second pass dropped the arrival`);
}

const dishesOnly = "青柠蒸鲈鱼特别开胃，酸香的味道刚好提鲜。菠萝炒饭配料给得很足，一口下去口感很丰富。";
const noArrival = deliver(dishesOnly, "青柠蒸鲈鱼开胃，菠萝炒饭配料给得很足", "inline");
assert(!/朋友|约上|排队|价格|等了|正宗|满足|来了|吃了一顿/.test(storyOf(noArrival)), `invented an arrival: ${noArrival}`);
assert(storyOf(noArrival).includes("青柠蒸鲈鱼") && storyOf(noArrival).includes("菠萝炒饭"), `dropped a dish: ${noArrival}`);

const glued = "朋友之前提过的店，这次总算约上一起过来。河虾冬阴功汤的虾真的很新鲜，是我下次还想点的一道🍤青柠蒸鲈鱼酸香的味道刚好提鲜，特别开胃。菠萝炒饭配料给得很足，一口下去口感很丰富店员服务也很热情周到，吃完心情蛮好的。";
const unglued = storyOf(deliver(glued, note, "inline"));
assert(!/还想点|心情蛮好/.test(unglued), `template clause survived: ${unglued}`);
  assert(
    /丰富(?:。|\p{Extended_Pictographic})[\s\S]*店员服务/u.test(unglued) || /丰富\n+店员服务/.test(unglued),
    `service stayed glued: ${unglued}`,
  );
assert(/青柠蒸鲈鱼/.test(unglued) && /河虾冬阴功汤/.test(unglued), `a dish was lost while splitting: ${unglued}`);
assert(/开胃/.test(unglued), `noted 开胃 was not restored: ${unglued}`);
assertShape(unglued, "unglued");

const broth = "朋友之前提过centralworld的Baan Ying。这次总算约上一起过来。河虾冬阴功汤的虾真的很新鲜，汤头喝着也顺口青柠蒸鲈鱼酸香的味道刚好提鲜。菠萝炒饭配料给得很足，一口下去口感很丰富。店员服务也很热情周到。";
const brothStory = storyOf(deliver(broth, "朋友之前提过 centralworld 的 Baan Ying。这次总算约上一起过来。河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。青柠蒸鲈鱼特别开胃，酸香的味道刚好提鲜。店员服务也很热情周到。", "inline"));
assert(!/汤头|顺口/.test(brothStory), `invented broth note survived: ${brothStory}`);
assert(/特别开胃/.test(brothStory), `开胃 was not put back on the fish: ${brothStory}`);
assertShape(brothStory, "broth");

const droppedArrival = "河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。青柠蒸鲈鱼特别开胃。店员服务也很热情周到。\n\nbaan ying";
const restored = storyOf(deliver(droppedArrival, note, "standalone"));
assert(!restored.includes("朋友之前提过"), `note replaced the caption: ${restored}`);
assert(restored.includes("河虾冬阴功汤") && restored.includes("店员服务"), `meal was dropped: ${restored}`);
assert(!/^baan ying$/im.test(restored), `bare restaurant name survived: ${restored}`);

const banned = ensureCaptionEmojis(sample, style("natural"), `${note} 不要表情`);
assert(emojiCount(banned) === 0, `emoji survived a ban: ${banned}`);

const serviceOnly = ensureCaptionEmojis("店员服务也很热情周到。这次总算约上一起过来。", style("none"), note);
assert(emojiCount(serviceOnly) === 0, `added a fixed emoji: ${serviceOnly}`);

const keptEmoji = ensureCaptionEmojis("🍤河虾冬阴功汤的虾真的很新鲜。店员服务也很热情周到。", style("none"), note);
assert(keptEmoji.includes("🍤"), `stripped a model emoji: ${keptEmoji}`);
assert(emojiCount(keptEmoji) === 1, `stacked another emoji: ${keptEmoji}`);

const start = deliver(sample, note, "inline", 0);
const end = deliver(sample, note, "inline", 0.01);
assert(emojiCount(storyOf(start)) === 1 && emojiCount(storyOf(end)) === 1, "variation changed the emoji count");
assert(start !== end, "emoji position did not vary");

const modelShaped = "朋友之前提过 Centralworld 的 baan ying。这次总算约上一起过来。河虾冬阴功汤的虾真的很新鲜，是我印象比较深的一道。菠萝炒饭配料给得很足，一口下去口感很丰富。青柠蒸鲈鱼酸香的味道刚好提鲜，也很开胃。味道很正宗，吃起来就是很熟悉的泰式风味。店员服务很热情周到，招呼得很舒服。吃下来感觉很顺畅。";
const repaired = deliver(modelShaped, note, "inline");
const repairedStory = storyOf(repaired);
assertShape(repaired, "model shaped");
assert(!/熟悉的泰式风味|感觉很顺畅|喝起来很开胃|印象比较深|招呼得很舒服/.test(repairedStory), `stock lines survived: ${repairedStory}`);
assert(/青柠蒸鲈鱼/.test(repairedStory) && /开胃/.test(repairedStory), `fish taste was dropped: ${repairedStory}`);
assert((repairedStory.match(/开胃/g) ?? []).length === 1, `开胃 repeated: ${repairedStory}`);
assert(/店员服务/.test(repairedStory), `service was dropped: ${repairedStory}`);

const joined = parseGeneratedContent(
  JSON.stringify({
    titles: ["标题一", "标题二", "标题三"],
    captionParagraphs: ["朋友之前提过这家店，这次总算约上。", "河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。"],
    hashtags: ["#BaanYing曼谷", "#曼谷美食", "#泰餐", "#centralwOrld", "#探店"],
    mainTitle: "标题",
    subTitle: "副标题",
    selectedPhotoIndex: 0,
    selectedPhotoIndexes: [0],
    photoSelectionReason: "",
    remainingPhotoOrder: [],
    remainingOrderPattern: "",
  }),
).caption;
assert(joined === "朋友之前提过这家店，这次总算约上。\n\n河虾冬阴功汤的虾真的很新鲜。菠萝炒饭配料给得很足。", joined);
const fromParagraphs = deliver(joined, note, "inline");
assertShape(fromParagraphs, "joined paragraphs");
assert(storyOf(fromParagraphs).includes("总算约上") && storyOf(fromParagraphs).includes("河虾冬阴功汤"), fromParagraphs);

console.log("validate-caption-shape: ok");
