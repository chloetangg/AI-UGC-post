import { recordAnalyticsEvent } from "@/lib/analytics/events";
import { readAnalyticsSession } from "@/lib/analytics/session";
import { ANALYTICS_CAMPAIGN, type AnalyticsEventType } from "@/lib/analytics/types";

export async function trackServerEvent(
  eventType: AnalyticsEventType,
  metadata: Record<string, string> = {},
) {
  try {
    const session = await readAnalyticsSession();
    if (!session.sessionId) return;
    await recordAnalyticsEvent({
      eventType,
      sessionId: session.sessionId,
      qrCodeId: session.qrCodeId,
      campaign: ANALYTICS_CAMPAIGN,
      metadata,
    });
  } catch (error) {
    console.error("[analytics] track failed");
    const detail = error instanceof Error ? error.message : "";
    if (detail) console.error("[analytics]", detail);
  }
}
