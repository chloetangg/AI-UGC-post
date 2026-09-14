import type { PublishPlatform } from "@/lib/publish/types";

export { PUBLISH_PLATFORMS, isPublishPlatform, type PublishPlatform } from "@/lib/publish/types";

export const PUBLISH_PLATFORM_CONFIG: Record<
  PublishPlatform,
  {
    id: PublishPlatform;
    analyticsPlatform: "xiaohongshu" | "dianping";
    canPassImagesViaShare: true;
    hasPublishDeepLink: boolean;
  }
> = {
  xiaohongshu: {
    id: "xiaohongshu",
    analyticsPlatform: "xiaohongshu",
    canPassImagesViaShare: true,
    hasPublishDeepLink: true,
  },
  dianping: {
    id: "dianping",
    analyticsPlatform: "dianping",
    canPassImagesViaShare: true,
    hasPublishDeepLink: false,
  },
};
