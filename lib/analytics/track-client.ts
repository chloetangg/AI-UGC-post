import type { AnalyticsEventType } from "@/lib/analytics/types";

export function trackAnalyticsEvent(input: {
  eventType: AnalyticsEventType;
  eventId?: string;
  qrCodeId?: string;
  metadata?: Record<string, string>;
}) {
  try {
    void fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Analytics must never block publishing. */
  }
}
