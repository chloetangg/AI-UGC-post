import { currentDeviceType } from "@/lib/analytics/device";
import { trackAnalyticsEvent } from "@/lib/analytics/track-client";
import { DIANPING_SHOP_UUID, openDianpingShop } from "@/lib/publish/dianping-shop";

function dianpingMetadata(generationId = "") {
  return {
    platform: "dianping",
    brandId: "baan-ying",
    generationId: generationId.slice(0, 180),
    deviceType: currentDeviceType(),
    shopId: DIANPING_SHOP_UUID,
    timestamp: new Date().toISOString(),
  };
}

export async function openTrackedDianpingShop(generationId = "") {
  const metadata = dianpingMetadata(generationId);
  await trackAnalyticsEvent({
    eventType: "publish_dianping_click",
    metadata,
  });
  void trackAnalyticsEvent({
    eventType: "dianping_open_attempt",
    metadata,
  });
  const result = await openDianpingShop();
  if (result === "fallback") {
    trackAnalyticsEvent({
      eventType: "dianping_fallback",
      metadata,
    });
  }
  return result;
}
