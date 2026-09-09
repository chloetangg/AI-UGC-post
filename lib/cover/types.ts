export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1350;
export const SAFE_AREA = 48;
/** Keep cover titles 5–10% off the nearest canvas or frame edge. */
export const TEXT_EDGE_RATIO = 0.075;
export const EMPHASIS_TEMPLATE_IDS = ["badge-stack", "split-band"] as const;
export const LEFT_ALIGN_TEMPLATE_IDS = ["bottom-card"] as const;
export const EMPHASIS_SIZE_SCALE = 1.38;
export const EMPHASIS_PACK_SCALE = 1.35;
/** Style 1 four-photo grid only; single-photo Style 1 keeps the designed size. */
export const COLLAGE_TITLE_SCALE = 0.8;
/** Slightly restrain designed main-title size so the subtitle can stay a strong secondary headline. */
export const MAIN_TITLE_RESTRAINT = 0.9;
/** Subtitle visual size as a fraction of the main title. Target 70–80% (about 1.25–1.4×). */
export const SUBTITLE_TO_TITLE_RATIO = 0.75;
export const SUBTITLE_TO_TITLE_RATIO_MIN = 0.65;
export const SUBTITLE_TO_TITLE_RATIO_MAX = 0.8;
export const MIN_READABLE_RATIO = 0.82;
/** Main-title rendered size stays in this band unless overflow forces a smaller fit. */
export const MIN_TITLE_SIZE = 87;
export const MAX_TITLE_SIZE = 110;
/** Content-rule max for main titles (Chinese-character-equivalent units). */
export const MAX_TITLE_CHARS = 7;
/** Layout grapheme cap — high enough that Latin mall names are never sliced. */
export const MAX_TITLE_LAYOUT_CHARS = 24;
export const MAX_TITLE_LINES = 2;
export const MAX_SUBTITLE_CHARS = 9;
export const MAX_SUBTITLE_LAYOUT_CHARS = 24;
export const MAX_SUBTITLE_LINES = 2;
export const MAX_BADGE_CHARS = 8;
export const MAX_BADGE_LINES = 1;
export const MIN_SUBTITLE_SIZE = 64;
export const MIN_BADGE_SIZE = 20;

export type FontId =
  | "jiangchengheiti"
  | "jiangchengyuanti"
  | "jingnabobohei";

export type OverlayConfig = {
  position: "top" | "bottom" | "left" | "none";
  direction:
    | "top-to-transparent"
    | "transparent-to-bottom"
    | "left-to-transparent"
    | "transparent-to-top";
  opacity: number;
  color?: string;
};

export type Stroke = {
  color: string;
  width: number;
};

export type TextSlot = {
  x: number;
  y: number;
  maxWidth: number;
  maxHeight?: number;
  font: FontId;
  size: number;
  fill: string;
  stroke?: Stroke | null;
  dropShadow?: { x: number; y: number; color: string } | null;
  align?: "left" | "center" | "right";
  minSize?: number;
  lineHeight?: number;
  writingMode?: "horizontal" | "vertical";
};

export type Decoration =
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
      opacity?: number;
      radius?: number;
      rotate?: number;
      borderWidth?: number;
      borderColor?: string;
    }
  | {
      type: "slant-banner";
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
      skewY?: number;
      opacity?: number;
    }
  | {
      type: "polaroid-frame";
      inset: number;
      bottomExtra: number;
      fill: string;
    }
  | {
      type: "gradient";
      x: number;
      y: number;
      width: number;
      height: number;
      direction: OverlayConfig["direction"];
      color: string;
      opacity: number;
    }
  | {
      type: "circle";
      x: number;
      y: number;
      size: number;
      fill: string;
      opacity?: number;
    }
  | {
      type: "ring";
      x: number;
      y: number;
      size: number;
      color: string;
      borderWidth: number;
      opacity?: number;
    }
  | {
      type: "sparkle";
      x: number;
      y: number;
      size: number;
      fill: string;
      opacity?: number;
    }
  | {
      type: "arrow";
      x: number;
      y: number;
      width: number;
      fill: string;
      opacity?: number;
      rotate?: number;
    }
  | {
      type: "heart";
      x: number;
      y: number;
      size: number;
      fill: string;
      opacity?: number;
    };

export type BadgeStyle = "capsule" | "block" | "plain";

export type TextStyleKind =
  | "chips"
  | "slant-stickers"
  | "outline-stack"
  | "blob-stickers";

export type CoverTextStyle = {
  kind: TextStyleKind;
  rotate?: number;
  gap?: number;
  subtitleGap?: number;
};

export type CoverTemplate = {
  id: string;
  name: string;
  layout: "single" | "collage";
  decoration: Decoration[];
  overlay: OverlayConfig | null;
  safeArea: number;
  badgeStyle?: BadgeStyle;
  badgeBackground?: string;
  textStyle?: CoverTextStyle;
  slots: {
    title: TextSlot;
    subtitle: TextSlot;
    badge: TextSlot;
  };
};

export type CoverSlotsInput = {
  title: string;
  subtitle?: string;
  badge?: string;
};

export type CropMode = "attention" | "center-top" | "center";

export type ComposeRequest = CoverSlotsInput & {
  templateId: string;
  image: Buffer;
  images?: Buffer[];
  format?: "png" | "jpeg";
  overlayEnabled?: boolean;
  dimPhoto?: boolean;
  crop?: CropMode;
  fontId?: FontId;
};

export type UsedFont = {
  id: FontId;
  name: string;
  file: string;
};

export type ComposeResult = {
  buffer: Buffer;
  contentType: "image/png" | "image/jpeg";
  templateId: string;
  usedFontSize: number;
  usedFont: UsedFont;
  width: number;
  height: number;
};

export type FontStatus = {
  id: FontId;
  name: string;
  file: string;
  loaded: boolean;
  error?: string;
};

export class CoverComposeError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "CoverComposeError";
  }
}
