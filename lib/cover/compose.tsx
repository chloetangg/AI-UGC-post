import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadRequiredFonts, toSatoriFonts, getFontFamily, toUsedFont } from "./fonts";
import { readPublicFile } from "./asset-path";
import { encodeOutput, prepareBaseImage, prepareTileImage } from "./image";
import type { ReactNode } from "react";
import {
  applyCoverTitleHierarchy,
  keepRenderableCoverText,
  layoutSlotText,
  type MeasuredText,
} from "./typography";
import { resolveOverlayLines, subtitleSizeFromMain } from "./overlay-layout";
import { countCoverUnits, sanitizeCoverLine } from "./cover-title";
import { COLORS, getTemplate } from "./templates";
import { applyFontMatch } from "./font-match";
import { COLLAGE_BACKGROUND, COLLAGE_TILES, collageGridBounds, planCollageTiles } from "./collage";
import { isFourGridTemplateId } from "./post-layout";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CoverComposeError,
  SAFE_AREA,
  TEXT_EDGE_RATIO,
  EMPHASIS_PACK_SCALE,
  MIN_READABLE_RATIO,
  MAX_TITLE_SIZE,
  MIN_SUBTITLE_SIZE,
  MIN_TITLE_SIZE,
  SUBTITLE_TO_TITLE_RATIO_MIN,
  type ComposeRequest,
  type ComposeResult,
  type CoverTemplate,
  type CoverTextStyle,
  type Decoration,
  type OverlayConfig,
  type Stroke,
  type TextSlot,
} from "./types";

type LaidOutSlot = {
  slot: TextSlot;
  measured: MeasuredText;
  text: string;
};

const SUBTITLE_GAP = 32;
const POLAROID_SUBTITLE_GAP = 28;

function canvasEdgeInset() {
  return {
    x: Math.round(CANVAS_WIDTH * TEXT_EDGE_RATIO),
    y: Math.round(CANVAS_HEIGHT * TEXT_EDGE_RATIO),
  };
}

function preferredTextTop(blockHeight: number) {
  const edge = canvasEdgeInset();
  const bandCenter = Math.round(CANVAS_HEIGHT * 0.42);
  const top = bandCenter - Math.round(blockHeight / 2);
  const minTop = edge.y;
  const maxTop = Math.min(
    Math.round(CANVAS_HEIGHT / 2) - Math.round(blockHeight * 0.15),
    CANVAS_HEIGHT - edge.y - blockHeight,
  );
  return Math.min(Math.max(top, minTop), Math.max(minTop, maxTop));
}

function centeredOn(centerY: number, blockHeight: number) {
  const edge = canvasEdgeInset();
  const top = Math.round(centerY - blockHeight / 2);
  return Math.min(Math.max(top, edge.y), CANVAS_HEIGHT - edge.y - blockHeight);
}

function offsetDecoration(decoration: Decoration, dx: number, dy: number): Decoration {
  if (decoration.type === "polaroid-frame") return decoration;
  if ("x" in decoration && "y" in decoration) {
    return { ...decoration, x: decoration.x + dx, y: decoration.y + dy };
  }
  return decoration;
}

function bottomCardRect(template: CoverTemplate) {
  const cards = template.decoration.filter(
    (item) => item.type === "rect" && item.width >= 600 && item.height >= 200,
  );
  const card = [...cards].sort((a, b) => {
    if (a.type !== "rect" || b.type !== "rect") return 0;
    return b.width * b.height - a.width * a.height;
  })[0];
  if (card?.type === "rect") {
    return { x: card.x, y: card.y, width: card.width, height: card.height };
  }
  return { x: 70, y: 480, width: 940, height: 330 };
}

function topBannerRect(template: CoverTemplate) {
  const banner = template.decoration.find(
    (item) => item.type === "rect" && item.width >= CANVAS_WIDTH && item.height >= 180,
  );
  if (banner?.type === "rect") {
    return {
      x: banner.x,
      y: banner.y,
      width: banner.width,
      height: banner.height,
    };
  }
  return { x: 0, y: 278, width: CANVAS_WIDTH, height: 268 };
}

function paddedTextBox(template: CoverTemplate) {
  let left = 0;
  let top = 0;
  let right = CANVAS_WIDTH;
  let bottom = CANVAS_HEIGHT;

  if (template.id === "polaroid") {
    const frame = template.decoration.find((item) => item.type === "polaroid-frame");
    const inset = frame?.type === "polaroid-frame" ? frame.inset : 42;
    const extra = frame?.type === "polaroid-frame" ? frame.bottomExtra : 300;
    left = inset;
    right = CANVAS_WIDTH - inset;
    top = CANVAS_HEIGHT - inset - extra;
    bottom = CANVAS_HEIGHT - inset;
  } else if (template.id === "left-spine") {
    left = 44;
    top = 44;
    right = 1036;
    bottom = 1306;
  } else if (template.id === "bottom-card") {
    const card = bottomCardRect(template);
    left = card.x;
    top = card.y;
    right = card.x + card.width;
    bottom = card.y + card.height;
  } else if (template.id === "top-banner") {
    const banner = topBannerRect(template);
    left = 0;
    top = banner.y;
    right = CANVAS_WIDTH;
    bottom = banner.y + banner.height;
  }

  const padX =
    template.id === "left-spine"
      ? 24
      : Math.round((right - left) * TEXT_EDGE_RATIO);
  const padY = Math.round((bottom - top) * TEXT_EDGE_RATIO);
  return {
    left: left + padX,
    top: top + padY,
    right: right - padX,
    bottom: bottom - padY,
  };
}

function applyTextEdgeInset(template: CoverTemplate): CoverTemplate {
  const box = paddedTextBox(template);
  const insetSlot = (slot: TextSlot): TextSlot => {
    const x = Math.max(slot.x, box.left);
    const maxWidth = Math.max(160, Math.min(slot.maxWidth, box.right - x));
    const y = Math.min(Math.max(slot.y, box.top), Math.max(box.top, box.bottom - 48));
    return { ...slot, x, y, maxWidth };
  };
  return {
    ...template,
    slots: {
      ...template.slots,
      title: insetSlot(template.slots.title),
      subtitle: insetSlot(template.slots.subtitle),
    },
  };
}

function polaroidCaptionBounds(template: CoverTemplate) {
  const box = paddedTextBox(template);
  return {
    x: box.left,
    top: box.top,
    bottom: box.bottom,
    maxWidth: box.right - box.left,
    maxHeight: Math.max(80, box.bottom - box.top),
  };
}

function overlayBlockHeight(
  title: LaidOutSlot,
  subtitle: LaidOutSlot | null,
  gap: number,
) {
  return title.measured.height + (subtitle ? gap + subtitle.measured.height : 0);
}

function hexToRgba(color: string, opacity: number): string {
  const raw = color.replace("#", "");
  if (raw.length !== 6) {
    return `rgba(0, 0, 0, ${opacity})`;
  }
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function overlayStyle(overlay: OverlayConfig): {
  left: number;
  top: number;
  width: number;
  height: number;
  backgroundImage: string;
} {
  const color = overlay.color ?? COLORS.black;
  const solid = hexToRgba(color, overlay.opacity);
  const clear = hexToRgba(color, 0);
  const topHeight = 520;
  const bottomHeight = 640;
  const leftWidth = 360;

  switch (overlay.direction) {
    case "top-to-transparent":
      return {
        left: 0,
        top: 0,
        width: CANVAS_WIDTH,
        height: topHeight,
        backgroundImage: `linear-gradient(to bottom, ${solid}, ${clear})`,
      };
    case "transparent-to-bottom":
      return {
        left: 0,
        top: CANVAS_HEIGHT - bottomHeight,
        width: CANVAS_WIDTH,
        height: bottomHeight,
        backgroundImage: `linear-gradient(to bottom, ${clear}, ${solid})`,
      };
    case "left-to-transparent":
      return {
        left: 0,
        top: 0,
        width: leftWidth,
        height: CANVAS_HEIGHT,
        backgroundImage: `linear-gradient(to right, ${solid}, ${clear})`,
      };
    case "transparent-to-top":
      return {
        left: 0,
        top: 0,
        width: CANVAS_WIDTH,
        height: topHeight,
        backgroundImage: `linear-gradient(to top, ${solid}, ${clear})`,
      };
  }
}

function strokeStyle(
  stroke?: Stroke | null,
  dropShadow?: TextSlot["dropShadow"],
) {
  const shadows: string[] = [];
  if (stroke) {
    const { width, color } = stroke;
    shadows.push(
      `${width}px 0 0 ${color}`,
      `${-width}px 0 0 ${color}`,
      `0 ${width}px 0 ${color}`,
      `0 ${-width}px 0 ${color}`,
      `${width}px ${width}px 0 ${color}`,
      `${-width}px ${-width}px 0 ${color}`,
      `${width}px ${-width}px 0 ${color}`,
      `${-width}px ${width}px 0 ${color}`,
    );
  }
  if (dropShadow) {
    shadows.push(`${dropShadow.x}px ${dropShadow.y}px 0 ${dropShadow.color}`);
  }
  return {
    ...(stroke ? { WebkitTextStroke: `${stroke.width}px ${stroke.color}` } : {}),
    ...(shadows.length ? { textShadow: shadows.join(", ") } : {}),
  };
}

function justifyContent(align: TextSlot["align"]) {
  if (align === "center") return "center";
  if (align === "right") return "flex-end";
  return "flex-start";
}

function renderDecoration(decoration: Decoration, index: number) {
  if (decoration.type === "rect") {
    return (
      <div
        key={`deco-${index}`}
        style={{
          position: "absolute",
          left: decoration.x,
          top: decoration.y,
          width: decoration.width,
          height: decoration.height,
          backgroundColor: decoration.fill,
          opacity: decoration.opacity ?? 1,
          borderRadius: decoration.radius ?? 0,
          display: "flex",
          ...(decoration.borderWidth
            ? {
                border: `${decoration.borderWidth}px solid ${decoration.borderColor ?? decoration.fill}`,
              }
            : {}),
          ...(decoration.rotate ? { transform: `rotate(${decoration.rotate}deg)` } : {}),
        }}
      />
    );
  }

  if (decoration.type === "gradient") {
    const style = overlayStyle({
      position: decoration.direction.includes("left") ? "left" : "top",
      direction: decoration.direction,
      opacity: decoration.opacity,
      color: decoration.color,
    });
    return (
      <div
        key={`deco-${index}`}
        style={{
          position: "absolute",
          left: decoration.x,
          top: decoration.y,
          width: decoration.width,
          height: decoration.height,
          backgroundImage: style.backgroundImage,
          display: "flex",
        }}
      />
    );
  }

  if (decoration.type === "slant-banner") {
    return (
      <div
        key={`deco-${index}`}
        style={{
          position: "absolute",
          left: decoration.x,
          top: decoration.y,
          width: decoration.width,
          height: decoration.height,
          backgroundColor: decoration.fill,
          opacity: decoration.opacity ?? 1,
          transform: `skewY(${decoration.skewY ?? -11}deg)`,
          display: "flex",
        }}
      />
    );
  }

  if (decoration.type === "circle") {
    return (
      <div
        key={`deco-${index}`}
        style={{
          position: "absolute",
          left: decoration.x,
          top: decoration.y,
          width: decoration.size,
          height: decoration.size,
          backgroundColor: decoration.fill,
          opacity: decoration.opacity ?? 1,
          borderRadius: decoration.size,
          display: "flex",
        }}
      />
    );
  }

  if (decoration.type === "ring") {
    return (
      <div
        key={`deco-${index}`}
        style={{
          position: "absolute",
          left: decoration.x,
          top: decoration.y,
          width: decoration.size,
          height: decoration.size,
          border: `${decoration.borderWidth}px solid ${decoration.color}`,
          borderRadius: decoration.size,
          opacity: decoration.opacity ?? 1,
          display: "flex",
        }}
      />
    );
  }

  if (decoration.type === "sparkle") {
    const arm = Math.max(3, Math.round(decoration.size * 0.18));
    return (
      <div
        key={`deco-${index}`}
        style={{
          position: "absolute",
          left: decoration.x,
          top: decoration.y,
          width: decoration.size,
          height: decoration.size,
          opacity: decoration.opacity ?? 1,
          display: "flex",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: (decoration.size - arm) / 2,
            top: 0,
            width: arm,
            height: decoration.size,
            backgroundColor: decoration.fill,
            borderRadius: arm,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: (decoration.size - arm) / 2,
            width: decoration.size,
            height: arm,
            backgroundColor: decoration.fill,
            borderRadius: arm,
            display: "flex",
          }}
        />
      </div>
    );
  }

  if (decoration.type === "arrow") {
    const height = Math.max(8, Math.round(decoration.width * 0.18));
    const head = Math.max(12, Math.round(decoration.width * 0.28));
    return (
      <div
        key={`deco-${index}`}
        style={{
          position: "absolute",
          left: decoration.x,
          top: decoration.y,
          width: decoration.width,
          height: head,
          opacity: decoration.opacity ?? 1,
          display: "flex",
          ...(decoration.rotate ? { transform: `rotate(${decoration.rotate}deg)` } : {}),
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: (head - height) / 2,
            width: decoration.width - head * 0.35,
            height,
            backgroundColor: decoration.fill,
            borderRadius: height,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: head,
            height: head,
            backgroundColor: decoration.fill,
            transform: "rotate(45deg)",
            display: "flex",
          }}
        />
      </div>
    );
  }

  if (decoration.type === "heart") {
    const size = decoration.size;
    const bump = Math.round(size * 0.56);
    return (
      <div
        key={`deco-${index}`}
        style={{
          position: "absolute",
          left: decoration.x,
          top: decoration.y,
          width: size,
          height: size,
          opacity: decoration.opacity ?? 1,
          display: "flex",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: Math.round(size * 0.12),
            width: bump,
            height: bump,
            backgroundColor: decoration.fill,
            borderRadius: bump,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 0,
            top: Math.round(size * 0.12),
            width: bump,
            height: bump,
            backgroundColor: decoration.fill,
            borderRadius: bump,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: Math.round(size * 0.12),
            top: Math.round(size * 0.28),
            width: Math.round(size * 0.76),
            height: Math.round(size * 0.76),
            backgroundColor: decoration.fill,
            transform: "rotate(45deg)",
            display: "flex",
          }}
        />
      </div>
    );
  }

  if (decoration.type !== "polaroid-frame") {
    return null;
  }

  const bottomHeight = decoration.inset + decoration.bottomExtra;
  return (
    <div
      key={`deco-${index}`}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        display: "flex",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: CANVAS_WIDTH,
          height: decoration.inset,
          backgroundColor: decoration.fill,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: decoration.inset,
          height: CANVAS_HEIGHT,
          backgroundColor: decoration.fill,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: decoration.inset,
          height: CANVAS_HEIGHT,
          backgroundColor: decoration.fill,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: CANVAS_WIDTH,
          height: bottomHeight,
          backgroundColor: decoration.fill,
          display: "flex",
        }}
      />
    </div>
  );
}

function renderLines(
  measured: MeasuredText,
  slot: TextSlot,
  extra?: { color?: string; firstLinePrefix?: ReactNode },
) {
  const family = getFontFamily(slot.font);
  const color = extra?.color ?? slot.fill;
  const vertical = slot.writingMode === "vertical";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: vertical ? measured.width : slot.maxWidth,
        justifyContent: justifyContent(slot.align),
        alignItems: vertical ? "center" : justifyContent(slot.align),
        overflow: "visible",
        paddingTop: slot.stroke?.width ?? 0,
        paddingBottom: slot.stroke?.width ?? 0,
      }}
    >
      {measured.lines.map((line, index) => {
        const text = (
          <div
            style={{
              display: "flex",
              color,
              fontSize: measured.fontSize,
              fontFamily: family,
              fontWeight: 400,
              lineHeight: measured.lineHeight,
              whiteSpace: "nowrap",
            overflow: "visible",
            height: measured.fontSize * measured.lineHeight,
            flexShrink: 0,
              ...strokeStyle(slot.stroke, slot.dropShadow),
            }}
          >
            {line}
          </div>
        );
        if (index === 0 && extra?.firstLinePrefix) {
          return (
            <div
              key={`line-${index}`}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                overflow: "visible",
                width: "auto",
              }}
            >
              {extra.firstLinePrefix}
              {text}
            </div>
          );
        }
        return (
          <div key={`line-${index}`} style={{ display: "flex" }}>
            {text}
          </div>
        );
      })}
    </div>
  );
}

function renderPolaroidCaption(
  template: CoverTemplate,
  title: LaidOutSlot,
  subtitle: LaidOutSlot | null,
) {
  const box = polaroidCaptionBounds(template);
  return (
    <div
      style={{
        position: "absolute",
        left: box.x,
        top: box.top,
        width: box.maxWidth,
        height: box.maxHeight,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {renderLines(title.measured, { ...title.slot, maxWidth: box.maxWidth, align: "center" })}
      {subtitle?.measured.lines.length ? (
        <div
          style={{
            display: "flex",
            marginTop: POLAROID_SUBTITLE_GAP,
          }}
        >
          {renderLines(subtitle.measured, {
            ...subtitle.slot,
            maxWidth: box.maxWidth,
            align: "center",
          })}
        </div>
      ) : null}
    </div>
  );
}

function renderBottomCardCaption(
  template: CoverTemplate,
  title: LaidOutSlot,
  subtitle: LaidOutSlot | null,
) {
  const card = bottomCardRect(template);
  const box = paddedTextBox(template);
  const padLeft = box.left - card.x;
  const padRight = card.x + card.width - box.right;
  const innerWidth = Math.max(160, box.right - box.left);
  return (
    <div
      style={{
        position: "absolute",
        left: card.x,
        top: card.y,
        width: card.width,
        height: card.height,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingLeft: padLeft,
        paddingRight: padRight,
      }}
    >
      {renderLines(title.measured, {
        ...title.slot,
        maxWidth: innerWidth,
        align: "left",
      })}
      {subtitle?.measured.lines.length ? (
        <div
          style={{
            display: "flex",
            marginTop: 16,
          }}
        >
          {renderLines(subtitle.measured, {
            ...subtitle.slot,
            maxWidth: innerWidth,
            align: "left",
          })}
        </div>
      ) : null}
    </div>
  );
}

const TOP_BANNER_FLAG_GAP = 16;
const TOP_BANNER_FLAG_BORDER = 3;

function topBannerFlagMetrics(fontSize: number) {
  const height = Math.round(Math.max(44, fontSize * 0.68));
  const width = Math.round(height * 1.5);
  return {
    width,
    height,
    reserve: width + TOP_BANNER_FLAG_GAP + TOP_BANNER_FLAG_BORDER * 2,
  };
}
let thaiFlagSrcCache: string | null = null;

async function ensureThaiFlagSrc() {
  if (thaiFlagSrcCache) return thaiFlagSrcCache;
  const file = await readPublicFile("cover/thai-flag.png");
  thaiFlagSrcCache = `data:image/png;base64,${file.toString("base64")}`;
  return thaiFlagSrcCache;
}

function thaiFlagSrc() {
  return thaiFlagSrcCache ?? "";
}

function renderThaiFlag(size: { width: number; height: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: size.width,
        height: size.height,
        overflow: "hidden",
        borderRadius: Math.max(4, Math.round(size.height * 0.08)),
        border: `${TOP_BANNER_FLAG_BORDER}px solid #FFFFFF`,
      }}
    >
      <img
        src={thaiFlagSrc()}
        width={size.width}
        height={size.height}
        alt=""
        style={{
          width: size.width,
          height: size.height,
          objectFit: "cover",
        }}
      />
    </div>
  );
}

function renderTopBannerCaption(
  template: CoverTemplate,
  title: LaidOutSlot,
  subtitle: LaidOutSlot | null,
) {
  const banner = topBannerRect(template);
  const box = paddedTextBox(template);
  const flag = topBannerFlagMetrics(title.measured.fontSize);
  const innerWidth = Math.max(160, box.right - box.left);
  const flagPrefix = (
    <div
      style={{
        display: "flex",
        marginRight: TOP_BANNER_FLAG_GAP,
      }}
    >
      {renderThaiFlag(flag)}
    </div>
  );
  return (
    <div
      style={{
        position: "absolute",
        left: banner.x,
        top: banner.y,
        width: banner.width,
        height: banner.height,
        overflow: "visible",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: box.left - banner.x,
        paddingRight: banner.x + banner.width - box.right,
        paddingTop: box.top - banner.y,
        paddingBottom: banner.y + banner.height - box.bottom,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {renderLines(
          title.measured,
          {
            ...title.slot,
            maxWidth: innerWidth,
            align: "center",
          },
          { firstLinePrefix: flagPrefix },
        )}
        {subtitle?.measured.lines.length ? (
          <div
            style={{
              display: "flex",
              marginTop: 12,
            }}
          >
            {renderLines(subtitle.measured, {
              ...subtitle.slot,
              maxWidth: innerWidth,
              align: "center",
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function renderCoverText(
  template: CoverTemplate,
  title: LaidOutSlot,
  subtitle: LaidOutSlot | null,
) {
  if (template.textStyle) {
    return renderStyledPack(template.textStyle, title, subtitle);
  }
  if (template.id === "polaroid") {
    return renderPolaroidCaption(template, title, subtitle);
  }
  if (template.id === "bottom-card") {
    return renderBottomCardCaption(template, title, subtitle);
  }
  if (template.id === "top-banner") {
    return renderTopBannerCaption(template, title, subtitle);
  }
  return [renderTextSlot(title), renderTextSlot(subtitle)];
}

function renderTextSlot(laidOut: LaidOutSlot | null) {
  if (!laidOut || !laidOut.measured.lines.length) return null;
  const { slot, measured } = laidOut;
  const top = Math.max(0, Math.min(slot.y, CANVAS_HEIGHT - 8));
  const left = Math.max(0, slot.x);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          width: CANVAS_WIDTH,
          height: top,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          marginLeft: left,
          width: slot.maxWidth,
          justifyContent: justifyContent(slot.align),
          overflow: "visible",
          flexShrink: 0,
        }}
      >
        {renderLines(measured, slot)}
      </div>
    </div>
  );
}

const CHIP_YELLOW = "#F6E389";
const STICKER_YELLOW = "#FFE34A";
const STICKER_WHITE = "#FFFFFF";
const STICKER_INK = "#141414";
const BLOB_WHITE = "#FFFDF7";
const BLOB_ORANGE = "#F08A2C";
const BLOB_INK = "#1A1A1A";

function renderChip(options: {
  key: string;
  text: string;
  fontSize: number;
  fontFamily: string;
  textColor: string;
  fill: string;
  width: number;
  height: number;
  radius: number;
  stroke?: Stroke | null;
  shadow?: { x: number; y: number; color: string };
  border?: { width: number; color: string };
  rotate?: number;
}) {
  const shadow = options.shadow;
  const extraX = shadow ? Math.abs(shadow.x) : 0;
  const extraY = shadow ? Math.abs(shadow.y) : 0;
  const chipLeft = shadow && shadow.x < 0 ? Math.abs(shadow.x) : 0;
  const chipTop = shadow && shadow.y < 0 ? Math.abs(shadow.y) : 0;

  return (
    <div
      key={options.key}
      style={{
        display: "flex",
        position: "relative",
        width: options.width + extraX,
        height: options.height + extraY,
        ...(options.rotate ? { transform: `rotate(${options.rotate}deg)` } : {}),
      }}
    >
      {shadow ? (
        <div
          style={{
            position: "absolute",
            left: chipLeft + shadow.x,
            top: chipTop + shadow.y,
            width: options.width,
            height: options.height,
            backgroundColor: shadow.color,
            borderRadius: options.radius,
            display: "flex",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: chipLeft,
          top: chipTop,
          width: options.width,
          height: options.height,
          backgroundColor: options.fill,
          borderRadius: options.radius,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...(options.border
            ? { border: `${options.border.width}px solid ${options.border.color}` }
            : {}),
          overflow: "visible",
        }}
      >
        <div
          style={{
            display: "flex",
            color: options.textColor,
            fontSize: options.fontSize,
            fontFamily: options.fontFamily,
            whiteSpace: "nowrap",
            ...strokeStyle(options.stroke),
          }}
        >
          {options.text}
        </div>
      </div>
    </div>
  );
}

function packScale(kind: CoverTextStyle["kind"]) {
  return kind === "chips" || kind === "slant-stickers" || kind === "blob-stickers"
    ? EMPHASIS_PACK_SCALE
    : 1;
}

function blobPadX(fontSize: number, lineHeight: number) {
  const scale = packScale("blob-stickers");
  const padY = Math.round(22 * scale);
  const singleHeight = Math.round(fontSize * lineHeight + padY * 2);
  const radius = Math.round(singleHeight * 0.42);
  return Math.max(Math.round(44 * scale), Math.round(radius * 0.55) + 12);
}

function stickerInnerMaxWidth(
  kind: CoverTextStyle["kind"],
  fontSize: number,
  lineHeight: number,
) {
  const edge = canvasEdgeInset().x * 2;
  const padX =
    kind === "blob-stickers"
      ? blobPadX(fontSize, lineHeight)
      : Math.round(32 * packScale(kind));
  const border = kind === "blob-stickers" ? 12 : 0;
  const rotateSlack = kind === "blob-stickers" ? 20 : 0;
  return Math.max(200, CANVAS_WIDTH - edge - padX * 2 - border - rotateSlack);
}

function styledPackBounds(
  kind: CoverTextStyle["kind"],
  title: LaidOutSlot,
  subtitle: LaidOutSlot | null,
  style?: CoverTextStyle,
) {
  const scale = packScale(kind);
  const gap = style?.gap ?? Math.round((kind === "outline-stack" ? 10 : kind === "blob-stickers" ? 14 : 12) * scale);
  const subtitleGap = style?.subtitleGap ?? gap;
  const padY = Math.round((kind === "outline-stack" ? 0 : kind === "blob-stickers" ? 26 : 16) * scale);
  const padX =
    kind === "blob-stickers"
      ? blobPadX(title.measured.fontSize, title.measured.lineHeight)
      : Math.round((kind === "outline-stack" ? 0 : 32) * scale);
  const titleHeight =
    kind === "outline-stack"
      ? title.measured.height
      : kind === "blob-stickers"
        ? title.measured.height + padY * 2
        : title.measured.lines.length * (title.measured.fontSize * title.measured.lineHeight + padY * 2) +
          Math.max(0, title.measured.lines.length - 1) * gap;
  const subtitleHeight = subtitle
    ? kind === "outline-stack"
      ? subtitle.measured.fontSize * subtitle.measured.lineHeight
      : subtitle.measured.fontSize * subtitle.measured.lineHeight + padY * 2
    : 0;
  const height = titleHeight + (subtitle ? subtitleGap + subtitleHeight : 0);
  const titleWidth = Math.max(
    ...title.measured.lineWidths.map((width) => width + (kind === "outline-stack" ? 0 : padX * 2)),
    title.measured.width,
  );
  const subtitleWidth = subtitle
    ? subtitle.measured.width + (kind === "outline-stack" ? 0 : padX * 2)
    : 0;
  return {
    width: Math.min(CANVAS_WIDTH - canvasEdgeInset().x * 2, Math.max(titleWidth, subtitleWidth, 120)),
    height,
    gap,
    subtitleGap,
    padX,
    padY,
  };
}

function renderStyledPack(
  style: CoverTextStyle,
  title: LaidOutSlot,
  subtitle: LaidOutSlot | null,
) {
  const kind = style.kind;
  const family = getFontFamily(title.slot.font);
  const subFamily = subtitle ? getFontFamily(subtitle.slot.font) : family;
  const bounds = styledPackBounds(kind, title, subtitle, style);
  const rotate = style.rotate ?? (kind === "slant-stickers" ? -12 : 0);
  const edge = canvasEdgeInset();
  const top = Math.max(
    edge.y,
    Math.min(title.slot.y, CANVAS_HEIGHT - edge.y - bounds.height),
  );
  const gap = style.gap ?? bounds.gap;
  const subtitleGap = style.subtitleGap ?? bounds.subtitleGap;
  const shadow = { x: 7, y: 8, color: "rgba(0, 0, 0, 0.82)" };

  const titleChips = (() => {
    if (kind === "outline-stack") {
      return title.measured.lines.map((line, index) => {
        const strokeWidth = title.slot.stroke?.width ?? 14;
        return (
          <div
            key={`outline-title-${index}`}
            style={{
              display: "flex",
              color: title.slot.fill,
              fontSize: title.measured.fontSize,
              fontFamily: family,
              lineHeight: title.measured.lineHeight,
              height: title.measured.fontSize * title.measured.lineHeight,
              whiteSpace: "nowrap",
              ...strokeStyle(
                title.slot.stroke ?? { color: COLORS.white, width: strokeWidth },
                title.slot.dropShadow ?? { x: 5, y: 7, color: COLORS.black },
              ),
            }}
          >
            {line}
          </div>
        );
      });
    }

    if (kind === "chips") {
      return title.measured.lines.map((line, index) => {
        const lineWidth = title.measured.lineWidths[index] ?? title.measured.width;
        const padX = Math.round(30 * packScale(kind));
        const padY = Math.round(14 * packScale(kind));
        const height = Math.round(title.measured.fontSize * title.measured.lineHeight + padY * 2);
        const width = Math.round(Math.min(bounds.width, lineWidth + padX * 2));
        return renderChip({
          key: `chip-title-${index}`,
          text: line,
          fontSize: title.measured.fontSize,
          fontFamily: family,
          textColor: STICKER_INK,
          fill: CHIP_YELLOW,
          width,
          height,
          radius: Math.round(16 * packScale(kind)),
          shadow: { x: 4, y: 5, color: "rgba(0, 0, 0, 0.28)" },
        });
      });
    }

    if (kind === "blob-stickers") {
      const scale = packScale(kind);
      const padX = blobPadX(title.measured.fontSize, title.measured.lineHeight);
      const padY = Math.round(22 * scale);
      const maxOuter = CANVAS_WIDTH - canvasEdgeInset().x * 2;
      const height = Math.round(title.measured.height + padY * 2);
      const singleHeight = Math.round(title.measured.fontSize * title.measured.lineHeight + padY * 2);
      const width = Math.round(Math.min(maxOuter, title.measured.width + padX * 2));
      const extraX = 7;
      const extraY = 8;
      return [
        <div
          key="blob-title-wrap"
          style={{
            display: "flex",
            position: "relative",
            width: width + extraX,
            height: height + extraY,
            transform: "rotate(-6deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: extraX,
              top: extraY,
              width,
              height,
              backgroundColor: "rgba(0, 0, 0, 0.82)",
              borderRadius: Math.round(singleHeight * 0.42),
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width,
              height,
              backgroundColor: BLOB_WHITE,
              borderRadius: Math.round(singleHeight * 0.42),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              border: `5px solid ${BLOB_INK}`,
              overflow: "visible",
            }}
          >
            {title.measured.lines.map((line, index) => (
              <div
                key={`blob-line-${index}`}
                style={{
                  display: "flex",
                  color: BLOB_INK,
                  fontSize: title.measured.fontSize,
                  fontFamily: family,
                  height: title.measured.fontSize * title.measured.lineHeight,
                  whiteSpace: "nowrap",
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>,
      ];
    }

    const padX = Math.round(32 * packScale(kind));
    const padY = Math.round(16 * packScale(kind));
    const innerHeight = title.measured.height;
    const height = Math.round(innerHeight + padY * 2);
    const width = Math.round(Math.min(bounds.width, title.measured.width + padX * 2));
    if (title.measured.lines.length <= 1) {
      return [
        renderChip({
          key: `${kind}-title`,
          text: title.measured.lines[0] ?? title.text,
          fontSize: title.measured.fontSize,
          fontFamily: family,
          textColor: STICKER_INK,
          fill: STICKER_YELLOW,
          width,
          height,
          radius: 22,
          shadow,
        }),
      ];
    }

    const extraX = 7;
    const extraY = 8;
    return [
      <div
        key={`${kind}-title-wrap`}
        style={{
          display: "flex",
          position: "relative",
          width: width + extraX,
          height: height + extraY,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: extraX,
            top: extraY,
            width,
            height,
            backgroundColor: "rgba(0, 0, 0, 0.82)",
            borderRadius: 22,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height,
            backgroundColor: STICKER_YELLOW,
            borderRadius: 22,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {title.measured.lines.map((line, index) => (
            <div
              key={`pack-line-${index}`}
              style={{
                display: "flex",
                color: STICKER_INK,
                fontSize: title.measured.fontSize,
                fontFamily: family,
                height: title.measured.fontSize * title.measured.lineHeight,
                whiteSpace: "nowrap",
              }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>,
    ];
  })();

  let subtitleNode: ReactNode = null;
  if (subtitle?.measured.lines[0]) {
    const line = subtitle.measured.lines[0];
    const lineWidth = subtitle.measured.lineWidths[0] ?? subtitle.measured.width;
    if (kind === "outline-stack") {
      const stroke = subtitle.slot.stroke ?? title.slot.stroke ?? { color: COLORS.white, width: 14 };
      const dropShadow =
        subtitle.slot.dropShadow ?? title.slot.dropShadow ?? { x: 5, y: 7, color: COLORS.black };
      subtitleNode = (
        <div
          key="outline-sub"
          style={{
            display: "flex",
            color: subtitle.slot.fill,
            fontSize: subtitle.measured.fontSize,
            fontFamily: subFamily,
            lineHeight: subtitle.measured.lineHeight,
            height: subtitle.measured.fontSize * subtitle.measured.lineHeight,
            whiteSpace: "nowrap",
            ...strokeStyle(stroke, dropShadow),
          }}
        >
          {line}
        </div>
      );
    } else if (kind === "blob-stickers") {
      const scale = packScale(kind);
      const height = Math.round(subtitle.measured.fontSize * subtitle.measured.lineHeight + 28 * scale);
      const padX = Math.max(Math.round(72 * scale), Math.round(height / 2) + 12);
      const maxOuter = CANVAS_WIDTH - canvasEdgeInset().x * 2;
      subtitleNode = renderChip({
        key: "blob-sub",
        text: line,
        fontSize: subtitle.measured.fontSize,
        fontFamily: subFamily,
        textColor: BLOB_INK,
        fill: BLOB_ORANGE,
        width: Math.round(Math.min(maxOuter, lineWidth + padX * 2)),
        height,
        radius: Math.round(height / 2),
        shadow,
        border: { width: 4, color: BLOB_INK },
        rotate: 5,
      });
    } else if (kind === "slant-stickers") {
      const scale = packScale(kind);
      const height = Math.round(subtitle.measured.fontSize * subtitle.measured.lineHeight + 28 * scale);
      subtitleNode = renderChip({
        key: "slant-sub",
        text: line,
        fontSize: subtitle.measured.fontSize,
        fontFamily: subFamily,
        textColor: STICKER_INK,
        fill: STICKER_WHITE,
        width: Math.round(Math.min(bounds.width, lineWidth + 60 * scale)),
        height,
        radius: Math.round(22 * scale),
        shadow,
      });
    } else {
      const scale = packScale(kind);
      const height = Math.round(subtitle.measured.fontSize * subtitle.measured.lineHeight + 28 * scale);
      subtitleNode = renderChip({
        key: "chip-sub",
        text: line,
        fontSize: subtitle.measured.fontSize,
        fontFamily: subFamily,
        textColor: STICKER_INK,
        fill: CHIP_YELLOW,
        width: Math.round(Math.min(bounds.width, lineWidth + 56 * scale)),
        height,
        radius: Math.round(16 * scale),
        shadow: { x: 4, y: 5, color: "rgba(0, 0, 0, 0.28)" },
      });
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          width: CANVAS_WIDTH,
          height: top,
          flexShrink: 0,
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: bounds.width,
          height: Math.ceil(bounds.height),
          flexShrink: 0,
          ...(rotate ? { transform: `rotate(${rotate}deg)` } : {}),
        }}
      >
        {titleChips.map((node, index) => (
          <div
            key={`pack-title-${index}`}
            style={{
              display: "flex",
              marginBottom:
                index < titleChips.length - 1 ? gap : subtitleNode ? subtitleGap : 0,
            }}
          >
            {node}
          </div>
        ))}
        {subtitleNode}
      </div>
    </div>
  );
}

function CoverMarkup(props: {
  photoDataUrl: string;
  collageTiles?: Array<{
    dataUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
  }>;
  titleBackdrop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  template: CoverTemplate;
  overlayEnabled: boolean;
  title: LaidOutSlot;
  subtitle: LaidOutSlot | null;
}) {
  const overlay =
    props.overlayEnabled && props.template.overlay
      ? overlayStyle(props.template.overlay)
      : null;
  const collage = props.template.layout === "collage" && props.collageTiles?.length;

  return (
    <div
      style={{
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        backgroundColor: collage ? COLLAGE_BACKGROUND : COLORS.black,
      }}
    >
      {collage ? (
        props.collageTiles?.map((tile, index) => (
          <div
            key={`tile-${index}`}
            style={{
              position: "absolute",
              left: tile.x,
              top: tile.y,
              width: tile.width,
              height: tile.height,
              borderRadius: tile.radius,
              overflow: "hidden",
              display: "flex",
            }}
          >
            <img
              src={tile.dataUrl}
              width={tile.width}
              height={tile.height}
              alt=""
              style={{
                width: tile.width,
                height: tile.height,
                objectFit: "cover",
              }}
            />
          </div>
        ))
      ) : (
        <img
          src={props.photoDataUrl}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          alt=""
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            objectFit: "cover",
          }}
        />
      )}

      {overlay ? (
        <div
          style={{
            position: "absolute",
            left: overlay.left,
            top: overlay.top,
            width: overlay.width,
            height: overlay.height,
            backgroundImage: overlay.backgroundImage,
            display: "flex",
          }}
        />
      ) : null}

      {props.template.decoration.map((decoration, index) =>
        renderDecoration(decoration, index),
      )}

      {props.titleBackdrop ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: CANVAS_WIDTH,
              height: props.titleBackdrop.y,
              flexShrink: 0,
            }}
          />
          <div
            style={{
              display: "flex",
              width: props.titleBackdrop.width,
              height: props.titleBackdrop.height,
              backgroundColor: "rgba(15, 15, 15, 0.42)",
              borderRadius: 28,
              flexShrink: 0,
            }}
          />
        </div>
      ) : null}

      {renderCoverText(props.template, props.title, props.subtitle)}
    </div>
  );
}

function asSinglePhotoTemplate(template: CoverTemplate): CoverTemplate {
  if (template.layout !== "collage") return template;
  const edge = canvasEdgeInset();
  return {
    ...template,
    layout: "single",
    overlay: template.overlay ?? {
      position: "bottom",
      direction: "transparent-to-bottom",
      opacity: 0.22,
      color: COLORS.black,
    },
    slots: {
      ...template.slots,
      title: {
        ...template.slots.title,
        x: edge.x,
        y: 220,
        maxWidth: CANVAS_WIDTH - edge.x * 2,
        maxHeight: 380,
        align: "center",
      },
      subtitle: {
        ...template.slots.subtitle,
        x: edge.x,
        y: 380,
        maxWidth: CANVAS_WIDTH - edge.x * 2,
        maxHeight: 160,
        align: "center",
      },
    },
  };
}

export async function composeCover(request: ComposeRequest): Promise<ComposeResult> {
  if (!request.title.trim()) {
    throw new CoverComposeError("title is required", 400);
  }
  if (!request.image?.length) {
    throw new CoverComposeError("image is required", 400);
  }

  const foundTemplate = getTemplate(request.templateId);
  if (!foundTemplate) {
    throw new CoverComposeError(`Unknown templateId: ${request.templateId}`, 400);
  }
  const sources = [request.image, ...(request.images ?? [])].filter((item) => item?.length);
  const useCollage = isFourGridTemplateId(foundTemplate.id) && sources.length === 4;
  const base = applyFontMatch(foundTemplate, request.fontId);
  const matched = useCollage
    ? { ...base, layout: "collage" as const }
    : foundTemplate.layout === "collage"
      ? asSinglePhotoTemplate(base)
      : base;
  const sized = applyCoverTitleHierarchy(matched);
  const template = applyTextEdgeInset(sized);
  const titleFontId = template.slots.title.font;
  const subtitleFontId = template.slots.subtitle.font;
  const fonts = await loadRequiredFonts(
    titleFontId === subtitleFontId ? [titleFontId] : [titleFontId, subtitleFontId],
  );
  try {
    await ensureThaiFlagSrc();
  } catch {
    thaiFlagSrcCache = "";
  }
  const coverFont = fonts.get(titleFontId);
  const subtitleFont = fonts.get(subtitleFontId) ?? coverFont;

  if (!coverFont || !subtitleFont) {
    throw new CoverComposeError("Chinese font failed to load", 500);
  }

  const title = keepRenderableCoverText(
    sanitizeCoverLine(request.title),
    coverFont.metricsFont,
  );
  if (!title) {
    throw new CoverComposeError("title is required", 400);
  }

  const photo = await prepareBaseImage(sources[0], {
    crop: request.crop ?? "attention",
    dimPhoto: request.dimPhoto ?? false,
  });

  let collageTiles: Array<{
    dataUrl: string;
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
  }> | undefined;

  if (useCollage) {
    const plan = planCollageTiles(sources.length);
    collageTiles = [];
    for (let index = 0; index < COLLAGE_TILES.length; index += 1) {
      const tile = COLLAGE_TILES[index];
      const mapped = plan[index];
      const source = sources[mapped.sourceIndex] ?? sources[0];
      let prepared;
      try {
        prepared = await prepareTileImage(source, tile.width, tile.height, {
          crop: mapped.crop,
          zoom: mapped.zoom,
        });
      } catch {
        prepared = await prepareTileImage(sources[0], tile.width, tile.height, {
          crop: "center",
          zoom: 1,
        });
      }
      collageTiles.push({
        dataUrl: prepared.dataUrl,
        x: tile.x,
        y: tile.y,
        width: tile.width,
        height: tile.height,
        radius: tile.radius,
      });
    }
  }

  const subtitleText = keepRenderableCoverText(
    sanitizeCoverLine(request.subtitle ?? ""),
    subtitleFont.metricsFont,
  );
  const polaroidBox = template.id === "polaroid" ? polaroidCaptionBounds(template) : null;
  const overlayGap = polaroidBox ? POLAROID_SUBTITLE_GAP : SUBTITLE_GAP;
  const layoutOverlayLine = (
    text: string,
    slot: TextSlot,
    font: typeof coverFont.metricsFont,
    maxLines?: number,
    firstLineReserve = 0,
  ) =>
    layoutSlotText({
      text,
      slot,
      font,
      role: "title",
      maxLines,
      firstLineReserve,
    });

  let titleSlot: TextSlot = {
    ...template.slots.title,
    maxHeight: polaroidBox
      ? template.slots.title.maxHeight
      : Math.max(
          template.slots.title.size * (template.slots.title.lineHeight ?? 1.15) * 2,
          template.slots.title.maxHeight ?? CANVAS_HEIGHT - SAFE_AREA * 2,
        ),
  };
  let subtitleSlot: TextSlot = { ...template.slots.subtitle };

  if (polaroidBox) {
    titleSlot = {
      ...titleSlot,
      x: polaroidBox.x,
      y: polaroidBox.top,
      maxWidth: polaroidBox.maxWidth,
      maxHeight: polaroidBox.maxHeight,
      align: "center",
    };
    subtitleSlot = {
      ...subtitleSlot,
      x: polaroidBox.x,
      maxWidth: polaroidBox.maxWidth,
      maxHeight: polaroidBox.maxHeight,
      align: "center",
    };
  }

  if (template.id === "bottom-card") {
    const box = paddedTextBox(template);
    const maxWidth = Math.max(160, box.right - box.left);
    const maxHeight = Math.max(80, box.bottom - box.top);
    titleSlot = {
      ...titleSlot,
      x: box.left,
      y: box.top,
      maxWidth,
      maxHeight,
      align: "left",
    };
    subtitleSlot = {
      ...subtitleSlot,
      x: box.left,
      maxWidth,
      maxHeight,
      align: "left",
    };
  }

  if (template.id === "top-banner") {
    const box = paddedTextBox(template);
    const maxWidth = Math.max(160, box.right - box.left);
    const maxHeight = Math.max(180, box.bottom - box.top);
    titleSlot = {
      ...titleSlot,
      x: box.left,
      y: box.top,
      maxWidth,
      maxHeight,
      align: "center",
    };
    subtitleSlot = {
      ...subtitleSlot,
      x: box.left,
      maxWidth,
      maxHeight,
      align: "center",
    };
  }

  if (template.textStyle?.kind === "blob-stickers" || template.textStyle?.kind === "slant-stickers") {
    const maxWidth = stickerInnerMaxWidth(
      template.textStyle.kind,
      titleSlot.size,
      titleSlot.lineHeight ?? 1.1,
    );
    titleSlot = {
      ...titleSlot,
      maxWidth,
      align: "center",
    };
    subtitleSlot = {
      ...subtitleSlot,
      maxWidth,
      align: "center",
    };
  }

  const bannerFlagReserve =
    template.id === "top-banner" ? topBannerFlagMetrics(titleSlot.size).reserve : 0;
  let overlay = resolveOverlayLines({
    templateId: template.id,
    title,
    subtitle: subtitleText,
    titleSlot,
    subtitleSlot,
    font: coverFont.metricsFont,
    subtitleFont: subtitleFont.metricsFont,
    firstLineReserve: bannerFlagReserve,
  });
  const titleLayout: LaidOutSlot = {
    slot: { ...titleSlot, size: overlay.titleMeasured.fontSize, minSize: overlay.titleMeasured.fontSize },
    text: overlay.title,
    measured: overlay.titleMeasured,
  };
  let subtitleLayout: LaidOutSlot | null = overlay.subtitle
    ? {
        slot: {
          ...subtitleSlot,
          size: overlay.subtitleMeasured?.fontSize ?? overlay.titleMeasured.fontSize,
          minSize: overlay.subtitleMeasured?.fontSize ?? overlay.titleMeasured.fontSize,
        },
        text: overlay.subtitle,
        measured: overlay.subtitleMeasured ?? overlay.titleMeasured,
      }
    : null;
  let overlayTitle = overlay.title;

  const relayoutOverlay = (size: number) => {
    size = Math.min(MAX_TITLE_SIZE, Math.round(size));
    const subSize = subtitleSizeFromMain(
      size,
      countCoverUnits(overlayTitle),
      countCoverUnits(overlay.subtitle),
    );
    const nextTitleSlot = { ...titleSlot, size, minSize: Math.round(size * 0.72) };
    const nextSubtitleSlot = {
      ...subtitleSlot,
      size: subSize,
      minSize: Math.max(MIN_SUBTITLE_SIZE, Math.round(size * SUBTITLE_TO_TITLE_RATIO_MIN)),
    };
    titleLayout.slot = nextTitleSlot;
    titleLayout.text = overlayTitle;
    titleLayout.measured = layoutOverlayLine(
      overlayTitle,
      nextTitleSlot,
      coverFont.metricsFont,
      overlay.titleMeasured.lines.length > 1 ? 2 : 1,
      template.id === "top-banner" ? topBannerFlagMetrics(size).reserve : 0,
    );
    if (subtitleLayout) {
      subtitleLayout.slot = nextSubtitleSlot;
      subtitleLayout.measured = layoutOverlayLine(
        overlay.subtitle,
        nextSubtitleSlot,
        subtitleFont.metricsFont,
        overlay.subtitleMeasured && overlay.subtitleMeasured.lines.length > 1 ? 2 : 1,
      );
    }
  };

  if (template.id === "bottom-card" || template.id === "top-banner") {
    const box = paddedTextBox(template);
    const maxHeight = Math.max(80, box.bottom - box.top);
    const gap = template.id === "top-banner" ? 12 : 16;
    let size = titleLayout.measured.fontSize;
    const minSize = Math.min(titleSlot.minSize ?? MIN_TITLE_SIZE, size);
    while (
      overlayBlockHeight(titleLayout, subtitleLayout, gap) > maxHeight &&
      size > minSize
    ) {
      size -= 2;
      relayoutOverlay(size);
    }
  } else if (polaroidBox) {
    let size = titleLayout.measured.fontSize;
    const minSize = Math.max(MIN_TITLE_SIZE, Math.round(titleSlot.size * MIN_READABLE_RATIO));
    const overlayFits = () => {
      if (titleLayout.measured.truncated || subtitleLayout?.measured.truncated) return false;
      if (overlayBlockHeight(titleLayout, subtitleLayout, overlayGap) > polaroidBox.maxHeight) {
        return false;
      }
      return true;
    };
    while (!overlayFits() && size > minSize) {
      size -= 2;
      relayoutOverlay(size);
    }
    if (!overlayFits()) relayoutOverlay(minSize);
  } else if (
    template.textStyle?.kind === "blob-stickers" ||
    template.textStyle?.kind === "slant-stickers"
  ) {
    const stickerKind = template.textStyle.kind;
    let size = titleLayout.measured.fontSize;
    const minSize = Math.max(MIN_TITLE_SIZE, Math.round(titleSlot.size * MIN_READABLE_RATIO));
    const lineHeight = titleSlot.lineHeight ?? 1.1;
    const overlayFits = () => {
      if (titleLayout.measured.truncated || subtitleLayout?.measured.truncated) return false;
      const inner = stickerInnerMaxWidth(stickerKind, size, lineHeight);
      if (titleLayout.measured.lineWidths.some((width) => width > inner)) return false;
      if (subtitleLayout?.measured.lineWidths.some((width) => width > inner)) return false;
      return true;
    };
    while (!overlayFits() && size > minSize) {
      size -= 2;
      const inner = stickerInnerMaxWidth(stickerKind, size, lineHeight);
      titleSlot = { ...titleSlot, maxWidth: inner, size, minSize: Math.round(size * 0.72) };
      subtitleSlot = { ...subtitleSlot, maxWidth: inner };
      relayoutOverlay(size);
    }
    if (!overlayFits()) relayoutOverlay(minSize);
  }

  if (polaroidBox) {
    const titleY = polaroidBox.top;
    titleLayout.slot = { ...titleLayout.slot, y: titleY };
    if (subtitleLayout) {
      subtitleLayout.slot = {
        ...subtitleLayout.slot,
        y: Math.round(titleY + titleLayout.measured.height + overlayGap),
      };
    }
  } else if (
    template.layout !== "collage" &&
    !template.textStyle &&
    template.id !== "bottom-card" &&
    template.id !== "top-banner"
  ) {
    const box = paddedTextBox(template);
    const blockHeight =
      titleLayout.measured.height +
      (subtitleLayout ? SUBTITLE_GAP + subtitleLayout.measured.height : 0);
    const maxTitleY = Math.max(box.top, box.bottom - blockHeight);
    const titleY = Math.min(Math.max(titleLayout.slot.y, box.top), maxTitleY);
    titleLayout.slot = {
      ...titleLayout.slot,
      y: titleY,
    };
    if (subtitleLayout) {
      subtitleLayout.slot = {
        ...subtitleLayout.slot,
        y: Math.round(titleY + titleLayout.measured.height + SUBTITLE_GAP),
      };
    }
  }

  if (template.textStyle && template.layout !== "collage") {
    const pack = styledPackBounds(
      template.textStyle.kind,
      titleLayout,
      subtitleLayout,
      template.textStyle,
    );
    titleLayout.slot = {
      ...titleLayout.slot,
      y: preferredTextTop(pack.height),
    };
  }

  let titleBackdrop: { x: number; y: number; width: number; height: number } | null = null;
  let renderTemplate = template;
  if (template.layout === "collage") {
    const grid = collageGridBounds();
    const edge = canvasEdgeInset();
    if (template.textStyle) {
      const pack = styledPackBounds(
        template.textStyle.kind,
        titleLayout,
        subtitleLayout,
        template.textStyle,
      );
      const blockY = centeredOn(grid.centerY, pack.height);
      titleLayout.slot = {
        ...titleLayout.slot,
        x: Math.round(grid.centerX - pack.width / 2),
        y: blockY,
        maxWidth: pack.width,
        align: "center",
      };
      if (subtitleLayout) {
        subtitleLayout.slot = {
          ...subtitleLayout.slot,
          x: titleLayout.slot.x,
          y: blockY,
          maxWidth: pack.width,
          align: "center",
        };
      }
    } else {
      const padX = 36;
      const padY = 22;
      const innerWidth = Math.max(
        titleLayout.measured.width,
        subtitleLayout?.measured.width ?? 0,
      );
      const blockWidth = Math.min(
        Math.max(innerWidth + padX * 2, 420),
        CANVAS_WIDTH - edge.x * 2,
      );
      const blockHeight =
        titleLayout.measured.height +
        (subtitleLayout ? SUBTITLE_GAP + subtitleLayout.measured.height : 0) +
        padY * 2;
      const blockX = Math.round(grid.centerX - blockWidth / 2);
      const blockY = centeredOn(grid.centerY, blockHeight);
      titleBackdrop = { x: blockX, y: blockY, width: blockWidth, height: blockHeight };
      titleLayout.slot = {
        ...titleLayout.slot,
        x: blockX + padX,
        y: blockY + padY,
        maxWidth: blockWidth - padX * 2,
        align: "center",
      };
      if (subtitleLayout) {
        subtitleLayout.slot = {
          ...subtitleLayout.slot,
          x: blockX + padX,
          y: blockY + padY + titleLayout.measured.height + SUBTITLE_GAP,
          maxWidth: blockWidth - padX * 2,
          align: "center",
        };
      }
    }
    renderTemplate = {
      ...template,
      decoration: template.decoration.map((item) =>
        offsetDecoration(
          item,
          titleLayout.slot.x - template.slots.title.x,
          titleLayout.slot.y - template.slots.title.y,
        ),
      ),
    };
  }

  const svg = await satori(
    <CoverMarkup
      photoDataUrl={photo.dataUrl}
      collageTiles={collageTiles}
      titleBackdrop={titleBackdrop}
      template={renderTemplate}
      overlayEnabled={request.overlayEnabled ?? true}
      title={titleLayout}
      subtitle={subtitleLayout}
    />,
    {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fonts: toSatoriFonts(fonts),
    },
  );

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: CANVAS_WIDTH },
    font: { loadSystemFonts: false },
  });
  const png = resvg.render().asPng();
  const format = request.format ?? "png";
  const encoded = await encodeOutput(Buffer.from(png), format);

  return {
    buffer: encoded.buffer,
    contentType: encoded.contentType,
    templateId: template.id,
    usedFontSize: titleLayout.measured.fontSize,
    usedFont: toUsedFont(coverFont),
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  };
}
