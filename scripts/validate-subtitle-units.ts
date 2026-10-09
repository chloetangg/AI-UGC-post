import { layoutCoverOverlay } from "../lib/cover/cover-title";
import {
  finalValidateCoverSubtitle,
  parseReviewIntoEvaluationUnits,
  selectOneValidSubtitle,
  validateSubtitleCandidate,
} from "../lib/cover/subtitle-units";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function oneOf(actual: string, allowed: string[], label: string) {
  assert(allowed.includes(actual), `${label}: got ${actual}`);
}

const case1 = "食物很好吃粉红奶很好喝";
const case1Units = parseReviewIntoEvaluationUnits(case1);
assert(case1Units.includes("食物很好吃") && case1Units.includes("粉红奶很好喝"), `case1 split ${case1Units.join("|")}`);
assert(!finalValidateCoverSubtitle(case1, case1).ok, "case1 glued line must be invalid");
oneOf(
  selectOneValidSubtitle({ note: case1, preferred: case1 }),
  ["食物很好吃", "粉红奶很好喝", "粉红奶真的很好喝", "食物真的很好吃"],
  "case1",
);
assert(validateSubtitleCandidate("物很好吃粉红奶很好喝", case1).ok === false, "case1 clipped line");
assert(validateSubtitleCandidate("食物很好吃粉红奶", case1).ok === false, "case1 cut ending");

const case2 = "很好吃很喜欢想再回来吃店员服务很好";
const case2Pick = selectOneValidSubtitle({ note: case2, preferred: "很好吃很喜欢想再回来吃" });
assert(finalValidateCoverSubtitle("很好吃很喜欢想再回来吃", case2).ok === false, "case2 glue A");
assert(finalValidateCoverSubtitle("很好吃店员服务很好", case2).ok === false, "case2 glue B");
assert(parseReviewIntoEvaluationUnits(case2Pick).length === 1, `case2 must be one unit, got ${case2Pick}`);
assert(!case2Pick.includes("很好吃很喜欢"), `case2 still glued ${case2Pick}`);

const case3 = "冬阴功很好喝芒果糯米饭也很好吃";
oneOf(
  selectOneValidSubtitle({ note: case3, preferred: case3 }),
  ["冬阴功很好喝", "芒果糯米饭也很好吃"],
  "case3",
);
assert(!finalValidateCoverSubtitle(case3, case3).ok, "case3 glued");

const case4 = "环境很舒服服务也很好";
oneOf(selectOneValidSubtitle({ note: case4, preferred: case4 }), ["环境很舒服", "服务也很好"], "case4");
assert(!finalValidateCoverSubtitle(case4, case4).ok, "case4 glued");

const case5 = "食物很好吃送的泰奶也好喝";
oneOf(
  selectOneValidSubtitle({ note: case5, preferred: case5 }),
  ["食物很好吃", "送的泰奶也好喝", "食物真的很好吃"],
  "case5",
);
assert(!finalValidateCoverSubtitle(case5, case5).ok, "case5 glued");

const case6 = selectOneValidSubtitle({ note: case1, preferred: "物很好吃粉红奶很好喝" });
assert(case6 !== "物很好吃粉红奶很好喝", "case6 must not keep a clipped subtitle");
assert(case6 !== "食物很好吃粉红奶", "case6 must not keep a cut subtitle");
assert(case6 !== case1, "case6 must not keep the glued subtitle");
const overlay = layoutCoverOverlay("曼谷泰餐推荐", case1, [], { diningNote: case1 });
assert(overlay.subtitle !== case1, `layout kept glued subtitle ${overlay.subtitle}`);
assert(!overlay.subtitle.startsWith("物"), `layout clipped the first character ${overlay.subtitle}`);

const central = selectOneValidSubtitle({ note: "老板娘长得很漂亮" });
const siam = selectOneValidSubtitle({ note: "粉红奶很好喝" });
assert(!siam.includes("老板娘"), `siam subtitle leaked central review: ${siam}`);
assert(!central.includes("粉红奶"), `central subtitle leaked siam review: ${central}`);
assert(case1 === "食物很好吃粉红奶很好喝", "parser must not rewrite the source string");

console.log("subtitle units OK");
console.log({ case1: selectOneValidSubtitle({ note: case1 }), case2: case2Pick, case4: selectOneValidSubtitle({ note: case4 }), case6, central, siam });
