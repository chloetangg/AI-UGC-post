import { getDeploymentConfig, type DeploymentLocationId } from "@/lib/deployment/config";

export type MallText = {
  /** The exact English name post-processing compares against. */
  name: string;
  /** Regex source for any spacing of the English name. */
  spaced: string;
  /** Official Chinese mall name. */
  chinese: string;
  /** Chinese form a customer types without 购物中心. */
  chineseStem: string;
  /** Two-character Chinese prefix that loosely signals the mall. */
  chineseShort: string;
};

const MALL_TEXT: Record<DeploymentLocationId, MallText> = {
  centralworld: {
    name: "centralwOrld",
    spaced: "central\\s*world",
    chinese: "尚泰世界购物中心",
    chineseStem: "尚泰世界",
    chineseShort: "尚泰",
  },
  siam: {
    name: "Siam Center",
    spaced: "siam\\s*center",
    chinese: "暹罗中心",
    chineseStem: "暹罗中心",
    chineseShort: "暹罗",
  },
};

/**
 * Mall words for one branch. Every caption, title, and cover rule reads its mall from here,
 * so each deployment runs the same rule with its own mall.
 */
export function mallText(branch?: string): MallText {
  const value = branch ?? "";
  if (/siam\s*center|暹罗中心/i.test(value)) return MALL_TEXT.siam;
  if (/central\s*world|尚泰世界/i.test(value)) return MALL_TEXT.centralworld;
  return MALL_TEXT[getDeploymentConfig().locationId];
}
