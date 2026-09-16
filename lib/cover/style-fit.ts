export function formatCoverStyleFitRules() {
  return `COVER STYLE FIT — analyze ALL attached photos BEFORE listing suitableTemplateIds.
The website picks the final Style from suitableTemplateIds using history avoidance. You do NOT decide the final Style. selectedTemplateId must be one of suitableTemplateIds, but the website may replace it.

Priority: subject completeness > faces > dish/product completeness > visual beauty > Style variety.
Never crop away a face, a main dish, or a shop sign just to force a Style. Never cover a face, main dish, or key building with title/subtitle.

Step 1 — for every photo, note:
- subject: person / dish / table / building / shop / scenery / other
- subject position: top / middle / bottom / left / right / center
- visual focus vs safer negative space
- crop risk
- faces must be protected
- dishes must keep plating complete
- shop/building photos must keep the facade and sign readable

Step 2 — a Style enters suitableTemplateIds ONLY if it can be used without covering or cropping the main subject.

Style fit (IDs):
- top-stroke (Style 1): photoCount >= 4 → 2×2 grid. Include only if every photo that would enter the grid stays clear after crop; subjects are balanced; no face/dish would be cut. If any one photo is badly edge-heavy for a 2×2 crop, EXCLUDE top-stroke. photoCount 1–3 → single-photo version of Style 1; include only if that single cover is safe.
- dual-line (Style 2, tilted stickers): include if there is a safe zone for stickers and they will not cover faces/dishes. Exclude if the subject fills the frame with no safe zone. photoCount >= 4 may also use a 2×2; same crop-safety rule as top-stroke.
- top-banner (Style 3, green mid band + Thai flag): include if the horizontal middle is relatively safe and the band will not cover a face, main dish, or important building. Exclude if the subject sits in the exact center with no mid-frame breathing room. Prefer when the subject is mainly top or bottom.
- polaroid (Style 4): include if the subject is centered, distinct from the background, and survives polaroid framing. Exclude if the subject hugs an edge and the frame would crop it.
- center-lower (Style 5, large red outline title): include if the subject is clear, background is relatively simple, and there is room for a large title that will not cover faces/dishes. Exclude if the subject fills the frame with no text-safe area.
- photo-only (Style 6, no text on the image): include if the photo is already complete, the subject owns the frame, there is almost no text-safe area, adding type would cover the subject, or the image is strong on its own. Still generate mainTitle and subTitle in JSON; do not draw them on this Style.

Look at every uploaded photo, not only Photo 1.
If several Styles fit, list only those. Do not dump all 6 unless they all truly fit.
If only one Style fits, suitableTemplateIds has that one id.
If none fully fit, suitableTemplateIds must be ["photo-only"] — lowest overlay risk. Do not invent a new template.`;
}
