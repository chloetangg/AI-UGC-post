export const FLOW_STEPS = [
  "landing",
  "customer",
  "experience",
  "upload",
  "generating",
  "result",
  "publish",
] as const;

export type FlowStep = (typeof FLOW_STEPS)[number];

export const STEP_PATHS: Record<FlowStep, string> = {
  landing: "",
  customer: "customer",
  experience: "experience",
  upload: "upload",
  generating: "generating",
  result: "result",
  publish: "publish",
};

export function campaignPath(campaignId: string, step: FlowStep = "landing") {
  const suffix = STEP_PATHS[step];
  return suffix ? `/c/${campaignId}/${suffix}` : `/c/${campaignId}`;
}

export const PROGRESS_STEPS = [
  { key: "you", steps: ["customer"] },
  { key: "rate", steps: ["experience", "upload", "generating", "result"] },
  { key: "share", steps: ["publish"] },
] as const;

export type ProgressStepKey = (typeof PROGRESS_STEPS)[number]["key"];

export function progressIndexForStep(step: FlowStep) {
  return PROGRESS_STEPS.findIndex((item) =>
    (item.steps as readonly string[]).includes(step),
  );
}

export const NEXT_FLOW_STEP: Partial<Record<FlowStep, FlowStep>> = {
  customer: "experience",
  experience: "generating",
  upload: "generating",
  generating: "result",
  result: "publish",
};
