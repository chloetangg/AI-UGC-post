import { createId } from "@/lib/id";
import type { AnalyticsEventType } from "@/lib/analytics/types";

const CLIENT_SESSION_KEY = "ugc_analytics_sid";

export function clientAnalyticsSessionId() {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.sessionStorage.getItem(CLIENT_SESSION_KEY)?.trim();
    if (existing) return existing.slice(0, 80);
    const id = createId();
    window.sessionStorage.setItem(CLIENT_SESSION_KEY, id);
    return id;
  } catch {
    return "";
  }
}

export function trackAnalyticsEvent(input: {
  eventType: AnalyticsEventType;
  eventId?: string;
  qrCodeId?: string;
  sessionId?: string;
  metadata?: Record<string, string>;
}) {
  const payload = JSON.stringify({
    ...input,
    sessionId: input.sessionId?.trim() || clientAnalyticsSessionId(),
  });

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/analytics/events", new Blob([payload], { type: "application/json" }));
    }
  } catch {
    /* Beacon is best-effort; fetch below is the fallback. */
  }

  try {
    return fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      credentials: "same-origin",
      keepalive: true,
    }).then(() => undefined).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
}
