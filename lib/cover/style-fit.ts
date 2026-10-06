export function formatCoverStyleFitRules() {
  return `COVER STYLE FIT — list only template ids that keep the subject complete. The website picks the final Style from suitableTemplateIds. Never cover or crop a face, main dish, or shop sign.
- top-stroke: 2×2 only when photoCount >= 4 and every tile stays clear; otherwise a safe single photo.
- dual-line: needs sticker space that misses faces and dishes. 2×2 uses the same crop rule.
- top-banner: middle band must miss the subject.
- polaroid: subject stays inside the frame.
- center-lower: room for a large title without covering the subject.
- photo-only: when type would cover the subject. Still return mainTitle and subTitle in JSON.
If none fit, suitableTemplateIds is ["photo-only"]. Do not invent a template or list all 6 by default.`;
}
