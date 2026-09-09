import { COVER_TEMPLATE_OPTIONS, type CoverTemplateOptionId } from "@/lib/cover/post-layout";
import type { CoverTemplate, FontId } from "./types";

export const FONT_OPTIONS = [
  "jiangchengheiti",
  "jiangchengyuanti",
  "jingnabobohei",
] as const satisfies readonly FontId[];

export const FONT_IDS: FontId[] = [...FONT_OPTIONS];

export type TemplateFontAssignments = Record<CoverTemplateOptionId, FontId>;

export function isFontId(value: string | null | undefined): value is FontId {
  return FONT_IDS.includes(value as FontId);
}

function pickFont(pool: readonly FontId[]) {
  return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
}

/**
 * One generation-level assignment for all 10 templates.
 * Fonts may repeat. At least two distinct fonts. Prefer breaking long identical runs.
 */
export function generateRandomFontAssignments(): TemplateFontAssignments {
  const templateIds = COVER_TEMPLATE_OPTIONS.map((item) => item.id);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const picks: FontId[] = [];
    for (let index = 0; index < templateIds.length; index += 1) {
      let pool: readonly FontId[] = FONT_OPTIONS;
      if (index >= 2 && picks[index - 1] === picks[index - 2]) {
        const filtered = FONT_OPTIONS.filter((font) => font !== picks[index - 1]);
        if (filtered.length > 0) pool = filtered;
      }
      picks.push(pickFont(pool));
    }
    if (new Set(picks).size >= 2) {
      return Object.fromEntries(
        templateIds.map((id, index) => [id, picks[index]]),
      ) as TemplateFontAssignments;
    }
  }

  return Object.fromEntries(
    templateIds.map((id, index) => [id, FONT_OPTIONS[index % 2]]),
  ) as TemplateFontAssignments;
}

export function fontForTemplate(
  templateId: string,
  assignments?: Record<string, string> | null,
  fallback?: string | null,
): FontId {
  const assigned = assignments?.[templateId];
  if (isFontId(assigned)) return assigned;
  if (isFontId(fallback)) return fallback;
  return FONT_OPTIONS[0];
}

export function matchFontForTemplate(templateId: string, override?: FontId): FontId {
  if (override && isFontId(override)) return override;
  return FONT_OPTIONS[0];
}

export function applyFontMatch(
  template: CoverTemplate,
  override?: FontId,
): CoverTemplate {
  const font = matchFontForTemplate(template.id, override);

  return {
    ...template,
    slots: {
      title: { ...template.slots.title, font },
      subtitle: { ...template.slots.subtitle, font },
      badge: { ...template.slots.badge, font },
    },
  };
}
