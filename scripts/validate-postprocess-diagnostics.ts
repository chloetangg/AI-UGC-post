import { readFileSync } from "node:fs";
import { applyBrandSpelling, formatPlatformNicknameRule } from "../lib/brand-spelling";
import { ensureCaptionEmojis, fixFruitEmojisInTitles } from "../lib/caption-emoji";
import { formatNaturalHumanWritingRules } from "../lib/caption-voice";
import { collapseRepeatedSkeletons } from "../lib/caption-story";
import { ensureContentLock } from "../lib/content-lock";
import { ensureEvidenceLedCopy, ensureGroundedHeadlineCopy, normalizeExactCentralworld } from "../lib/content-evidence";
import { layoutCoverOverlay } from "../lib/cover/cover-title";
import { selectOneValidSubtitle } from "../lib/cover/subtitle-units";
import { formatCoverTitleStaticRules } from "../lib/cover/cover-rules";
import { buildSystemPrompt } from "../lib/generate-prompt";
import { enforceCustomerEvidence } from "../lib/customer-evidence";
import { headlinesSharePoint, separateOverlappingHeadlines } from "../lib/headline-overlap";
import { ensureGenerationVariation, planGenerationVariation } from "../lib/generation-variation";
import { ensureTitleFormats } from "../lib/title-formats";
import { finalizeOfficialLocationTime, scrubForeignBranchFacts } from "../lib/locations";
import type { HumanStyleSelection } from "../lib/human-style/select";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const note = "是朋友介绍来吃的很好吃";
const branch = "Baan Ying (centralwOrld, 3rd Floor)";
const rawCaption = [
  "朋友说不错就跟着找来了，centralworld里的Baan Ying还挺好找的。",
  "菠萝炒饭配料很足，吃着很香。芒果糯米饭的芒果也新鲜，咖喱蟹肉很下饭。",
  "服务真的很到位，吃得挺舒服。",
].join("\n\n");
const rawTitles = ["店员服务真的很热情", "菠萝炒饭配料超足", "芒果糯米饭的芒果很新鲜"] as [string, string, string];
const context = {
  diningNote: note,
  dishes: ["咖喱蟹肉", "芒果糯米饭", "菠萝炒饭"],
  enjoyMost: ["食物味道正宗美味", "店员服务热情周到", "店里菜品选择丰富"],
  recommendTo: ["咖喱蟹肉很下饭", "芒果糯米饭的芒果很新鲜", "菠萝炒饭配料很足"],
  branch,
};
const style = {
  primaryStyle: "casual",
  intensity: 0.4,
  variation: 0.2,
  emojiMode: "natural",
} as HumanStyleSelection;

function orphanEmoji(text: string) {
  return text.split(/\n\n/).some((paragraph) => {
    const words = paragraph.replace(/[\s。！？!?\p{Extended_Pictographic}]/gu, "");
    if (!words && /\p{Extended_Pictographic}/u.test(paragraph)) return true;
    return /(?:^|[。！？!?])\s*\p{Extended_Pictographic}+\s*[。！？!?]/u.test(paragraph);
  });
}

const once = ensureCaptionEmojis(rawCaption, style, note);
const twice = ensureCaptionEmojis(once, style, note);
assert(once.includes("朋友说不错就跟着找来了"), `emoji replaced the visit: ${once}`);
assert(once.includes("centralworld") && /baan\s*ying/i.test(once), `emoji deleted the store: ${once}`);
assert(once.includes("还挺好找"), `emoji dropped the finding detail: ${once}`);
assert(!once.includes(note), `emoji pasted the note: ${once}`);
assert(once.includes("芒果糯米饭的芒果也新鲜，咖喱蟹肉很下饭"), `emoji split the dish sentence: ${once}`);
assert(once.includes("菠萝炒饭配料很足") && once.includes("服务真的很到位"), `emoji dropped a fact: ${once}`);
assert(!orphanEmoji(once), `emoji became its own sentence: ${once}`);
assert(once === twice, `second emoji pass changed the caption:\n${once}\n${twice}`);
assert((once.match(/\n\n/g) ?? []).length === (rawCaption.match(/\n\n/g) ?? []).length, `emoji flattened paragraphs: ${JSON.stringify(once)}`);

const evidenced = ensureEvidenceLedCopy({
  titles: rawTitles,
  caption: rawCaption,
  coverTitle: "商场里的舒服泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
  context,
});
assert((evidenced.caption.match(/\n\n/g) ?? []).length >= 2, `evidence copy flattened paragraphs: ${JSON.stringify(evidenced.caption)}`);
assert(evidenced.caption.includes("朋友说不错就跟着找来了"), `evidence copy dropped the visit: ${evidenced.caption}`);
assert(evidenced.caption.includes("芒果糯米饭的芒果也新鲜，咖喱蟹肉很下饭"), `evidence copy split the dish sentence: ${evidenced.caption}`);

const withServiceEmoji = rawCaption.replace("服务真的很到位", "😌服务真的很到位");
const collapsed = collapseRepeatedSkeletons(withServiceEmoji);
assert(!/😌。/.test(collapsed), `variation skeleton split the emoji: ${collapsed}`);
assert(collapsed.includes("😌服务真的很到位"), `variation detached the emoji from service: ${collapsed}`);
const varied = ensureGenerationVariation({
  titles: rawTitles,
  caption: withServiceEmoji,
  coverTitle: "商场里的舒服泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
  plan: planGenerationVariation({ context, variantIndex: 0 }),
  context,
  variantIndex: 0,
});
assert(!/😌。/.test(varied.caption) && !orphanEmoji(varied.caption), `variation isolated the emoji: ${varied.caption}`);
assert(varied.caption.includes("服务") && varied.caption.includes("到位"), `variation dropped the service: ${varied.caption}`);
assert(varied.caption.includes("朋友说不错就跟着找来了"), `variation dropped the visit: ${varied.caption}`);
assert(varied.caption.includes("芒果也新鲜") && varied.caption.includes("咖喱蟹肉很下饭"), `variation dropped a dish fact: ${varied.caption}`);
assert(!/熟悉的泰式风味|点餐不纠结|味道很正宗/.test(varied.caption), `variation added a stock line: ${varied.caption}`);

const locked = ensureContentLock({
  titles: ["店员服务真的很热情", "菠萝炒饭配料超足", "🇹🇭centralwOrld芒果糯米饭的芒果很新鲜🥭"],
  caption: rawCaption,
  coverTitle: "商场里的舒服泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
  context,
});
assert(!locked.titles.some((title) => /菠萝炒饭的芒果/.test(title)), `content lock mixed dishes: ${locked.titles.join(" | ")}`);
assert(locked.titles.some((title) => title.includes("芒果糯米饭") && title.includes("新鲜")), `mango evaluation was moved: ${locked.titles.join(" | ")}`);
assert(locked.titles.some((title) => title.includes("菠萝炒饭") && /配料/.test(title)), `pineapple evaluation was moved: ${locked.titles.join(" | ")}`);
const evidencedTitles = enforceCustomerEvidence({
  titles: locked.titles,
  caption: locked.caption,
  coverTitle: locked.coverTitle,
  coverSubtitle: locked.coverSubtitle,
  note,
  dishes: context.dishes,
  enjoyMost: context.enjoyMost,
  recommendTo: context.recommendTo,
  branch,
});
assert(!evidencedTitles.titles.some((title) => /菠萝炒饭的芒果/.test(title)), `customer evidence mixed dishes: ${evidencedTitles.titles.join(" | ")}`);
assert(
  evidencedTitles.titles.some((title) => title.includes("芒果糯米饭") && title.includes("新鲜")),
  `customer evidence overwrote the mango title: ${evidencedTitles.titles.join(" | ")}`,
);

const abVisit = {
  note,
  dishes: ["Pineapple Fried Rice", "Mango Sticky Rice", "Crab Meat Curry"],
  enjoyMost: ["在购物商场里的泰餐连锁", "店员服务热情周到", "食物味道正宗美味"],
  recommendTo: ["菠萝炒饭配料很足", "芒果糯米饭芒果很新鲜", "咖喱蟹肉很下饭"],
  branch,
};
const newTitles = [
  "centralwOrld商场里常去的一家泰餐，每次来都很稳",
  "服务真的很舒服，店员都很热情",
  "🇹🇭这道咖喱蟹肉超级下饭🦀",
] as [string, string, string];
const keptNew = enforceCustomerEvidence({
  titles: newTitles,
  caption: "朋友之前推荐的一家。",
  coverTitle: "服务很舒服的泰餐",
  coverSubtitle: "咖喱蟹肉超下饭",
  ...abVisit,
});
assert(keptNew.titles[0] === newTitles[0], `scene title became a template: ${keptNew.titles.join(" | ")}`);
assert(keptNew.titles[1] === newTitles[1] && keptNew.titles[2] === newTitles[2], `other new titles changed: ${keptNew.titles.join(" | ")}`);
assert(!keptNew.titles.some((title) => title.includes("真的很好吃")), `new titles gained the generic hook: ${keptNew.titles.join(" | ")}`);

const oldTitles = ["店员服务真的很热情", "菠萝炒饭配料超足", "芒果糯米饭的芒果很新鲜"] as [string, string, string];
const keptOld = enforceCustomerEvidence({
  titles: oldTitles,
  caption: rawCaption,
  coverTitle: "商场里的舒服泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
  ...abVisit,
});
assert(
  keptOld.titles[0] === oldTitles[0] && keptOld.titles[1] === oldTitles[1] && keptOld.titles[2] === oldTitles[2],
  `old titles became a template: ${keptOld.titles.join(" | ")}`,
);
assert(!keptOld.titles.some((title) => /真的很好吃|值得点/.test(title)), `old titles gained a template: ${keptOld.titles.join(" | ")}`);

const repaired = enforceCustomerEvidence({
  titles: ["真的好好吃", newTitles[1], newTitles[2]],
  caption: "朋友之前推荐的一家。",
  coverTitle: "服务很舒服的泰餐",
  coverSubtitle: "咖喱蟹肉超下饭",
  ...abVisit,
});
assert(
  repaired.titles[0].includes("芒果糯米饭") && repaired.titles[0].includes("新鲜") && !repaired.titles[0].includes("真的很好吃"),
  `generic title was not repaired from the given fact: ${repaired.titles[0]}`,
);
const retargeted = enforceCustomerEvidence({
  titles: ["菠萝炒饭的芒果很新鲜", newTitles[1], "这道咖喱蟹肉超级下饭"],
  caption: "朋友之前推荐的一家。",
  coverTitle: "服务很舒服的泰餐",
  coverSubtitle: "咖喱蟹肉超下饭",
  ...abVisit,
});
assert(
  retargeted.titles[0].includes("芒果糯米饭") && retargeted.titles[0].includes("新鲜") && !retargeted.titles[0].includes("菠萝炒饭"),
  `mismatched dish was replaced with a template: ${retargeted.titles[0]}`,
);

const voice = formatNaturalHumanWritingRules();
assert(voice.includes("咸香裹着蟹肉") && voice.includes("不腻") && voice.includes("招呼都很自然"), "prompt lost the texture constraint");
assert(voice.includes("常去") && voice.includes("每次来"), "prompt lost the repeat-visit constraint");
const promptSource = readFileSync(new URL("../lib/generate-prompt.ts", import.meta.url), "utf8");
assert(promptSource.includes("朋友介绍 is not 常去 or 每次来都很稳"), "title prompt lost the friend-recommendation constraint");
assert(promptSource.includes("朋友介绍来吃 is one recommendation, not a history of visits"), "visit prompt lost the recommendation constraint");

const mallContext = {
  diningNote: note,
  branch,
  enjoyMost: ["在购物商场里的泰餐连锁", "店员服务热情周到", "食物味道正宗美味"],
  recommendTo: ["菠萝炒饭配料很足", "芒果糯米饭芒果很新鲜", "咖喱蟹肉很下饭"],
  dishes: ["Pineapple Fried Rice", "Mango Sticky Rice", "Crab Meat Curry"],
};
const mallTitles = [
  "商场里常去的一家泰餐，每次来都很稳",
  "服务真的很舒服，店员都很热情",
  "这道咖喱蟹肉超级下饭",
] as [string, string, string];
const unnamedMall = ensureGroundedHeadlineCopy({
  titles: mallTitles,
  coverTitle: "服务很舒服的泰餐",
  coverSubtitle: "咖喱蟹肉超下饭",
  context: mallContext,
});
assert(unnamedMall.titles[0] === mallTitles[0], `商场 title gained a mall name: ${unnamedMall.titles[0]}`);
assert(
  !unnamedMall.titles.some((title) => /central\s*world/i.test(title)),
  `titles were given CentralWorld: ${unnamedMall.titles.join(" | ")}`,
);
assert(unnamedMall.titles[1] === mallTitles[1] && unnamedMall.titles[2] === mallTitles[2], `other titles changed: ${unnamedMall.titles.join(" | ")}`);

const namedMall = ensureGroundedHeadlineCopy({
  titles: mallTitles,
  coverTitle: "服务很舒服的泰餐",
  coverSubtitle: "咖喱蟹肉超下饭",
  context: { ...mallContext, diningNote: "是朋友介绍来吃的，在centralworld" },
});
assert(
  namedMall.titles[0] === "centralwOrld商场里常去的一家泰餐，每次来都很稳",
  `named mall was not woven into the mall scene: ${namedMall.titles[0]}`,
);
assert(namedMall.titles[1] === mallTitles[1] && namedMall.titles[2] === mallTitles[2], `named-mall pass changed other titles: ${namedMall.titles.join(" | ")}`);

const placeTitles = ["这家泰餐值得再来", "菠萝炒饭配料超足", "店员服务真的很热情"] as [string, string, string];
const placeCovers = { coverTitle: "服务很舒服的泰餐", coverSubtitle: "菠萝炒饭配料很足" };
const unnamedPlace = ensureGroundedHeadlineCopy({
  titles: placeTitles,
  ...placeCovers,
  context: {
    ...mallContext,
    diningNote: "这家泰餐值得再来",
  },
});
assert(
  unnamedPlace.titles[0] === placeTitles[0] && unnamedPlace.titles[1] === placeTitles[1] && unnamedPlace.titles[2] === placeTitles[2],
  `branch or mall option rewrote titles: ${unnamedPlace.titles.join(" | ")}`,
);
assert(
  ![...unnamedPlace.titles, unnamedPlace.coverTitle, unnamedPlace.coverSubtitle].some((field) => /central\s*world|尚泰世界/i.test(field)),
  `unnamed place gained a mall name: ${unnamedPlace.titles.join(" | ")} | ${unnamedPlace.coverTitle}`,
);

const namedPlace = ensureGroundedHeadlineCopy({
  titles: placeTitles,
  ...placeCovers,
  context: {
    ...mallContext,
    diningNote: "这家泰餐值得再来",
    recommendTo: [...mallContext.recommendTo, "在centralworld吃的"],
  },
});
assert(namedPlace.titles[0] === placeTitles[0], `non-location title was rewritten: ${namedPlace.titles[0]}`);
assert(namedPlace.titles[1] === placeTitles[1] && namedPlace.titles[2] === placeTitles[2], `named note changed other titles: ${namedPlace.titles.join(" | ")}`);
assert(!/centralwOrld逛街顺便吃泰餐|在centralwOrld吃泰餐/.test(namedPlace.titles.join("")), `named note used a location template: ${namedPlace.titles.join(" | ")}`);

assert(normalizeExactCentralworld("CentralWorld这家泰餐") === "centralwOrld这家泰餐", "CentralWorld spelling was not canonicalized");
assert(normalizeExactCentralworld("central world") === "centralwOrld", "spaced central world spelling was not canonicalized");
assert(normalizeExactCentralworld(mallTitles[0]) === mallTitles[0], "商场-only title was rewritten by spelling");
const spelledHeadlines = ensureGroundedHeadlineCopy({
  titles: ["CentralWorld这家泰餐很舒服", "central world菠萝炒饭配料超足", "店员服务真的很热情"],
  coverTitle: "CentralWorld这家服务很热情",
  coverSubtitle: "服务很热情",
  context: { ...mallContext, diningNote: "服务很舒服" },
});
assert(spelledHeadlines.titles[0] === "centralwOrld这家泰餐很舒服", `spelling title changed: ${spelledHeadlines.titles[0]}`);
assert(spelledHeadlines.titles[1] === "centralwOrld菠萝炒饭配料超足", `spaced spelling was doubled or dropped: ${spelledHeadlines.titles[1]}`);
assert((spelledHeadlines.titles[1].match(/centralwOrld/g) ?? []).length === 1, `mall name was repeated: ${spelledHeadlines.titles[1]}`);
assert(spelledHeadlines.titles[2] === "店员服务真的很热情", `service title changed: ${spelledHeadlines.titles[2]}`);
assert(spelledHeadlines.coverTitle === "centralwOrld这家服务很热情", `cover spelling changed: ${spelledHeadlines.coverTitle}`);

function keptVisitHeadlines(input: {
  titles: [string, string, string];
  coverTitle: string;
  coverSubtitle: string;
}) {
  const caption = "朋友介绍来吃的。菠萝炒饭配料很足。芒果糯米饭的芒果很新鲜。店员服务很热情。";
  const evidenced = ensureEvidenceLedCopy({
    titles: input.titles,
    caption,
    coverTitle: input.coverTitle,
    coverSubtitle: input.coverSubtitle,
    context: mallContext,
  });
  const overlay = layoutCoverOverlay(evidenced.coverTitle, evidenced.coverSubtitle, evidenced.titles, mallContext);
  const grounded = ensureGroundedHeadlineCopy({
    titles: evidenced.titles,
    coverTitle: overlay.title,
    coverSubtitle: overlay.subtitle,
    context: mallContext,
  });
  const locked = ensureContentLock({
    titles: grounded.titles,
    caption,
    coverTitle: grounded.coverTitle,
    coverSubtitle: grounded.coverSubtitle,
    context: mallContext,
  });
  const allocated = enforceCustomerEvidence({
    titles: locked.titles,
    caption: locked.caption,
    coverTitle: locked.coverTitle,
    coverSubtitle: locked.coverSubtitle,
    note: mallContext.diningNote,
    dishes: mallContext.dishes,
    enjoyMost: mallContext.enjoyMost,
    recommendTo: mallContext.recommendTo,
    branch: mallContext.branch,
  });
  return {
    titles: allocated.titles,
    coverTitle: allocated.coverTitle,
    coverSubtitle: selectOneValidSubtitle({
      note: mallContext.diningNote,
      preferred: allocated.coverSubtitle,
    }),
  };
}

const friendTitles = ["服务真的很贴心", "菠萝炒饭配料超足", "朋友推荐来吃的泰餐"] as [string, string, string];
const friendKept = keptVisitHeadlines({
  titles: friendTitles,
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
});
assert(friendKept.coverTitle === "朋友推荐的泰餐", `friend cover became a template: ${friendKept.coverTitle}`);
assert(friendKept.coverSubtitle === "菠萝炒饭配料很足", `friend subtitle became a template: ${friendKept.coverSubtitle}`);
assert(
  !/泰餐推荐|真的很好吃|central\s*world/i.test(`${friendKept.coverTitle}${friendKept.coverSubtitle}`),
  `friend cover gained a mall or a stock line: ${friendKept.coverTitle} | ${friendKept.coverSubtitle}`,
);
assert(friendKept.titles[0] === friendTitles[0] && friendKept.titles[1] === friendTitles[1], `friend post titles changed: ${friendKept.titles.join(" | ")}`);
assert(friendKept.titles[2] === "朋友推荐来吃的泰餐", `friend post title became a service hook: ${friendKept.titles[2]}`);
assert(!friendKept.titles.some((title) => title.includes("曼谷吃饭这家服务很舒服")), `service hook replaced a title: ${friendKept.titles.join(" | ")}`);

const mallStopTitles = ["朋友介绍来的 服务真的很贴心", "菠萝炒饭配料真的很足", "芒果糯米饭芒果很新鲜"] as [string, string, string];
const mallStopKept = keptVisitHeadlines({
  titles: mallStopTitles,
  coverTitle: "逛商场顺路吃的泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
});
assert(mallStopKept.coverTitle === "逛商场顺路吃的泰餐", `mall-stop cover was rewritten: ${mallStopKept.coverTitle}`);
assert(mallStopKept.coverSubtitle === "菠萝炒饭配料很足", `mall-stop subtitle was rewritten: ${mallStopKept.coverSubtitle}`);
assert(
  mallStopKept.titles[0] === mallStopTitles[0] && mallStopKept.titles[1] === mallStopTitles[1] && mallStopKept.titles[2] === mallStopTitles[2],
  `mall-stop titles were rewritten: ${mallStopKept.titles.join(" | ")}`,
);
assert(!/泰餐推荐|真的很好吃|central\s*world/i.test(`${mallStopKept.coverTitle}${mallStopKept.coverSubtitle}`), `mall-stop cover gained a template: ${mallStopKept.coverTitle}`);

const mismatchedKept = keptVisitHeadlines({
  titles: ["菠萝炒饭的芒果很新鲜", "服务真的很舒服，店员都很热情", "这道咖喱蟹肉超级下饭"],
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
});
assert(
  mismatchedKept.titles[0] === "芒果糯米饭的芒果很新鲜",
  `mismatched dish was rewritten as a template: ${mismatchedKept.titles[0]}`,
);
assert(mismatchedKept.titles[1] === "服务真的很舒服，店员都很热情" && mismatchedKept.titles[2] === "这道咖喱蟹肉超级下饭", `mismatch repair changed other titles: ${mismatchedKept.titles.join(" | ")}`);
assert(mismatchedKept.coverTitle === "朋友推荐的泰餐" && mismatchedKept.coverSubtitle === "菠萝炒饭配料很足", `mismatch repair changed the cover: ${mismatchedKept.coverTitle} | ${mismatchedKept.coverSubtitle}`);

const spelledKept = keptVisitHeadlines({
  titles: ["CentralWorld这家服务很热情", "central world菠萝炒饭配料超足", "朋友推荐来吃的泰餐"],
  coverTitle: "central world这家泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
});
assert(spelledKept.titles[0] === "centralwOrld这家服务很热情", `existing mall spelling changed: ${spelledKept.titles[0]}`);
assert(spelledKept.titles[1] === "centralwOrld菠萝炒饭配料超足", `spaced mall spelling changed: ${spelledKept.titles[1]}`);
assert((spelledKept.titles[1].match(/centralwOrld/g) ?? []).length === 1, `spelling inserted another mall: ${spelledKept.titles[1]}`);
assert(spelledKept.titles[2] === "朋友推荐来吃的泰餐", `spelling pass replaced the friend title: ${spelledKept.titles[2]}`);
assert(spelledKept.coverTitle === "centralwOrld这家泰餐", `cover spelling became a template: ${spelledKept.coverTitle}`);
assert(spelledKept.coverSubtitle === "菠萝炒饭配料很足", `spelling pass changed the subtitle: ${spelledKept.coverSubtitle}`);
assert(!/泰餐推荐/.test(`${spelledKept.coverTitle}${spelledKept.titles.join("")}`), `spelling added 泰餐推荐: ${spelledKept.coverTitle}`);

function hasBareStoreOpener(caption: string) {
  return caption.split(/(?<=[。！？!?])/u).some((sentence) => /^在\s*(?:central\s*world的\s*)?baan\s*ying。?$/i.test(sentence.trim()));
}
const located = finalizeOfficialLocationTime({
  caption: rawCaption,
  branch,
  placement: "inline",
}).caption;
assert(!hasBareStoreOpener(located), `location prepended a second opener: ${located}`);
const friendMeal = finalizeOfficialLocationTime({
  caption: "朋友推荐来吃的。咖喱蟹肉很下饭。",
  branch,
  placement: "inline",
}).caption;
assert(!hasBareStoreOpener(friendMeal), `friend caption gained a bare store opener: ${friendMeal}`);
assert(friendMeal.includes("咖喱蟹肉很下饭"), `friend caption changed the dish point: ${friendMeal}`);
const dishLed = finalizeOfficialLocationTime({
  caption: "咖喱蟹肉很下饭。芒果糯米饭的芒果很新鲜。",
  branch,
  placement: "inline",
}).caption;
assert(!hasBareStoreOpener(dishLed), `dish caption gained a bare store opener: ${dishLed}`);
assert(dishLed.includes("咖喱蟹肉很下饭") && dishLed.includes("芒果很新鲜"), `dish caption changed a point: ${dishLed}`);
const emptyInline = finalizeOfficialLocationTime({
  caption: "   ",
  branch,
  placement: "inline",
}).caption;
assert(!hasBareStoreOpener(emptyInline), `empty caption became a store opener: ${emptyInline}`);
const emptyStandalone = finalizeOfficialLocationTime({
  caption: "",
  branch,
  placement: "standalone",
  format: "A",
}).caption;
assert(!hasBareStoreOpener(emptyStandalone), `empty standalone caption opened with the store: ${emptyStandalone}`);
assert(/📍/.test(emptyStandalone) && /⏰/.test(emptyStandalone), `empty standalone caption lost the official block: ${emptyStandalone}`);
const naturalVisit = "上次来曼谷的时候就在这家店吃过，咖喱蟹肉很下饭。";
const naturalLocated = finalizeOfficialLocationTime({
  caption: naturalVisit,
  branch,
  placement: "inline",
}).caption;
assert(naturalLocated.includes("上次来曼谷的时候就在这家店吃过"), `natural visit was dropped: ${naturalLocated}`);
assert(naturalLocated.includes("咖喱蟹肉很下饭"), `natural visit changed the dish point: ${naturalLocated}`);
assert(!hasBareStoreOpener(naturalLocated), `natural visit gained a bare store opener: ${naturalLocated}`);
const friendTwice = finalizeOfficialLocationTime({
  caption: friendMeal,
  branch,
  placement: "inline",
}).caption;
assert(friendTwice.includes("咖喱蟹肉很下饭"), `second pass changed the dish point: ${friendTwice}`);
assert(!hasBareStoreOpener(friendTwice), `second pass added a bare opener: ${friendTwice}`);
assert(
  (friendTwice.match(/central\s*world/gi) ?? []).length === (friendMeal.match(/central\s*world/gi) ?? []).length,
  `second pass repeated the mall: ${friendTwice}`,
);
assert(
  (friendTwice.match(/baan\s*ying/gi) ?? []).length === (friendMeal.match(/baan\s*ying/gi) ?? []).length,
  `second pass repeated the restaurant: ${friendTwice}`,
);
assert(located.includes("朋友说不错就跟着找来了") && located.includes("还挺好找"), `location deleted the visit: ${located}`);
assert((located.match(/baan\s*ying/gi) ?? []).length === 1, `location repeated the restaurant: ${located}`);

const bossLine = "服务员态度都很好，抬头还撞见老板，是真的帅\n在centralworld的Baan Ying吃下来整个人都放松。";
const bossInline = finalizeOfficialLocationTime({
  caption: bossLine,
  branch,
  placement: "inline",
}).caption;
assert(!/帅在/.test(bossInline), `service line was glued to the place: ${bossInline}`);
assert(bossInline.includes("服务员态度都很好") && bossInline.includes("抬头还撞见老板") && bossInline.includes("是真的帅"), `service line was deleted: ${bossInline}`);
assert(bossInline.includes("在centralworld的Baan Ying吃下来整个人都放松"), `written place line was deleted: ${bossInline}`);
assert(/帅。/.test(bossInline), `service line lost its sentence boundary: ${bossInline}`);
const bossStandalone = finalizeOfficialLocationTime({
  caption: "服务员态度都很好，抬头还撞见老板，是真的帅。",
  branch,
  placement: "standalone",
  format: "A",
}).caption;
assert(bossStandalone.includes("服务员态度都很好") && bossStandalone.includes("是真的帅"), `standalone dropped the service line: ${bossStandalone}`);
assert(!/帅在/.test(bossStandalone), `standalone glued the place onto the service line: ${bossStandalone}`);
assert(/📍/.test(bossStandalone) && /⏰/.test(bossStandalone), `standalone lost the official block: ${bossStandalone}`);

const placeAlready = "在centralworld的Baan Ying吃过。服务员态度都很好，抬头还撞见老板，是真的帅。吃下来整个人都放松。";
const placeKept = finalizeOfficialLocationTime({
  caption: placeAlready,
  branch,
  placement: "inline",
}).caption;
assert(!/帅在/.test(placeKept), `existing place broke the next sentence: ${placeKept}`);
assert(placeKept.includes("在centralworld的Baan Ying吃过") && placeKept.includes("是真的帅。") && placeKept.includes("吃下来整个人都放松"), `existing place line was rewritten: ${placeKept}`);
assert((placeKept.match(/baan\s*ying/gi) ?? []).length === 1, `existing place gained another store sentence: ${placeKept}`);

const spelled = applyBrandSpelling(rawCaption, {
  mall: "centralworld",
  restaurant: "baan ying",
  mallPattern: /central\s*world/gi,
});
assert(spelled.includes("\n\n") && spelled.includes("朋友说不错就跟着找来了"), `spelling changed the sentence: ${spelled}`);
assert(spelled.includes("芒果糯米饭的芒果也新鲜，咖喱蟹肉很下饭"), `spelling split a sentence: ${spelled}`);

const nicknameSpelling = {
  mall: "centralworld",
  restaurant: "Baan Ying" as const,
  mallPattern: /central\s*world/gi,
};
assert(
  applyBrandSpelling("刷到小红书推荐就找来了", nicknameSpelling) === "刷到小红薯推荐就找来了",
  "caption kept 小红书",
);
assert(applyBrandSpelling("小红书上看到有人推荐", nicknameSpelling) === "小红薯上看到有人推荐", "second 小红书 form stayed");
assert(applyBrandSpelling("小红书推荐的这家店", nicknameSpelling) === "小红薯推荐的这家店", "third 小红书 form stayed");
assert(applyBrandSpelling("泰餐这家服务好舒服", nicknameSpelling) === "泰餐这家服务好舒服", "cover title was rewritten");
assert(applyBrandSpelling("这口冬阴功很香", nicknameSpelling) === "这口冬阴功很香", "cover subtitle was rewritten");
assert(applyBrandSpelling("店员服务真的很贴心", nicknameSpelling) === "店员服务真的很贴心", "post title was rewritten");
assert(applyBrandSpelling("#小红书探店", nicknameSpelling) === "#小红薯探店", "hashtag kept 小红书");
assert(applyBrandSpelling("#曼谷美食", nicknameSpelling) === "#曼谷美食", "unrelated hashtag changed");
assert(applyBrandSpelling("红薯粉很好吃，小红花开了", nicknameSpelling) === "红薯粉很好吃，小红花开了", "unrelated words changed");
assert(
  applyBrandSpelling("刷到小红书推荐，来了central world的Baan Ying", nicknameSpelling) === "刷到小红薯推荐，来了centralworld的Baan Ying",
  "nickname disturbed brand spelling",
);
const platformRule = formatPlatformNicknameRule();
const systemPrompt = buildSystemPrompt();
const coverRules = formatCoverTitleStaticRules();
assert(platformRule.includes("小红薯") && platformRule.includes("Do not write 小红书"), "platform nickname rule is missing");
assert(systemPrompt.includes(platformRule), "consumer prompt missed the platform rule");
assert(coverRules.includes("泰餐这家服务好舒服") && systemPrompt.includes("泰餐这家服务好舒服"), "splice example is missing from the title prompts");
assert(systemPrompt.includes("another supported point exists"), "titles can still repeat one highlight when another fact exists");
assert(coverRules.includes("If mainTitle is a dish") && coverRules.includes("do not invent one"), "cover subtitle can still restate the title");
assert(systemPrompt.includes("TITLE MATERIAL") && systemPrompt.includes("no second call"), "title material strategy is missing");
assert(systemPrompt.includes("很好吃") && systemPrompt.includes("居然 / 没想到 / 一定要"), "thin praise can still be inflated");
assert(systemPrompt.includes("TITLE CHECK") && systemPrompt.includes("这家店不错"), "title self-check is missing");
assert(coverRules.includes("这家店服务不错") && coverRules.includes("make a reader stop"), "cover title can stay a bare review");
assert(coverRules.includes("paying") && systemPrompt.includes("Do not repeat the cover line"), "subtitle and post title can still echo the cover");

function keptCover(title: string, subtitle: string) {
  return layoutCoverOverlay(title, subtitle, [], mallContext);
}
const friendCover = keptCover("朋友推荐的泰餐", "菠萝炒饭配料很足");
assert(friendCover.title === "朋友推荐的泰餐" && friendCover.subtitle === "菠萝炒饭配料很足", `friend cover changed: ${friendCover.title} | ${friendCover.subtitle}`);
const serviceCover = keptCover("店员服务真的很周到", "菠萝炒饭配料很足");
assert(serviceCover.title === "店员服务真的很周到" && serviceCover.subtitle === "菠萝炒饭配料很足", `service cover was replaced: ${serviceCover.title} | ${serviceCover.subtitle}`);
assert(!/很香/.test(`${serviceCover.title}${serviceCover.subtitle}`), `service cover invented aroma: ${serviceCover.subtitle}`);
const longCover = keptCover("朋友带我来吃的这家泰餐", "菠萝炒饭配料很足");
assert(longCover.title === "朋友带我来吃的这家泰餐" && longCover.subtitle === "菠萝炒饭配料很足", `long cover was replaced: ${longCover.title} | ${longCover.subtitle}`);
const tastyCover = keptCover("菠萝炒饭很好吃", "冬阴功很好吃");
assert(tastyCover.title === "菠萝炒饭很好吃" && tastyCover.subtitle === "冬阴功很好吃", `tasty cover became the note: ${tastyCover.title} | ${tastyCover.subtitle}`);
const brokenSub = keptCover("朋友推荐的泰餐", "真的非常");
assert(brokenSub.title === "朋友推荐的泰餐", `invalid subtitle rewrote the main: ${brokenSub.title}`);
assert(!/很香|很满足/.test(brokenSub.subtitle), `invalid subtitle invented a taste: ${brokenSub.subtitle}`);

const filledCaption = enforceCustomerEvidence({
  titles: ["店员服务真的很周到", "菠萝炒饭配料很足", "咖喱蟹肉很下饭"],
  caption: "朋友介绍来吃的。菠萝炒饭配料很足。咖喱蟹肉很下饭。店员服务很热情。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
  ...abVisit,
});
assert(/芒果糯米饭/.test(filledCaption.caption) && /新鲜/.test(filledCaption.caption), `missing mango fact was not added: ${filledCaption.caption}`);
assert(!filledCaption.caption.includes("真的很好吃"), `fresh mango became generic praise: ${filledCaption.caption}`);
assert(!/甜丝丝|甜而不腻|很香/.test(filledCaption.caption), `caption invented a texture: ${filledCaption.caption}`);

const noDishEvidence = ensureGenerationVariation({
  titles: ["店员服务真的很周到", "到店的过程很顺", "这顿吃完就走了"],
  caption: "来曼谷当然要安排一顿泰国菜。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "店员服务很热情",
  plan: planGenerationVariation({
    context: { ...mallContext, dishes: ["Scrambled Egg Rice"], recommendTo: [], diningNote: "是朋友介绍来吃的很好吃" },
    variantIndex: 0,
  }),
  context: { ...mallContext, dishes: ["Scrambled Egg Rice"], recommendTo: [], diningNote: "是朋友介绍来吃的很好吃" },
  variantIndex: 0,
});
assert(!noDishEvidence.caption.includes("很好吃，吃完还想再点"), `dish without a review gained a stock line: ${noDishEvidence.caption}`);
assert(!noDishEvidence.caption.includes("滑蛋饭很好吃"), `unnamed praise was added: ${noDishEvidence.caption}`);

function variedTitles(titles: [string, string, string]) {
  return ensureGenerationVariation({
    titles,
    caption: "朋友介绍来吃的。菠萝炒饭配料很足。芒果糯米饭的芒果很新鲜。咖喱蟹肉很下饭。店员服务很热情。",
    coverTitle: "朋友推荐的泰餐",
    coverSubtitle: "菠萝炒饭配料很足",
    plan: planGenerationVariation({ context: mallContext, variantIndex: 0 }),
    context: mallContext,
    variantIndex: 0,
  }).titles;
}
const serviceTrio = ["店员服务真的很周到", "服务态度挺好", "服务招呼很及时"] as [string, string, string];
const serviceVaried = variedTitles(serviceTrio);
assert(serviceVaried[0] === serviceTrio[0] && serviceVaried[1] === serviceTrio[1] && serviceVaried[2] === serviceTrio[2], `different service titles were rotated: ${serviceVaried.join(" | ")}`);
assert(!serviceVaried.some((title) => title.includes("很满足")), `service titles became 很满足: ${serviceVaried.join(" | ")}`);
const colonTrio = ["服务：很周到", "炒饭：配料足", "芒果：很新鲜"] as [string, string, string];
const colonVaried = variedTitles(colonTrio);
assert(colonVaried[0] === colonTrio[0] && colonVaried[1] === colonTrio[1] && colonVaried[2] === colonTrio[2], `different colon titles were rotated: ${colonVaried.join(" | ")}`);
const mixedTrio = ["店员服务真的很周到", "菠萝炒饭配料很足", "芒果糯米饭很新鲜"] as [string, string, string];
const mixedVaried = variedTitles(mixedTrio);
assert(mixedVaried[0] === mixedTrio[0] && mixedVaried[1] === mixedTrio[1] && mixedVaried[2] === mixedTrio[2], `distinct facts were rotated: ${mixedVaried.join(" | ")}`);
const synonymTrio = ["店员服务真的很周到", "服务真的很周到", "店员真的很周到"] as [string, string, string];
const synonymVaried = variedTitles(synonymTrio);
assert(!synonymVaried.some((title) => title.includes("很满足")), `synonym dedupe used 很满足: ${synonymVaried.join(" | ")}`);
assert(synonymVaried[1] !== synonymTrio[1] || synonymVaried[2] !== synonymTrio[2], `synonym titles were not deduped: ${synonymVaried.join(" | ")}`);
assert(synonymVaried.some((title) => /配料很足|很新鲜|很下饭/.test(title)), `synonym dedupe did not use a customer point: ${synonymVaried.join(" | ")}`);

function clauseOf(text: string, dish: string) {
  return text.split(/(?<=[。！？!?])/u).find((sentence) => sentence.includes(dish)) ?? "";
}
function keepsDishPoint(text: string, dish: string, point: string) {
  const clause = clauseOf(text, dish);
  const at = clause.indexOf(dish);
  if (at < 0) return false;
  const after = clause.slice(at + dish.length);
  const nextDish = after.search(/菠萝炒饭|芒果糯米饭|咖喱蟹肉|河虾冬阴功汤|青柠蒸鲈鱼/);
  const region = (nextDish >= 0 ? after.slice(0, nextDish) : after).slice(0, 18);
  return region.includes(point);
}

const mergedPoints = collapseRepeatedSkeletons(
  [
    "咖喱蟹肉很下饭，这次还会想再点。",
    "芒果糯米饭的芒果很新鲜，这次还会想再点。",
    "菠萝炒饭配料很足，这次还会想再点。",
  ].join(""),
);
assert(keepsDishPoint(mergedPoints, "咖喱蟹肉", "很下饭"), `crab point dropped: ${mergedPoints}`);
assert(keepsDishPoint(mergedPoints, "芒果糯米饭", "芒果很新鲜"), `mango point dropped: ${mergedPoints}`);
assert(keepsDishPoint(mergedPoints, "菠萝炒饭", "配料很足"), `pineapple point dropped: ${mergedPoints}`);
assert(!keepsDishPoint(mergedPoints, "咖喱蟹肉", "很新鲜") && !keepsDishPoint(mergedPoints, "菠萝炒饭", "很下饭"), `points crossed dishes: ${mergedPoints}`);
assert(!/真的很好吃|味道不错|吃起来很满足/.test(mergedPoints), `merge invented a summary: ${mergedPoints}`);

const reorderAndPoint = collapseRepeatedSkeletons(
  "咖喱蟹肉很下饭，这次还会想再点。芒果糯米饭的芒果很新鲜，下次也还会想再点。",
);
assert(keepsDishPoint(reorderAndPoint, "咖喱蟹肉", "很下饭"), `reorder merge dropped 很下饭: ${reorderAndPoint}`);
assert(keepsDishPoint(reorderAndPoint, "芒果糯米饭", "芒果很新鲜"), `reorder merge dropped mango: ${reorderAndPoint}`);
assert(!/^这次还会想再点的是/.test(reorderAndPoint), `reorder merge kept only names: ${reorderAndPoint}`);

const namesOnly = collapseRepeatedSkeletons(
  "咖喱蟹肉这次还会想再点。菠萝炒饭这次还会想再点。芒果糯米饭这次还会想再点。",
);
assert(/还会想再点/.test(namesOnly), `name-only reorder lost the frame: ${namesOnly}`);
assert(namesOnly.includes("咖喱蟹肉") && namesOnly.includes("菠萝炒饭") && namesOnly.includes("芒果糯米饭"), `name-only reorder dropped a dish: ${namesOnly}`);
assert(!/很新鲜|很下饭|配料很足|很好吃|味道不错|吃起来很满足/.test(namesOnly), `name-only reorder invented a point: ${namesOnly}`);

const ambiguousReorder = collapseRepeatedSkeletons(
  "咖喱蟹肉和菠萝炒饭都很新鲜也很下饭，这次还会想再点。芒果糯米饭这次还会想再点。",
);
assert(ambiguousReorder.includes("咖喱蟹肉和菠萝炒饭都很新鲜也很下饭"), `ambiguous pairing was rewritten: ${ambiguousReorder}`);
assert(!/很新鲜|很下饭|配料很足/.test(clauseOf(ambiguousReorder, "芒果糯米饭")), `ambiguous point was copied onto mango: ${ambiguousReorder}`);

const sharedPoint = collapseRepeatedSkeletons("咖喱蟹肉很下饭，这次还会想再点。菠萝炒饭很下饭，这次还会想再点。");
assert(sharedPoint.includes("咖喱蟹肉") && sharedPoint.includes("菠萝炒饭") && sharedPoint.includes("很下饭"), `shared point was dropped: ${sharedPoint}`);
assert(!sharedPoint.includes("很好吃"), `shared point became generic praise: ${sharedPoint}`);

function reorderPlan(pattern: "would-reorder" | "among-dishes", factIds: string[], dishOrder: string[]) {
  const plan = planGenerationVariation({ context: mallContext, variantIndex: 0 });
  return {
    ...plan,
    dishEntryPattern: pattern,
    openingPattern: "favorite-dish" as const,
    endingPattern: "no-summary" as const,
    selectedFactIds: factIds,
    dishOrder,
    lengthBand: "short" as const,
    lengthMin: 1,
    lengthMax: 400,
  };
}
const rewrittenReorder = ensureGenerationVariation({
  titles: mixedTrio,
  caption: "来曼谷当然要安排一顿泰国菜。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
  plan: reorderPlan("would-reorder", ["dish:咖喱蟹肉", "dish:芒果糯米饭", "dish:菠萝炒饭"], ["咖喱蟹肉", "芒果糯米饭", "菠萝炒饭"]),
  context: mallContext,
  variantIndex: 0,
});
assert(keepsDishPoint(rewrittenReorder.caption, "咖喱蟹肉", "很下饭"), `would-reorder dropped 很下饭: ${rewrittenReorder.caption}`);
assert(keepsDishPoint(rewrittenReorder.caption, "芒果糯米饭", "芒果很新鲜"), `would-reorder dropped mango: ${rewrittenReorder.caption}`);
assert(keepsDishPoint(rewrittenReorder.caption, "菠萝炒饭", "配料很足"), `would-reorder dropped pineapple: ${rewrittenReorder.caption}`);
assert(!rewrittenReorder.caption.includes("真的很好吃"), `would-reorder invented 很好吃: ${rewrittenReorder.caption}`);
const rewrittenAmong = ensureGenerationVariation({
  titles: mixedTrio,
  caption: "来曼谷当然要安排一顿泰国菜。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
  plan: reorderPlan("among-dishes", ["dish:咖喱蟹肉"], ["咖喱蟹肉", "芒果糯米饭"]),
  context: mallContext,
  variantIndex: 0,
});
assert(keepsDishPoint(rewrittenAmong.caption, "咖喱蟹肉", "很下饭"), `among-dishes dropped 很下饭: ${rewrittenAmong.caption}`);
assert(!rewrittenAmong.caption.includes("真的很好吃"), `among-dishes invented 很好吃: ${rewrittenAmong.caption}`);

const supportedPoints = ["菠萝炒饭配料很足", "芒果糯米饭芒果很新鲜", "咖喱蟹肉很下饭"];
const stockCaption = enforceCustomerEvidence({
  titles: mixedTrio,
  caption:
    "咖喱蟹肉很下饭，拌饭吃超香，不知不觉就多吃了半碗。芒果糯米饭的芒果很新鲜，口感甜润。菠萝炒饭配料很足。在小红薯上也挺有人气的。每次来基本都会点。吃起来很满足。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
  note: "是朋友介绍来吃的很好吃",
  dishes: mallContext.dishes,
  enjoyMost: ["在购物商场里的泰餐连锁"],
  recommendTo: supportedPoints,
  branch,
});
assert(keepsDishPoint(stockCaption.caption, "咖喱蟹肉", "很下饭"), `supported crab point was removed: ${stockCaption.caption}`);
assert(keepsDishPoint(stockCaption.caption, "芒果糯米饭", "很新鲜"), `supported mango point was removed: ${stockCaption.caption}`);
assert(keepsDishPoint(stockCaption.caption, "菠萝炒饭", "配料很足"), `supported pineapple point was removed: ${stockCaption.caption}`);
assert(
  !/有人气|每次来|超香|口感甜润|甜润|吃起来很满足|吃着很满足|不知不觉就多吃了半碗/.test(stockCaption.caption),
  `unsupported stock stayed: ${stockCaption.caption}`,
);
assert(!/真的很好吃|味道不错|整体体验不错/.test(stockCaption.caption), `stock was replaced with a new closer: ${stockCaption.caption}`);

const givenTaste = enforceCustomerEvidence({
  titles: mixedTrio,
  caption: "咖喱蟹肉很香。这顿吃起来很满足。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "咖喱蟹肉很香",
  note: "咖喱蟹肉很香，吃起来很满足",
  dishes: ["Crab Meat Curry"],
  enjoyMost: [],
  recommendTo: ["咖喱蟹肉很香", "吃起来很满足"],
  branch,
});
assert(givenTaste.caption.includes("很香"), `customer aroma was deleted: ${givenTaste.caption}`);
assert(givenTaste.caption.includes("很满足"), `customer satisfaction was deleted: ${givenTaste.caption}`);

const mixedClause = enforceCustomerEvidence({
  titles: mixedTrio,
  caption: "咖喱蟹肉很下饭，拌饭超香，口感甜润。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "咖喱蟹肉很下饭",
  note: "是朋友介绍来吃的很好吃",
  dishes: ["Crab Meat Curry"],
  enjoyMost: [],
  recommendTo: ["咖喱蟹肉很下饭"],
  branch,
});
assert(keepsDishPoint(mixedClause.caption, "咖喱蟹肉", "很下饭"), `mixed clause lost the supported point: ${mixedClause.caption}`);
assert(!/超香|口感甜润|甜润|真的很好吃/.test(mixedClause.caption), `mixed clause kept or replaced the extra: ${mixedClause.caption}`);

const closerOnly = enforceCustomerEvidence({
  titles: mixedTrio,
  caption: "菠萝炒饭配料很足。吃起来很满足。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
  note: "是朋友介绍来吃的很好吃",
  dishes: ["Pineapple Fried Rice"],
  enjoyMost: [],
  recommendTo: ["菠萝炒饭配料很足"],
  branch,
});
assert(closerOnly.caption.includes("配料很足"), `closer cleanup dropped the dish point: ${closerOnly.caption}`);
assert(!/吃起来很满足|吃着很满足|真的很好吃|味道不错|整体体验不错|有人气/.test(closerOnly.caption), `closer was replaced: ${closerOnly.caption}`);

const crossedDish = enforceCustomerEvidence({
  titles: mixedTrio,
  caption: "芒果糯米饭的芒果很香。咖喱蟹肉很下饭，很香。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "芒果糯米饭的芒果很香",
  note: "是朋友介绍来吃的很好吃",
  dishes: ["Mango Sticky Rice", "Crab Meat Curry"],
  enjoyMost: [],
  recommendTo: ["芒果糯米饭芒果很香", "咖喱蟹肉很下饭"],
  branch,
});
assert(keepsDishPoint(crossedDish.caption, "芒果糯米饭", "很香"), `mango aroma was dropped: ${crossedDish.caption}`);
assert(keepsDishPoint(crossedDish.caption, "咖喱蟹肉", "很下饭"), `crab point was replaced: ${crossedDish.caption}`);
assert(!keepsDishPoint(crossedDish.caption, "咖喱蟹肉", "很香"), `mango aroma was reused for crab: ${crossedDish.caption}`);
assert(!/真的很好吃/.test(crossedDish.caption), `cross-dish check invented praise: ${crossedDish.caption}`);

const distinctPoints = enforceCustomerEvidence({
  titles: mixedTrio,
  caption: "菠萝炒饭配料很足。芒果糯米饭的芒果很新鲜。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "菠萝炒饭配料很足",
  note: "是朋友介绍来吃的很好吃",
  dishes: ["Pineapple Fried Rice", "Mango Sticky Rice"],
  enjoyMost: [],
  recommendTo: ["菠萝炒饭配料很足", "芒果糯米饭芒果很新鲜"],
  branch,
});
assert(keepsDishPoint(distinctPoints.caption, "菠萝炒饭", "配料很足"), `pineapple point was dropped: ${distinctPoints.caption}`);
assert(keepsDishPoint(distinctPoints.caption, "芒果糯米饭", "很新鲜"), `mango freshness was dropped: ${distinctPoints.caption}`);

const sharedAroma = enforceCustomerEvidence({
  titles: mixedTrio,
  caption: "咖喱蟹肉很香。河虾冬阴功汤也很香。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "咖喱蟹肉很香",
  note: "咖喱蟹肉很香，冬阴功汤也很香",
  dishes: ["Crab Meat Curry", "River Prawn Tom Yum"],
  enjoyMost: [],
  recommendTo: ["咖喱蟹肉很香，冬阴功汤也很香"],
  branch,
});
assert(keepsDishPoint(sharedAroma.caption, "咖喱蟹肉", "很香"), `shared crab aroma was dropped: ${sharedAroma.caption}`);
assert(keepsDishPoint(sharedAroma.caption, "河虾冬阴功汤", "很香"), `shared soup aroma was dropped: ${sharedAroma.caption}`);

const unboundAroma = enforceCustomerEvidence({
  titles: mixedTrio,
  caption: "咖喱蟹肉很香。芒果糯米饭的芒果很香。",
  coverTitle: "朋友推荐的泰餐",
  coverSubtitle: "味道很香",
  note: "味道很香",
  dishes: ["Crab Meat Curry", "Mango Sticky Rice"],
  enjoyMost: [],
  recommendTo: [],
  branch,
});
assert(keepsDishPoint(unboundAroma.caption, "咖喱蟹肉", "很香"), `unassigned aroma was deleted from crab: ${unboundAroma.caption}`);
assert(keepsDishPoint(unboundAroma.caption, "芒果糯米饭", "很香"), `unassigned aroma was deleted from mango: ${unboundAroma.caption}`);
assert(!/真的很好吃/.test(unboundAroma.caption), `unassigned aroma was rewritten: ${unboundAroma.caption}`);

const stillMerged = collapseRepeatedSkeletons(
  [
    "咖喱蟹肉很下饭，这次还会想再点。",
    "芒果糯米饭的芒果很新鲜，这次还会想再点。",
    "菠萝炒饭配料很足，这次还会想再点。",
  ].join(""),
);
assert(keepsDishPoint(stillMerged, "咖喱蟹肉", "很下饭"), `merge regression dropped crab: ${stillMerged}`);
assert(keepsDishPoint(stillMerged, "芒果糯米饭", "芒果很新鲜"), `merge regression dropped mango: ${stillMerged}`);
assert(keepsDishPoint(stillMerged, "菠萝炒饭", "配料很足"), `merge regression dropped pineapple: ${stillMerged}`);

const repeatedCrab = separateOverlappingHeadlines({
  titles: ["咖喱蟹肉很下饭🦀", "店员服务很热情", "到店的过程很顺"],
  coverTitle: "朋友推荐来吃的店",
  coverSubtitle: "咖喱蟹肉很下饭",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭", "芒果糯米饭芒果很新鲜"],
  enjoyMost: ["店员服务热情周到"],
});
assert(!headlinesSharePoint(repeatedCrab.coverSubtitle, repeatedCrab.titles[0]), `subtitle and post title still share a point: ${repeatedCrab.titles[0]}`);
assert(repeatedCrab.coverSubtitle.includes("很下饭"), `subtitle lost the supported point: ${repeatedCrab.coverSubtitle}`);
assert(/新鲜/.test(repeatedCrab.titles[0]), `replacement was not a supported point: ${repeatedCrab.titles[0]}`);
assert(!/环境很好|价格实惠|排队/.test(repeatedCrab.titles.join("")), `dedupe invented a fact: ${repeatedCrab.titles.join(" | ")}`);

const sameDish = separateOverlappingHeadlines({
  titles: ["咖喱蟹肉拌饭", "芒果糯米饭很新鲜", "朋友介绍来吃的"],
  coverTitle: "朋友推荐来吃的店",
  coverSubtitle: "咖喱蟹肉很下饭",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭"],
});
assert(sameDish.titles[0] === "咖喱蟹肉拌饭", `same dish was treated as the same point: ${sameDish.titles[0]}`);
assert(sameDish.coverSubtitle === "咖喱蟹肉很下饭", `same dish changed the subtitle: ${sameDish.coverSubtitle}`);

const splitRoles = separateOverlappingHeadlines({
  titles: ["朋友介绍来吃的", "芒果糯米饭很新鲜", "店员服务很热情"],
  coverTitle: "商场里的泰餐",
  coverSubtitle: "咖喱蟹肉很下饭",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭", "芒果糯米饭很新鲜"],
  enjoyMost: ["店员服务热情周到"],
});
assert(splitRoles.coverTitle === "商场里的泰餐", `distinct cover title was rewritten: ${splitRoles.coverTitle}`);
assert(splitRoles.coverSubtitle === "咖喱蟹肉很下饭", `distinct subtitle was rewritten: ${splitRoles.coverSubtitle}`);
assert(splitRoles.titles[0] === "朋友介绍来吃的", `distinct post title was rewritten: ${splitRoles.titles[0]}`);

const onlyOnePoint = separateOverlappingHeadlines({
  titles: ["咖喱蟹肉很下饭", "咖喱蟹肉很下饭", "咖喱蟹肉很下饭"],
  coverTitle: "这家泰餐",
  coverSubtitle: "咖喱蟹肉很下饭",
  note: "",
  recommendTo: ["咖喱蟹肉很下饭"],
});
assert(onlyOnePoint.titles[0] === "咖喱蟹肉很下饭", `thin evidence replaced the title: ${onlyOnePoint.titles[0]}`);
assert(!/环境很好|价格实惠|排队|很香|太好炫/.test(`${onlyOnePoint.coverTitle}${onlyOnePoint.coverSubtitle}${onlyOnePoint.titles.join("")}`), `thin evidence invented a point: ${onlyOnePoint.titles.join(" | ")}`);

const formattedRepeat = ensureTitleFormats(["咖喱蟹肉很下饭", "到店的过程很顺", "这顿吃完就走了"], [], {
  note: "是朋友介绍来吃的",
});
const afterFormat = separateOverlappingHeadlines({
  titles: formattedRepeat,
  coverTitle: "朋友推荐来吃的店",
  coverSubtitle: "咖喱蟹肉很下饭",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭", "菠萝炒饭配料很足"],
});
assert(!headlinesSharePoint(afterFormat.coverSubtitle, afterFormat.titles[0]), `format restored the repeated point: ${afterFormat.titles[0]}`);
assert(/配料/.test(afterFormat.titles[0]), `format path replacement lacked support: ${afterFormat.titles[0]}`);

assert(!headlinesSharePoint("咖喱蟹肉很香", "咖喱蟹肉很下饭"), "aroma and rice-friendly were merged");
assert(!headlinesSharePoint("咖喱蟹肉拌饭", "咖喱蟹肉很下饭"), "a bare dish name was treated as the same claim");
assert(!headlinesSharePoint("芒果糯米饭的芒果很香", "咖喱蟹肉很香"), "mango aroma was treated as crab aroma");
assert(!headlinesSharePoint("商场里的泰餐", "逛街顺便吃泰餐"), "two place themes were treated as the same claim");
assert(!headlinesSharePoint("咖喱蟹肉很甜", "咖喱蟹肉很辣"), "sweet and spicy were treated as the same claim");
assert(!headlinesSharePoint("咖喱蟹肉酥脆", "咖喱蟹肉软糯"), "crisp and sticky were treated as the same claim");
assert(headlinesSharePoint("这口咖喱蟹肉很下饭", "咖喱蟹肉很下饭🦀"), "the same crab claim was missed");

const coverPair = separateOverlappingHeadlines({
  titles: ["芒果糯米饭芒果很新鲜", "到店的过程很顺", "这顿吃完就走了"],
  coverTitle: "咖喱蟹肉很下饭",
  coverSubtitle: "这口咖喱蟹肉很下饭",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭", "芒果糯米饭芒果很新鲜"],
});
assert(!headlinesSharePoint(coverPair.coverTitle, coverPair.coverSubtitle), `cover pair still repeats: ${coverPair.coverTitle} / ${coverPair.coverSubtitle}`);
assert(coverPair.coverSubtitle === "这口咖喱蟹肉很下饭", `cover pair changed the subtitle: ${coverPair.coverSubtitle}`);
assert(coverPair.titles[0] === "芒果糯米饭芒果很新鲜", `cover pair changed the post title: ${coverPair.titles[0]}`);
assert(/朋友|介绍/.test(coverPair.coverTitle), `cover pair replacement was not the visit reason: ${coverPair.coverTitle}`);
assert(coverPair.titles[1] === "到店的过程很顺" && coverPair.titles[2] === "这顿吃完就走了", "cover pair changed an unselected title");
assert(!/环境很好|价格实惠|排队|分量/.test(`${coverPair.coverTitle}${coverPair.coverSubtitle}`), `cover pair invented a fact: ${coverPair.coverTitle}`);

const coverAndPost = separateOverlappingHeadlines({
  titles: ["咖喱蟹肉很下饭🦀", "到店的过程很顺", "这顿吃完就走了"],
  coverTitle: "咖喱蟹肉很下饭",
  coverSubtitle: "芒果糯米饭芒果很新鲜",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭", "芒果糯米饭芒果很新鲜"],
});
assert(!headlinesSharePoint(coverAndPost.coverTitle, coverAndPost.titles[0]), `cover and post title still repeat: ${coverAndPost.titles[0]}`);
assert(coverAndPost.coverTitle === "咖喱蟹肉很下饭", `cover and post changed the distinct cover: ${coverAndPost.coverTitle}`);
assert(coverAndPost.coverSubtitle === "芒果糯米饭芒果很新鲜", `cover and post changed the distinct subtitle: ${coverAndPost.coverSubtitle}`);
assert(/朋友|介绍/.test(coverAndPost.titles[0]), `cover and post replacement lacked support: ${coverAndPost.titles[0]}`);
assert(!coverAndPost.titles[0].includes("🦀"), `crab emoji moved onto another angle: ${coverAndPost.titles[0]}`);

const subtitleAndPost = separateOverlappingHeadlines({
  titles: ["咖喱蟹肉很下饭", "到店的过程很顺", "这顿吃完就走了"],
  coverTitle: "商场里的泰餐",
  coverSubtitle: "咖喱蟹肉很下饭",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭", "菠萝炒饭配料很足"],
});
assert(subtitleAndPost.coverTitle === "商场里的泰餐", `theme cover was rewritten: ${subtitleAndPost.coverTitle}`);
assert(subtitleAndPost.coverSubtitle === "咖喱蟹肉很下饭", `supported subtitle was rewritten: ${subtitleAndPost.coverSubtitle}`);
assert(!headlinesSharePoint(subtitleAndPost.coverSubtitle, subtitleAndPost.titles[0]), `subtitle and post title still repeat: ${subtitleAndPost.titles[0]}`);
assert(/朋友|介绍/.test(subtitleAndPost.titles[0]), `subtitle pair replacement lacked support: ${subtitleAndPost.titles[0]}`);

const differentClaims = separateOverlappingHeadlines({
  titles: ["咖喱蟹肉很下饭", "到店的过程很顺", "这顿吃完就走了"],
  coverTitle: "商场里的泰餐",
  coverSubtitle: "咖喱蟹肉很香",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很香", "咖喱蟹肉很下饭"],
});
assert(differentClaims.coverTitle === "商场里的泰餐", `different claims changed the cover: ${differentClaims.coverTitle}`);
assert(differentClaims.coverSubtitle === "咖喱蟹肉很香", `different claims changed the subtitle: ${differentClaims.coverSubtitle}`);
assert(differentClaims.titles[0] === "咖喱蟹肉很下饭", `different claims changed the post title: ${differentClaims.titles[0]}`);

const differentDishes = separateOverlappingHeadlines({
  titles: ["咖喱蟹肉很香", "到店的过程很顺", "这顿吃完就走了"],
  coverTitle: "商场里的泰餐",
  coverSubtitle: "芒果糯米饭的芒果很香",
  recommendTo: ["芒果糯米饭的芒果很香", "咖喱蟹肉很香"],
});
assert(differentDishes.coverSubtitle === "芒果糯米饭的芒果很香", `different dishes changed the subtitle: ${differentDishes.coverSubtitle}`);
assert(differentDishes.titles[0] === "咖喱蟹肉很香", `different dishes changed the post title: ${differentDishes.titles[0]}`);

const movedAroma = separateOverlappingHeadlines({
  titles: ["朋友介绍来吃的", "到店的过程很顺", "这顿吃完就走了"],
  coverTitle: "咖喱蟹肉很香",
  coverSubtitle: "这口咖喱蟹肉很香",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭", "芒果糯米饭的芒果很香"],
});
assert(!headlinesSharePoint(movedAroma.coverTitle, movedAroma.coverSubtitle), `same aroma on the cover stayed duplicated: ${movedAroma.coverTitle}`);
assert(movedAroma.coverSubtitle === "这口咖喱蟹肉很香", `aroma subtitle was rewritten: ${movedAroma.coverSubtitle}`);
assert(movedAroma.coverTitle === "咖喱蟹肉很下饭", `aroma evidence moved onto the wrong dish: ${movedAroma.coverTitle}`);
assert(movedAroma.titles[0] === "朋友介绍来吃的", `aroma case changed the post title: ${movedAroma.titles[0]}`);
assert(!movedAroma.coverTitle.includes("🦀"), `crab emoji was added to the replacement: ${movedAroma.coverTitle}`);

const thinOverlap = separateOverlappingHeadlines({
  titles: ["咖喱蟹肉很下饭", "咖喱蟹肉很下饭", "咖喱蟹肉很下饭"],
  coverTitle: "咖喱蟹肉很下饭",
  coverSubtitle: "这口咖喱蟹肉很下饭",
  note: "",
  recommendTo: ["咖喱蟹肉很下饭"],
});
assert(thinOverlap.coverTitle === "咖喱蟹肉很下饭", `thin evidence changed the cover: ${thinOverlap.coverTitle}`);
assert(thinOverlap.coverSubtitle === "这口咖喱蟹肉很下饭", `thin evidence changed the subtitle: ${thinOverlap.coverSubtitle}`);
assert(thinOverlap.titles[0] === "咖喱蟹肉很下饭", `thin evidence changed the post title: ${thinOverlap.titles[0]}`);
assert(!/环境很好|价格实惠|排队|分量|服务|很香|新鲜/.test(`${thinOverlap.coverTitle}${thinOverlap.coverSubtitle}${thinOverlap.titles[0]}`), "thin evidence invented a fact");

const repeatInput = {
  titles: ["芒果糯米饭芒果很新鲜", "到店的过程很顺", "这顿吃完就走了"] as [string, string, string],
  coverTitle: "咖喱蟹肉很下饭",
  coverSubtitle: "这口咖喱蟹肉很下饭",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭", "芒果糯米饭芒果很新鲜"],
};
const repeatOnce = separateOverlappingHeadlines(repeatInput);
const repeatTwice = separateOverlappingHeadlines({ ...repeatInput, ...repeatOnce, titles: repeatOnce.titles });
assert(JSON.stringify(repeatOnce) === JSON.stringify(repeatTwice), `dedupe changed on the second pass: ${JSON.stringify(repeatTwice)}`);
const postOnce = separateOverlappingHeadlines({
  titles: ["咖喱蟹肉很下饭🦀", "到店的过程很顺", "这顿吃完就走了"],
  coverTitle: "咖喱蟹肉很下饭",
  coverSubtitle: "芒果糯米饭芒果很新鲜",
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭", "芒果糯米饭芒果很新鲜"],
});
const postTwice = separateOverlappingHeadlines({
  titles: postOnce.titles,
  coverTitle: postOnce.coverTitle,
  coverSubtitle: postOnce.coverSubtitle,
  note: "是朋友介绍来吃的",
  recommendTo: ["咖喱蟹肉很下饭", "芒果糯米饭芒果很新鲜"],
});
assert(JSON.stringify(postOnce) === JSON.stringify(postTwice), `post-title dedupe changed on the second pass: ${JSON.stringify(postTwice)}`);

assert(headlinesSharePoint("青咖喱牛肉椰香很足", "青咖喱牛肉椰香真的很足🍛"), "coconut wording with 真的 was missed");
assert(headlinesSharePoint("青咖喱牛肉椰香很足", "青咖喱牛肉椰香味很足"), "coconut wording with 味 was missed");
assert(!headlinesSharePoint("青咖喱牛肉很香", "青咖喱牛肉很下饭"), "aroma and rice-friendly on beef were merged");
assert(!headlinesSharePoint("青咖喱牛肉椰香很足", "青咖喱牛肉很香"), "coconut fullness was treated as generic aroma");
assert(!headlinesSharePoint("青咖喱牛肉椰香很足", "青咖喱牛肉很下饭"), "coconut fullness was treated as rice-friendly");
assert(!headlinesSharePoint("蒜炒虾仁椰香很足", "青咖喱牛肉椰香很足"), "coconut on shrimp was treated as the beef claim");

const coconutTitles = ["青咖喱牛肉椰香真的很足🍛", "到店的过程很顺", "这顿吃完就走了"] as [string, string, string];
const coconutPolished = fixFruitEmojisInTitles(
  ensureTitleFormats(coconutTitles, [], { note: "是朋友介绍来吃的" }),
);
const coconutDistinct = separateOverlappingHeadlines({
  titles: coconutPolished,
  coverTitle: "青咖喱牛肉椰香很足",
  coverSubtitle: "店里是满满的家庭温馨感",
  note: "是朋友介绍来吃的",
  recommendTo: ["青咖喱牛肉椰香味很足"],
  enjoyMost: ["店里是满满的家庭温馨感"],
});
const coconutSpelling = { mall: "centralworld", restaurant: "Baan Ying" as const, mallPattern: /central\s*world/gi };
const coconutReturned = {
  titles: coconutDistinct.titles.map((title) =>
    applyBrandSpelling(scrubForeignBranchFacts(title, branch), coconutSpelling),
  ),
  coverTitle: applyBrandSpelling(scrubForeignBranchFacts(coconutDistinct.coverTitle, branch), coconutSpelling),
  coverSubtitle: applyBrandSpelling(scrubForeignBranchFacts(coconutDistinct.coverSubtitle, branch), coconutSpelling),
};
assert(!headlinesSharePoint(coconutReturned.coverTitle, coconutReturned.titles[0]), `returned cover and post title still share coconut: ${coconutReturned.titles[0]}`);
assert(coconutReturned.coverTitle === "青咖喱牛肉椰香很足", `returned cover lost the supported dish point: ${coconutReturned.coverTitle}`);
assert(coconutReturned.coverSubtitle.includes("温馨"), `returned subtitle lost the room point: ${coconutReturned.coverSubtitle}`);
assert(/朋友|介绍/.test(coconutReturned.titles[0]), `returned post title was not a supported angle: ${coconutReturned.titles[0]}`);
assert(!coconutReturned.titles[0].includes("🍛"), `curry emoji moved to another angle: ${coconutReturned.titles[0]}`);
assert(!/环境很好|价格实惠|排队|很下饭/.test(coconutReturned.titles[0]), `returned title invented a point: ${coconutReturned.titles[0]}`);

const coconutOnly = separateOverlappingHeadlines({
  titles: ["青咖喱牛肉椰香真的很足🍛", "到店的过程很顺", "这顿吃完就走了"],
  coverTitle: "青咖喱牛肉椰香很足",
  coverSubtitle: "店里是满满的家庭温馨感",
  recommendTo: ["青咖喱牛肉椰香味很足"],
  enjoyMost: ["店里是满满的家庭温馨感"],
});
assert(coconutOnly.coverTitle === "青咖喱牛肉椰香很足", `thin coconut evidence changed the cover: ${coconutOnly.coverTitle}`);
assert(coconutOnly.coverSubtitle === "店里是满满的家庭温馨感", `thin coconut evidence changed the subtitle: ${coconutOnly.coverSubtitle}`);
assert(/椰香/.test(coconutOnly.titles[0]), `thin coconut evidence replaced the title: ${coconutOnly.titles[0]}`);
assert(!/环境很好|价格实惠|排队|很下饭|很香/.test(`${coconutOnly.coverTitle}${coconutOnly.titles[0]}`), "thin coconut evidence invented a claim");

const warmthReuse = separateOverlappingHeadlines({
  titles: ["青咖喱牛肉椰香真的很足🍛", "到店的过程很顺", "这顿吃完就走了"],
  coverTitle: "青咖喱牛肉椰香很足",
  coverSubtitle: "芒果糯米饭很新鲜",
  recommendTo: ["青咖喱牛肉椰香味很足"],
  enjoyMost: ["店里是满满的家庭温馨感"],
});
assert(warmthReuse.coverTitle === "青咖喱牛肉椰香很足", `warmth reuse changed the cover: ${warmthReuse.coverTitle}`);
assert(warmthReuse.coverSubtitle === "芒果糯米饭很新鲜", `warmth reuse changed the other dish: ${warmthReuse.coverSubtitle}`);
assert(warmthReuse.titles[0] === "店里是满满的家庭温馨感", `warmth was rewritten onto the beef: ${warmthReuse.titles[0]}`);
assert(!warmthReuse.titles[0].includes("🍛"), `curry emoji moved onto the room line: ${warmthReuse.titles[0]}`);

const route = readFileSync(new URL("../app/api/generate/route.ts", import.meta.url), "utf8");
const shared = route.slice(route.indexOf("const formatted = fixFruitEmojisInTitles"));
assert(shared.includes("ensureCaptionEmojis") && shared.includes("ensureContentLock"), "shared post-process is missing");
assert(!/if \(provider === "openai"\)/.test(shared) && !/if \(provider === "modelark"\)/.test(shared), "post-process branched by provider");
assert((route.match(/createModelArkResponse\(/g) ?? []).length === 2, "model call sites changed");
assert(
  route.lastIndexOf("ensureTitleFormats") < route.lastIndexOf("separateOverlappingHeadlines"),
  "headline dedupe runs before the last title format pass",
);
assert(route.includes("titles: spelledTitles") && route.includes("caption: spelledCaption") && route.includes("generationId"), "response contract changed");
assert(!shared.includes("compose-cover") && !shared.includes("CoverComposer"), "post-process now calls the cover composer");

console.log("validate-postprocess-diagnostics: ok");
