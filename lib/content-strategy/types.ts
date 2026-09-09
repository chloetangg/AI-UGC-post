export type StrategyFrequency = "normal" | "low";

export type KspDefinition = {
  id: string;
  name: string;
  purpose: string;
  useWhen: string[];
  avoid: string[];
  frequency?: StrategyFrequency;
};

export type StorylineDefinition = {
  id: string;
  name: string;
  narrativeIntention: string;
  avoid: string[];
};

export type ContentAngleDefinition = {
  id: string;
  name: string;
  purpose: string;
  useWhen: string[];
  avoid: string[];
};

export type SearchKeywordSet = {
  primary: string[];
  secondary: string[];
};

export type ContentStrategyCompatibility = {
  kspToStorylines: Record<string, string[]>;
  storylineToAngles: Record<string, string[]>;
  /** Key: `${storylineId}+${contentAngleId}` */
  storylineAngleToKeywords: Record<string, string[]>;
};

export type ContentStrategyLibrary = {
  ksps: KspDefinition[];
  storylines: StorylineDefinition[];
  contentAngles: ContentAngleDefinition[];
  searchKeywords: SearchKeywordSet;
  compatibility: ContentStrategyCompatibility;
};

export type SelectedContentStrategy = {
  kspId: string;
  storylineId: string;
  contentAngleId: string;
  searchKeyword: string;
};

export type StrategySelectionHistory = {
  previousKspId?: string;
  previousStorylineId?: string;
  previousContentAngleId?: string;
  previousSearchKeyword?: string;
  previousTitleKeywords?: string[];
};

export type StrategyEvidence = {
  customerType: string;
  visitFrequency: string;
  enjoyMost: string[];
  recommendedDishes: string[];
  recommendedDishOther?: string;
  recommendTo: string[];
  diningExperienceNote: string;
  branch: string;
  dinerOrigin?: string;
  dinerAgeRange?: string;
  dinerGender?: string;
  photoCount: number;
  variantIndex: number;
};
