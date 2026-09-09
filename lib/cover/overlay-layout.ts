import type { Font } from "fontkit";
import { countCoverChars, countCoverUnits } from "./cover-title";
import { findCoverLocationKeywords } from "./cover-rules";
import { splitTitleIntoLines } from "./title-lines";
import { clampMainTitleSize, layoutSlotText, type MeasuredText } from "./typography";
import {
  CANVAS_WIDTH,
  MIN_SUBTITLE_SIZE,
  MIN_TITLE_SIZE,
  SUBTITLE_TO_TITLE_RATIO,
  SUBTITLE_TO_TITLE_RATIO_MAX,
  SUBTITLE_TO_TITLE_RATIO_MIN,
  TEXT_EDGE_RATIO,
  type TextSlot,
} from "./types";

export type OverlayLines = {
  title: string;
  subtitle: string;
  titleMeasured: MeasuredText;
  subtitleMeasured: MeasuredText | null;
};

function measureLine(
  text: string,
  slot: TextSlot,
  font: Font,
  size: number,
  firstLineReserve = 0,
) {
  return layoutSlotText({
    text,
    slot: { ...slot, size, minSize: size },
    font,
    role: "title",
    maxLines: 1,
    firstLineReserve,
  });
}

function asOverlay(
  title: string,
  subtitle: string,
  titleMeasured: MeasuredText,
  subtitleMeasured: MeasuredText | null,
): OverlayLines {
  return { title, subtitle, titleMeasured, subtitleMeasured };
}

function lineFits(measured: MeasuredText, maxWidth: number) {
  return (
    measured.lines.length === 1 &&
    !measured.truncated &&
    (measured.lineWidths[0] ?? measured.width) <= maxWidth + 1
  );
}

function twoLineMeasured(
  line1: string,
  line2: string,
  slot: TextSlot,
  font: Font,
  size: number,
  firstLineReserve: number,
): MeasuredText {
  const first = measureLine(line1, slot, font, size, firstLineReserve);
  const second = measureLine(line2, slot, font, size);
  const lineHeight = slot.lineHeight ?? 1.15;
  return {
    lines: [line1, line2],
    lineWidths: [first.width, second.width],
    fontSize: size,
    lineHeight,
    width: Math.max(first.width, second.width),
    height: size * lineHeight * 2,
    truncated: first.truncated || second.truncated,
  };
}

function twoLineFits(measured: MeasuredText, maxWidth: number) {
  return (
    measured.lines.length === 2 &&
    !measured.truncated &&
    measured.lineWidths.every((width) => width <= maxWidth + 1)
  );
}

/** Main-title size vs template designed size. Short titles stay restrained so the subtitle can stay strong. */
export function mainTitleSizeScale(charCount: number) {
  if (charCount <= 4) return 0.88;
  if (charCount <= 5) return 0.86;
  if (charCount <= 6) return 0.84;
  if (charCount <= 7) return 0.8;
  return 0.74;
}

function subtitleRatio(mainChars: number, subChars: number) {
  if (subChars >= 8) return 0.7;
  if (subChars > mainChars + 1) return 0.72;
  if (Math.abs(subChars - mainChars) <= 1) return 0.78;
  if (mainChars <= 4) return 0.78;
  return SUBTITLE_TO_TITLE_RATIO;
}

export function subtitleSizeFromMain(
  mainSize: number,
  mainChars = 5,
  subChars = 5,
) {
  const ratio = Math.min(
    SUBTITLE_TO_TITLE_RATIO_MAX,
    Math.max(SUBTITLE_TO_TITLE_RATIO_MIN, subtitleRatio(mainChars, subChars)),
  );
  return Math.max(MIN_SUBTITLE_SIZE, Math.round(mainSize * ratio));
}

function widenSlotForLongLine(slot: TextSlot, text: string, charCount: number): TextSlot {
  const visuallyLong = findCoverLocationKeywords(text).length > 0 || charCount >= 8;
  if (!visuallyLong) return slot;
  const edge = Math.round(CANVAS_WIDTH * TEXT_EDGE_RATIO);
  const maxWidth = Math.min(CANVAS_WIDTH - edge * 2, Math.round(slot.maxWidth * 1.08));
  return { ...slot, maxWidth };
}

function fitSingleLine(
  text: string,
  slot: TextSlot,
  font: Font,
  startSize: number,
  minSize: number,
  firstLineReserve: number,
) {
  let size = startSize;
  let measured = measureLine(text, slot, font, size, firstLineReserve);
  while (size > minSize && !lineFits(measured, slot.maxWidth)) {
    size -= 2;
    measured = measureLine(text, slot, font, size, firstLineReserve);
  }
  return { size, measured, fits: lineFits(measured, slot.maxWidth) };
}

function fitMainTitle(
  text: string,
  slot: TextSlot,
  font: Font,
  firstLineReserve: number,
) {
  const chars = countCoverUnits(text);
  const designed = clampMainTitleSize(slot.size * mainTitleSizeScale(chars));
  const minSize = Math.min(
    designed,
    Math.max(MIN_TITLE_SIZE, slot.minSize ?? MIN_TITLE_SIZE),
  );

  const oneLine = fitSingleLine(text, slot, font, designed, minSize, firstLineReserve);
  if (oneLine.fits) {
    return oneLine.measured;
  }

  const split = splitTitleIntoLines(text, { oneLineMax: 0 });
  if (split.line2) {
    let size = designed;
    let measured = twoLineMeasured(
      split.line1,
      split.line2,
      slot,
      font,
      size,
      firstLineReserve,
    );
    while (size > minSize && !twoLineFits(measured, slot.maxWidth)) {
      size -= 2;
      measured = twoLineMeasured(
        split.line1,
        split.line2,
        slot,
        font,
        size,
        firstLineReserve,
      );
    }
    if (twoLineFits(measured, slot.maxWidth) || measured.fontSize <= minSize) {
      return measured;
    }
  }

  return oneLine.measured;
}

function fitTwoLineSubtitle(
  text: string,
  slot: TextSlot,
  font: Font,
  startSize: number,
  minSize: number,
) {
  const split = splitTitleIntoLines(text, { oneLineMax: 0 });
  if (!split.line2) return null;
  let size = startSize;
  let measured = twoLineMeasured(split.line1, split.line2, slot, font, size, 0);
  while (size > minSize && !twoLineFits(measured, slot.maxWidth)) {
    size -= 2;
    measured = twoLineMeasured(split.line1, split.line2, slot, font, size, 0);
  }
  return measured;
}

function fitSubtitle(
  text: string,
  slot: TextSlot,
  font: Font,
  mainSize: number,
  mainChars: number,
) {
  const subChars = countCoverUnits(text);
  const wideSlot = widenSlotForLongLine(slot, text, countCoverChars(text));
  const startSize = Math.min(
    wideSlot.size,
    subtitleSizeFromMain(mainSize, mainChars, subChars),
  );
  const minSize = Math.max(
    MIN_SUBTITLE_SIZE,
    wideSlot.minSize ?? MIN_SUBTITLE_SIZE,
    Math.round(mainSize * SUBTITLE_TO_TITLE_RATIO_MIN),
  );

  const oneLine = fitSingleLine(text, wideSlot, font, startSize, minSize, 0);
  if (oneLine.fits) return oneLine.measured;

  const twoLine = fitTwoLineSubtitle(text, wideSlot, font, startSize, minSize);
  if (twoLine && (twoLineFits(twoLine, wideSlot.maxWidth) || subChars >= 8)) {
    if (!oneLine.fits || twoLine.fontSize >= oneLine.size) return twoLine;
  }

  return twoLine && twoLine.fontSize >= oneLine.size ? twoLine : oneLine.measured;
}

export function resolveOverlayLines(options: {
  templateId: string;
  title: string;
  subtitle: string;
  titleSlot: TextSlot;
  subtitleSlot: TextSlot;
  font: Font;
  subtitleFont: Font;
  firstLineReserve?: number;
}): OverlayLines {
  const {
    title,
    subtitle,
    titleSlot,
    subtitleSlot,
    font,
    subtitleFont,
    firstLineReserve = 0,
  } = options;

  const titleMeasured = fitMainTitle(title, titleSlot, font, firstLineReserve);
  if (!subtitle) {
    return asOverlay(title, "", titleMeasured, null);
  }

  const mainChars = countCoverUnits(title);
  let subtitleMeasured = fitSubtitle(
    subtitle,
    subtitleSlot,
    subtitleFont,
    titleMeasured.fontSize,
    mainChars,
  );

  const ratio = subtitleMeasured.fontSize / Math.max(1, titleMeasured.fontSize);
  if (ratio > SUBTITLE_TO_TITLE_RATIO_MAX) {
    const capped = Math.round(titleMeasured.fontSize * SUBTITLE_TO_TITLE_RATIO);
    subtitleMeasured = fitSubtitle(
      subtitle,
      { ...subtitleSlot, size: capped, minSize: capped },
      subtitleFont,
      titleMeasured.fontSize,
      mainChars,
    );
  } else if (ratio < SUBTITLE_TO_TITLE_RATIO_MIN && titleMeasured.fontSize > MIN_TITLE_SIZE) {
    const restrainedMain = clampMainTitleSize(
      subtitleMeasured.fontSize / SUBTITLE_TO_TITLE_RATIO,
    );
    if (restrainedMain < titleMeasured.fontSize) {
      const smallerTitle = fitMainTitle(
        title,
        { ...titleSlot, size: restrainedMain, minSize: MIN_TITLE_SIZE },
        font,
        firstLineReserve,
      );
      subtitleMeasured = fitSubtitle(
        subtitle,
        subtitleSlot,
        subtitleFont,
        smallerTitle.fontSize,
        mainChars,
      );
      return asOverlay(title, subtitle, smallerTitle, subtitleMeasured);
    }
  }

  return asOverlay(title, subtitle, titleMeasured, subtitleMeasured);
}
