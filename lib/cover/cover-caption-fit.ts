import { captionBackedCoverLines } from "@/lib/content-evidence";
import type { CoverTitleContext } from "@/lib/cover/cover-rules";
import { isAcceptableMainTitle, isAcceptableSubtitle } from "@/lib/cover/cover-title";
import { naturalCoverFallback } from "@/lib/cover/cover-natural";
import { collectFullDishNames } from "@/lib/cover/dish-names";
import { selectOneValidSubtitle } from "@/lib/cover/subtitle-units";
import { positiveNoteText } from "@/lib/evidence-priority";

/** Praise that reads as a verdict on a dish. */
const DISH_PRAISE =
  /必吃|必点|值得点|值得一试|很香|真香|好香|很满足|超爱|有点特别|还想再点|受欢迎|人气|蛮喜欢|好吃|下饭|开胃|入味|鲜甜|浓郁/;
/** Praise that also lands on a dish named by the other cover line. */
const PAIR_PRAISE = /必吃|必点|值得点|值得一试|真香|超爱|还想再点/;

const dishesIn = (text: string) => collectFullDishNames({ sourceTexts: [text] });

function reviewedDishes(context: CoverTitleContext) {
  const reasons = (context.recommendTo ?? []).filter((item) => item && item !== "其他");
  const named = new Set(dishesIn([positiveNoteText(context.diningNote ?? ""), ...reasons].join("，")));
  if (reasons.some((reason) => dishesIn(reason).length === 0)) {
    for (const dish of collectFullDishNames({ dishes: context.dishes })) named.add(dish);
  }
  return named;
}

function complainedDishes(context: CoverTitleContext) {
  const note = context.diningNote ?? "";
  const praised = new Set(dishesIn(positiveNoteText(note)));
  return new Set(dishesIn(note).filter((dish) => !praised.has(dish)));
}

/**
 * A cover line fails when it names a dish the final caption does not tell, a dish the customer complained
 * about, or praises a dish the customer never reviewed.
 */
function unsupportedCoverLine(line: string, partner: string, caption: string, context: CoverTitleContext) {
  const named = dishesIn(line);
  const told = new Set(dishesIn(caption));
  const complained = complainedDishes(context);
  if (named.some((dish) => !told.has(dish) || complained.has(dish))) return true;
  const reviewed = reviewedDishes(context);
  if (DISH_PRAISE.test(line) && named.some((dish) => !reviewed.has(dish))) return true;
  return PAIR_PRAISE.test(line) && dishesIn(partner).some((dish) => !reviewed.has(dish));
}

/** A replacement line may praise only in words the customer's note or the final caption already used. */
function praiseIsBacked(line: string, caption: string, context: CoverTitleContext) {
  const said = `${positiveNoteText(context.diningNote ?? "")}${caption}`;
  return (line.match(new RegExp(DISH_PRAISE.source, "g")) ?? []).every((word) => said.includes(word));
}

function fallbackSubtitle(coverTitle: string, caption: string, context: CoverTitleContext) {
  const story = caption
    .split("\n")
    .filter((row) => !/^\s*(?:📍|⏰)/u.test(row))
    .join("\n");
  return (
    [
      selectOneValidSubtitle({ note: context.diningNote, avoid: [coverTitle] }),
      selectOneValidSubtitle({ note: story, avoid: [coverTitle] }),
      selectOneValidSubtitle({ avoid: [coverTitle] }),
    ].find((line) => praiseIsBacked(line, caption, context) && !unsupportedCoverLine(line, coverTitle, caption, context)) ??
    selectOneValidSubtitle({ avoid: [coverTitle] })
  );
}

function fallbackMain(subtitle: string, caption: string, context: CoverTitleContext) {
  const seed = context.variantIndex ?? 0;
  let last = "";
  for (let offset = 0; offset < 4; offset += 1) {
    last = naturalCoverFallback(context, seed + offset);
    if (!unsupportedCoverLine(last, subtitle, caption, context)) return last;
  }
  return last;
}

/**
 * Last check on the cover, against the caption the reader will see. A failing line is replaced by a line
 * the caption already tells, else by the existing safe fallback. The caption is never edited to fit the cover.
 */
export function alignCoverWithCaption(input: {
  coverTitle: string;
  coverSubtitle: string;
  caption: string;
  context?: CoverTitleContext;
}) {
  const context = input.context ?? {};
  const { caption } = input;
  let { coverTitle, coverSubtitle } = input;
  const backed = captionBackedCoverLines(caption, context);

  if (unsupportedCoverLine(coverSubtitle, coverTitle, caption, context)) {
    coverSubtitle =
      backed.subs.find(
        (line) => isAcceptableSubtitle(line, coverTitle, context) && !unsupportedCoverLine(line, coverTitle, caption, context),
      ) ?? fallbackSubtitle(coverTitle, caption, context);
  }

  if (unsupportedCoverLine(coverTitle, coverSubtitle, caption, context)) {
    coverTitle =
      backed.mains.find(
        (line) =>
          line !== coverSubtitle &&
          isAcceptableMainTitle(line, [], context) &&
          !unsupportedCoverLine(line, coverSubtitle, caption, context),
      ) ?? fallbackMain(coverSubtitle, caption, context);
    if (unsupportedCoverLine(coverSubtitle, coverTitle, caption, context)) {
      coverSubtitle = fallbackSubtitle(coverTitle, caption, context);
    }
  }

  return { coverTitle, coverSubtitle };
}
