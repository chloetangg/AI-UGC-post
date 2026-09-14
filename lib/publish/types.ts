export const PUBLISH_PLATFORMS = ["xiaohongshu", "dianping"] as const;

export type PublishPlatform = (typeof PUBLISH_PLATFORMS)[number];

export type PublishMethod = "deep_link" | "web_share" | "web_fallback";

export type PublishRuntime = "ios" | "android" | "desktop";

export type PublishPostData = {
  imageUrl: string;
  title: string;
  caption: string;
  hashtags: string[];
};

export type SharePostOutcome = "shared" | "cancelled" | "fallback" | "desktop";

export type SharePostResult = {
  outcome: SharePostOutcome;
  copied: boolean;
  filesPartial: boolean;
};

export type PublishAttemptOutcome =
  | "shared"
  | "cancelled"
  | "opened"
  | "failed"
  | "desktop"
  | "unsupported";

export type PublishAttemptResult = {
  platform?: PublishPlatform | "unknown";
  outcome: PublishAttemptOutcome;
  method?: PublishMethod;
  filesPartial: boolean;
};

export function isPublishPlatform(value: string): value is PublishPlatform {
  return (PUBLISH_PLATFORMS as readonly string[]).includes(value);
}

export function analyticsPlatformId(platform: PublishPlatform) {
  return platform;
}
