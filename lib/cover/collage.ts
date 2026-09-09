import { CANVAS_HEIGHT, CANVAS_WIDTH, type CropMode } from "./types";

export type CollageTile = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  crop: CropMode;
  zoom: number;
};

export const COLLAGE_BACKGROUND = "#fff6ea";

const TILE_MARGIN = 18;
const TILE_GAP = 16;
const TILE_RADIUS = 22;
const TILE_WIDTH = Math.floor((CANVAS_WIDTH - TILE_MARGIN * 2 - TILE_GAP) / 2);
const TILE_HEIGHT = Math.floor((CANVAS_HEIGHT - TILE_MARGIN * 2 - TILE_GAP) / 2);

function equalTile(col: 0 | 1, row: 0 | 1, crop: CropMode): CollageTile {
  return {
    x: TILE_MARGIN + col * (TILE_WIDTH + TILE_GAP),
    y: TILE_MARGIN + row * (TILE_HEIGHT + TILE_GAP),
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    radius: TILE_RADIUS,
    crop,
    zoom: 1,
  };
}

/** Even 2×2 grid: all four cells share the same size, gap, and corner radius. */
export const COLLAGE_TILES: CollageTile[] = [
  equalTile(0, 0, "attention"),
  equalTile(1, 0, "center-top"),
  equalTile(0, 1, "center"),
  equalTile(1, 1, "attention"),
];

/** Geometric center of the Style 1 four-photo grid (the 2×2 cross). */
export function collageGridBounds() {
  const left = Math.min(...COLLAGE_TILES.map((tile) => tile.x));
  const top = Math.min(...COLLAGE_TILES.map((tile) => tile.y));
  const right = Math.max(...COLLAGE_TILES.map((tile) => tile.x + tile.width));
  const bottom = Math.max(...COLLAGE_TILES.map((tile) => tile.y + tile.height));
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: Math.round((left + right) / 2),
    centerY: Math.round((top + bottom) / 2),
  };
}

type TilePlan = {
  sourceIndex: number;
  crop: CropMode;
  zoom: number;
};

export function planCollageTiles(photoCount: number): TilePlan[] {
  const count = Math.max(1, photoCount);
  if (count === 1) {
    return [
      { sourceIndex: 0, crop: "attention", zoom: 1 },
      { sourceIndex: 0, crop: "center-top", zoom: 1 },
      { sourceIndex: 0, crop: "center", zoom: 1 },
      { sourceIndex: 0, crop: "attention", zoom: 1 },
    ];
  }
  if (count === 2) {
    return [
      { sourceIndex: 0, crop: "attention", zoom: 1 },
      { sourceIndex: 1, crop: "center-top", zoom: 1 },
      { sourceIndex: 0, crop: "center", zoom: 1 },
      { sourceIndex: 1, crop: "attention", zoom: 1 },
    ];
  }
  if (count === 3) {
    return [
      { sourceIndex: 0, crop: "attention", zoom: 1 },
      { sourceIndex: 1, crop: "center-top", zoom: 1 },
      { sourceIndex: 2, crop: "center", zoom: 1 },
      { sourceIndex: 0, crop: "attention", zoom: 1 },
    ];
  }
  return [
    { sourceIndex: 0, crop: "attention", zoom: 1 },
    { sourceIndex: 1, crop: "center-top", zoom: 1 },
    { sourceIndex: 2, crop: "center", zoom: 1 },
    { sourceIndex: 3, crop: "attention", zoom: 1 },
  ];
}

export function normalizePhotoIndexes(
  indexes: number[],
  primary: number,
  photoCount: number,
) {
  const maxIndex = Math.max(photoCount - 1, 0);
  const wanted = Math.min(4, Math.max(photoCount, 1));
  const unique: number[] = [];
  const candidates = [
    ...indexes,
    primary,
    ...Array.from({ length: photoCount }, (_, index) => index),
  ];
  for (const value of candidates) {
    if (!Number.isInteger(value) || value < 0 || value > maxIndex) continue;
    if (unique.includes(value)) continue;
    unique.push(value);
    if (unique.length >= wanted) break;
  }
  return unique.length > 0 ? unique : [0];
}

export function pickFourGridSources<T>(items: T[], indexes: number[]) {
  const chosen: T[] = [];
  const seen = new Set<number>();
  const candidates = [...indexes, ...items.map((_, index) => index)];
  for (const index of candidates) {
    if (!Number.isInteger(index) || seen.has(index) || items[index] == null) continue;
    seen.add(index);
    chosen.push(items[index]);
    if (chosen.length === 4) break;
  }
  return chosen;
}
