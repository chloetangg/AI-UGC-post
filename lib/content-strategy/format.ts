import type {
  ContentStrategyLibrary,
  SelectedContentStrategy,
  StrategyEvidence,
} from "@/lib/content-strategy/types";
import { photoSelectionHint, readStrategySignals } from "@/lib/content-strategy/select";

function lineList(values: string[]) {
  return values.map((value) => `- ${value}`).join("\n");
}

export function formatStrategyLibrary(library: ContentStrategyLibrary) {
  const ksps = library.ksps
    .map((item) => {
      const frequency = item.frequency === "low" ? " [LOW FREQUENCY]" : "";
      return `- ${item.id} ${item.name}${frequency}: ${item.purpose}
  Use when: ${item.useWhen.join("; ")}
  Avoid: ${item.avoid.join("; ") || "none"}`;
    })
    .join("\n");

  const storylines = library.storylines
    .map(
      (item) =>
        `- ${item.id} ${item.name}: ${item.narrativeIntention} Storyline is narrative intention ONLY — never a fixed opening or paragraph template.`,
    )
    .join("\n");

  const angles = library.contentAngles
    .map((item) => `- ${item.id} ${item.name}: ${item.purpose} Use when: ${item.useWhen.join("; ")}`)
    .join("\n");

  const kspMap = Object.entries(library.compatibility.kspToStorylines)
    .map(([ksp, storylinesForKsp]) => `- ${ksp} → ${storylinesForKsp.join(", ")}`)
    .join("\n");
  const stMap = Object.entries(library.compatibility.storylineToAngles)
    .map(([storyline, angleIds]) => `- ${storyline} → ${angleIds.join(", ")}`)
    .join("\n");

  return `CONTENT STRATEGY LAYER (internal; never print KSP / Storyline / Content Angle / Search Keyword names in the consumer post)

This is a DECISION LAYER, not a writing template.
Customer evidence > photo evidence > brand context > compatibility matrix.
Do not force a KSP because it is a brand priority. Do not invent missing facts.

KSPs:
${ksps}

STORYLINES (narrative intention only; vary opening, paragraph order, emoji, and wording):
${storylines}

CONTENT ANGLES:
${angles}

Preferred KSP → Storyline (not deterministic):
${kspMap}

Preferred Storyline → Content Angle (not deterministic):
${stMap}

SEARCH KEYWORDS
Primary: ${library.searchKeywords.primary.join(" / ")}
Secondary: ${library.searchKeywords.secondary.join(" / ")}
Choose one natural keyword from the preferred mapping for this Storyline + Angle, guided by customer context.
Integrate it naturally into at least one title. Prefer different keywords across the 3 titles. Do not keyword-stuff the caption.
Do not use 必吃 / 最好吃 / 封神 / 顶级 / 曼谷第一 as a title hook.`;
}

export function formatStrategySelection(
  library: ContentStrategyLibrary,
  suggested: SelectedContentStrategy,
  evidence: StrategyEvidence,
  previous: {
    previousKspId?: string;
    previousStorylineId?: string;
    previousContentAngleId?: string;
    previousSearchKeyword?: string;
  },
) {
  const ksp = library.ksps.find((item) => item.id === suggested.kspId);
  const storyline = library.storylines.find((item) => item.id === suggested.storylineId);
  const angle = library.contentAngles.find((item) => item.id === suggested.contentAngleId);
  const signals = readStrategySignals(evidence);
  const evidenceLines = [
    `age range: ${evidence.dinerAgeRange || "Not provided"}`,
    `origin: ${evidence.dinerOrigin || "Not provided"}`,
    `gender: ${evidence.dinerGender || "Not provided"}`,
    `branch: ${evidence.branch || "Not provided"}`,
    `tourist/local: ${evidence.customerType || "Not provided"}`,
    `visit frequency: ${evidence.visitFrequency || "Not provided"}`,
    `recommended dishes: ${(evidence.recommendedDishes ?? []).filter(Boolean).join(", ") || "Not provided"}`,
    `liked aspects: ${(evidence.enjoyMost ?? []).join(", ") || "Not provided"}`,
    `taste words: ${(evidence.recommendTo ?? []).join(", ") || "Not provided"}`,
    `customer description: ${evidence.diningExperienceNote?.trim() || "Not provided"}`,
    `photo count: ${evidence.photoCount}`,
    `signals: tourist=${signals.tourist}; firstVisit=${signals.firstVisit}; confirmedRepeat=${signals.confirmedRepeat}; dishes=${signals.dishCount}; friends=${signals.friends}; family=${signals.family}; shopping=${signals.shopping}; travel=${signals.travel}`,
  ];

  return `INTERNAL STRATEGY SELECTION (do not print in titles, caption, hashtags, mainTitle, or subTitle)
Follow this process inside the SAME JSON response:
1. Understand customer evidence. Do not invent missing information.
2. Select KSP from evidence. Suggested: ${suggested.kspId} ${ksp?.name ?? ""} — ${ksp?.purpose ?? ""}
3. Select a compatible Storyline as narrative intention only. Suggested: ${suggested.storylineId} ${storyline?.name ?? ""} — ${storyline?.narrativeIntention ?? ""}
4. Select a Content Angle. Suggested: ${suggested.contentAngleId} ${angle?.name ?? ""}
5. Select a Search Keyword. Suggested: ${suggested.searchKeyword}
6. Generate titles, caption, hashtags, mainTitle, subTitle, photo selection.

If the suggestion conflicts with customer evidence, choose another supported combination from the library. Prefer not to reuse:
- previous KSP: ${previous.previousKspId || "none"}
- previous Storyline: ${previous.previousStorylineId || "none"}
- previous Content Angle: ${previous.previousContentAngleId || "none"}
- previous Search Keyword: ${previous.previousSearchKeyword || "none"}

Customer evidence:
${lineList(evidenceLines)}

Photo selection should support the selected Storyline / Angle.
${photoSelectionHint(suggested.contentAngleId)}

Hashtags: derive the 3 dynamic tags from the FINAL caption + actual customer evidence (dish, Thai cuisine, Bangkok dining, location, travel, shopping, dining context). Do NOT hard-code hashtags by Storyline.`;
}
