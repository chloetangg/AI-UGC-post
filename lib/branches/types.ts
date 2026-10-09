export type BranchConfig = {
  id: string;
  brandId: string;
  name: string;
  locationId: "centralworld" | "siam" | "terminal21" | "onebangkok";
  /** Legacy survey label still stored on submissions. */
  surveyValue: string;
  mallSpellings: readonly string[];
  /** Matches this branch's English mall only. */
  mallPattern: RegExp;
  hashtags: readonly string[];
  /** Dianping shop UUID for this branch. Empty when no official shop page exists. */
  dianpingShopId: string;
};
