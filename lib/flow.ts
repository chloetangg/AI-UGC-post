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
  { key: "customer", label: "You" },
  { key: "experience", label: "Feel" },
  { key: "upload", label: "Photos" },
  { key: "result", label: "Post" },
  { key: "publish", label: "Share" },
] as const;
