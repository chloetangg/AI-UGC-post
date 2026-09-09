import { BAAN_YING_CONTENT_STRATEGY } from "../lib/brand/baan-ying-strategy";
import { pickSuggestedStrategy } from "../lib/content-strategy/select";
import type { StrategyEvidence } from "../lib/content-strategy/types";

const base: StrategyEvidence = {
  customerType: "",
  visitFrequency: "",
  enjoyMost: [],
  recommendedDishes: [],
  recommendTo: [],
  diningExperienceNote: "",
  branch: "",
  photoCount: 3,
  variantIndex: 0,
};

const scenarios: Array<{ name: string; input: StrategyEvidence; expect: Partial<{ ksp: string[]; storyline: string[]; angle: string[] }> }> = [
  {
    name: "A first-time tourist",
    input: {
      ...base,
      customerType: "Tourist",
      visitFrequency: "1st time",
      branch: "Baan Ying (centralwOrld, 3rd Floor)",
      enjoyMost: ["The food"],
    },
    expect: { ksp: ["KSP-01", "KSP-09"], storyline: ["ST-01", "ST-07"], angle: ["CA-01", "CA-04"] },
  },
  {
    name: "B hero dish",
    input: {
      ...base,
      customerType: "Local",
      visitFrequency: "Not first time",
      recommendedDishes: ["Yellow Curry Crab Meat"],
      recommendTo: ["Delicious", "Flavorful"],
      diningExperienceNote: "黄咖喱蟹肉真的很好吃，味道很香",
    },
    expect: { ksp: ["KSP-04"], storyline: ["ST-02", "ST-08"], angle: ["CA-02", "CA-03"] },
  },
  {
    name: "C friends dining",
    input: {
      ...base,
      customerType: "Local",
      visitFrequency: "Not first time",
      diningExperienceNote: "和朋友一起吃饭，点了很多菜一起分享",
      enjoyMost: ["The variety of dishes"],
    },
    expect: { ksp: ["KSP-05"], storyline: ["ST-05"], angle: ["CA-07"] },
  },
  {
    name: "D shopping/travel",
    input: {
      ...base,
      customerType: "Tourist",
      visitFrequency: "1st time",
      branch: "Baan Ying (Siam Center, 2nd Floor)",
      diningExperienceNote: "逛完商场后来吃饭，旅行行程刚刚好",
    },
    expect: { ksp: ["KSP-06"], storyline: ["ST-04", "ST-10"], angle: ["CA-09", "CA-04", "CA-10"] },
  },
  {
    name: "E repeat customer",
    input: {
      ...base,
      customerType: "Local",
      visitFrequency: "Not first time",
      diningExperienceNote: "每次来还是会点熟悉的几道菜",
    },
    expect: { ksp: ["KSP-10"], storyline: ["ST-06"], angle: ["CA-06"] },
  },
  {
    name: "F ordinary lunch",
    input: {
      ...base,
      customerType: "Local",
      visitFrequency: "Not first time",
      diningExperienceNote: "中午随便吃了一顿，气氛很轻松",
      enjoyMost: ["The overall experience"],
    },
    expect: { ksp: ["KSP-08", "KSP-02"], storyline: ["ST-09", "ST-03"], angle: ["CA-11", "CA-03"] },
  },
];

let failed = 0;
for (const scenario of scenarios) {
  const picked = pickSuggestedStrategy(BAAN_YING_CONTENT_STRATEGY, scenario.input);
  const okKsp = !scenario.expect.ksp || scenario.expect.ksp.includes(picked.kspId);
  const okStory = !scenario.expect.storyline || scenario.expect.storyline.includes(picked.storylineId);
  const okAngle = !scenario.expect.angle || scenario.expect.angle.includes(picked.contentAngleId);
  const ok = okKsp && okStory && okAngle;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "OK" : "FAIL"} ${scenario.name}: ${picked.kspId} → ${picked.storylineId} → ${picked.contentAngleId} → ${picked.searchKeyword}`,
  );
}

if (failed > 0) {
  process.exitCode = 1;
}
