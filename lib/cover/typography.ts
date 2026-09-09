import type { Font } from "fontkit";
import {
  CANVAS_HEIGHT,
  MAX_BADGE_CHARS,
  MAX_BADGE_LINES,
  MAX_SUBTITLE_LAYOUT_CHARS,
  MAX_SUBTITLE_LINES,
  MAX_TITLE_LAYOUT_CHARS,
  MAX_TITLE_LINES,
  MIN_BADGE_SIZE,
  MAX_TITLE_SIZE,
  MIN_SUBTITLE_SIZE,
  MIN_TITLE_SIZE,
  EMPHASIS_SIZE_SCALE,
  EMPHASIS_TEMPLATE_IDS,
  COLLAGE_TITLE_SCALE,
  MAIN_TITLE_RESTRAINT,
  SUBTITLE_TO_TITLE_RATIO,
  SUBTITLE_TO_TITLE_RATIO_MIN,
  type CoverTemplate,
  type TextSlot,
} from "./types";

export type MeasuredText = {
  lines: string[]
  lineWidths: number[]
  fontSize: number
  lineHeight: number
  width: number
  height: number
  truncated: boolean
};

const graphemeSegmenter = (() => {
  try {
    return new Intl.Segmenter("zh", { granularity: "grapheme" });
  } catch {
    return null;
  }
})();

export function toGraphemes(text: string): string[] {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value) return [];
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(value)].map((part) => part.segment);
  }
  return Array.from(value);
}

const IGNORABLE_COVER_CODE_POINTS = new Set([
  0xfe0e, 0xfe0f, 0x200d, 0x200b, 0x2060, 0xfeff,
]);

/** Drop graphemes the cover font cannot draw (emoji, tofu boxes, etc.). */
export function keepRenderableCoverText(text: string, font: Font) {
  const kept = toGraphemes(text).filter((grapheme) => {
    let sawGlyph = false;
    for (const ch of grapheme) {
      const codePoint = ch.codePointAt(0);
      if (codePoint == null) return false;
      if (IGNORABLE_COVER_CODE_POINTS.has(codePoint)) continue;
      if (!font.hasGlyphForCodePoint(codePoint)) return false;
      sawGlyph = true;
    }
    return sawGlyph;
  });
  return kept.join("").replace(/\s+/g, " ").trim();
}

export function measureTextWidth(
  text: string,
  fontSize: number,
  font: Font,
  strokeWidth = 0,
): number {
  if (!text) return 0;
  const run = font.layout(text);
  const width = (run.advanceWidth / font.unitsPerEm) * fontSize;
  return width + strokeWidth * 2;
}

function wrapGraphemes(
  graphemes: string[],
  fontSize: number,
  maxWidth: number,
  font: Font,
  strokeWidth: number,
  firstLineReserve = 0,
): string[] {
  const lines: string[] = [];
  let current = "";
  const reserve = strokeWidth * 2;
  const limitFor = (lineIndex: number) =>
    Math.max(120, lineIndex === 0 ? maxWidth - firstLineReserve : maxWidth);

  for (const grapheme of graphemes) {
    const next = current + grapheme;
    const width = measureTextWidth(next, fontSize, font, strokeWidth) + reserve;
    if (!current || width <= limitFor(lines.length)) {
      current = next;
      continue;
    }
    lines.push(current);
    current = grapheme;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function measuredResult(
  lines: string[],
  fontSize: number,
  lineHeight: number,
  font: Font,
  strokeWidth: number,
  truncated: boolean,
): MeasuredText {
  const lineWidths = lines.map((line) =>
    measureTextWidth(line, fontSize, font, strokeWidth),
  );
  return {
    lines,
    lineWidths,
    fontSize,
    lineHeight,
    width: Math.max(0, ...lineWidths),
    height: lines.length * fontSize * lineHeight,
    truncated,
  };
}

function fits(
  lines: string[],
  maxLines: number,
  fontSize: number,
  maxWidth: number,
  font: Font,
  strokeWidth: number,
  firstLineReserve = 0,
): boolean {
  if (lines.length > maxLines) return false;
  return lines.every((line, index) => {
    const limit = Math.max(120, index === 0 ? maxWidth - firstLineReserve : maxWidth);
    return measureTextWidth(line, fontSize, font, strokeWidth) <= limit;
  });
}

function layoutHorizontal(options: {
  graphemes: string[];
  slot: TextSlot;
  font: Font;
  minSize: number;
  maxChars: number;
  maxLines: number;
  firstLineReserve?: number;
}): MeasuredText {
  const { slot, font, minSize, maxLines } = options;
  const graphemes = options.graphemes;
  const lineHeightRatio = slot.lineHeight ?? 1.15;
  const strokeWidth = slot.stroke?.width ?? 0;
  const designedReserve = options.firstLineReserve ?? 0;
  const designedSize = Math.max(slot.size, 1);
  const floor = Math.min(minSize, 56);
  let fontSize = slot.size;

  const reserveAt = (size: number) =>
    designedReserve ? Math.round(designedReserve * (size / designedSize)) : 0;

  const attempt = (size: number) =>
    wrapGraphemes(graphemes, size, slot.maxWidth, font, strokeWidth, reserveAt(size));

  while (true) {
    const lines = attempt(fontSize);
    const height = lines.length * fontSize * lineHeightRatio;
    const withinHeight = !slot.maxHeight || height <= slot.maxHeight;
    if (
      fits(lines, maxLines, fontSize, slot.maxWidth, font, strokeWidth, reserveAt(fontSize)) &&
      withinHeight
    ) {
      return measuredResult(lines, fontSize, lineHeightRatio, font, strokeWidth, false);
    }

    if (fontSize > floor) {
      fontSize = Math.max(floor, fontSize - 2);
      continue;
    }

    const fitted = attempt(fontSize);
    if (fitted.length > maxLines) {
      const compressed = Math.max(40, fontSize - 2);
      if (compressed < fontSize) {
        fontSize = compressed;
        continue;
      }
    }
    return measuredResult(fitted, fontSize, lineHeightRatio, font, strokeWidth, fitted.length > maxLines);
  }
}

function layoutVertical(options: {
  graphemes: string[];
  slot: TextSlot;
  font: Font;
  minSize: number;
  maxChars: number;
}): MeasuredText {
  const { slot, font, minSize } = options;
  const graphemes = options.graphemes;
  const lineHeightRatio = slot.lineHeight ?? 1.05;
  const strokeWidth = slot.stroke?.width ?? 0;
  let fontSize = slot.size;
  const maxHeight =
    slot.maxHeight ?? Math.max(120, CANVAS_HEIGHT - slot.y - 48);

  while (true) {
    const height = graphemes.length * fontSize * lineHeightRatio;
    const widest = Math.max(
      ...graphemes.map((g) => measureTextWidth(g, fontSize, font, strokeWidth)),
      fontSize,
    );

    if (height <= maxHeight && widest <= slot.maxWidth) {
      return measuredResult(graphemes, fontSize, lineHeightRatio, font, strokeWidth, false);
    }

    if (fontSize > minSize) {
      fontSize = Math.max(minSize, fontSize - 2);
      continue;
    }

    const maxCharsByHeight = Math.max(
      1,
      Math.floor(maxHeight / (fontSize * lineHeightRatio)),
    );
    if (graphemes.length > maxCharsByHeight && fontSize > 40) {
      fontSize = Math.max(40, fontSize - 2);
      continue;
    }

    return {
      ...measuredResult(graphemes, fontSize, lineHeightRatio, font, strokeWidth, false),
      width: Math.min(widest, slot.maxWidth),
      height: Math.min(height, maxHeight),
    };
  }
}

export function layoutSlotText(options: {
  text: string;
  slot: TextSlot;
  font: Font;
  role: "title" | "subtitle" | "badge";
  maxLines?: number;
  firstLineReserve?: number;
}): MeasuredText {
  const graphemes = toGraphemes(options.text);
  if (!graphemes.length) {
    return {
      lines: [],
      lineWidths: [],
      fontSize: options.slot.size,
      lineHeight: options.slot.lineHeight ?? 1.15,
      width: 0,
      height: 0,
      truncated: false,
    };
  }

  const limits = {
    title: {
      minSize: options.slot.minSize ?? MIN_TITLE_SIZE,
      maxChars: MAX_TITLE_LAYOUT_CHARS,
      maxLines: MAX_TITLE_LINES,
    },
    subtitle: {
      minSize: options.slot.minSize ?? MIN_SUBTITLE_SIZE,
      maxChars: MAX_SUBTITLE_LAYOUT_CHARS,
      maxLines: MAX_SUBTITLE_LINES,
    },
    badge: {
      minSize: MIN_BADGE_SIZE,
      maxChars: MAX_BADGE_CHARS,
      maxLines: MAX_BADGE_LINES,
    },
  }[options.role];
  const maxLines = options.maxLines ?? limits.maxLines;

  if (options.slot.writingMode === "vertical") {
    return layoutVertical({
      graphemes,
      slot: options.slot,
      font: options.font,
      minSize: limits.minSize,
      maxChars: limits.maxChars,
    });
  }

  return layoutHorizontal({
    graphemes,
    slot: options.slot,
    font: options.font,
    minSize: limits.minSize,
    maxChars: limits.maxChars,
    maxLines,
    firstLineReserve: options.firstLineReserve,
  });
}

export function medianFontSize(a: number, b: number) {
  return Math.round((a + b) / 2);
}

function lineBlockHeight(size: number, lineHeight: number, lines: number) {
  return Math.ceil(size * lineHeight * lines);
}

export function clampMainTitleSize(size: number) {
  return Math.min(MAX_TITLE_SIZE, Math.max(MIN_TITLE_SIZE, Math.round(size)));
}

export function applyLockedCoverTitleSize(template: CoverTemplate, size: number): CoverTemplate {
  const titleSize = clampMainTitleSize(size);
  const titleLineHeight = template.slots.title.lineHeight ?? 1.15;
  const subtitleLineHeight = template.slots.subtitle.lineHeight ?? 1.15;
  const subSize = Math.max(MIN_SUBTITLE_SIZE, Math.round(titleSize * SUBTITLE_TO_TITLE_RATIO));
  return {
    ...template,
    slots: {
      ...template.slots,
      title: {
        ...template.slots.title,
        size: titleSize,
        minSize: MIN_TITLE_SIZE,
        maxHeight: Math.max(
          template.slots.title.maxHeight ?? 0,
          lineBlockHeight(titleSize, titleLineHeight, MAX_TITLE_LINES),
        ),
      },
      subtitle: {
        ...template.slots.subtitle,
        size: subSize,
        minSize: Math.max(MIN_SUBTITLE_SIZE, Math.round(titleSize * SUBTITLE_TO_TITLE_RATIO_MIN)),
        maxHeight: Math.max(
          template.slots.subtitle.maxHeight ?? 0,
          lineBlockHeight(subSize, subtitleLineHeight, MAX_TITLE_LINES),
        ),
      },
    },
  };
}

/**
 * Main title stays dominant. Subtitle is a strong secondary headline (~70–80%).
 */
export function applyCoverTitleHierarchy(template: CoverTemplate): CoverTemplate {
  const emphasis = (EMPHASIS_TEMPLATE_IDS as readonly string[]).includes(template.id);
  let size = emphasis
    ? Math.round(template.slots.title.size * EMPHASIS_SIZE_SCALE)
    : template.slots.title.size;
  if (template.layout === "collage") {
    size = Math.round(size * COLLAGE_TITLE_SCALE);
  }
  size = clampMainTitleSize(Math.round(size * MAIN_TITLE_RESTRAINT));
  const textStyle = emphasis && template.textStyle
    ? { ...template.textStyle, gap: Math.round((template.textStyle.gap ?? 12) * 1.2) }
    : template.textStyle;
  const sized = applyLockedCoverTitleSize(template, size);
  return {
    ...sized,
    ...(textStyle ? { textStyle } : {}),
  };
}

/** @deprecated Use applyCoverTitleHierarchy */
export function applyUnifiedCoverTitleSize(template: CoverTemplate): CoverTemplate {
  return applyCoverTitleHierarchy(template);
}
