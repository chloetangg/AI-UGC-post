import { cookies } from "next/headers";
import { recordAnalyticsEvent } from "@/lib/analytics/events";
import { readAnalyticsSession } from "@/lib/analytics/session";
import {
  ANALYTICS_SESSION_COOKIE,
  analyticsCookieOptions,
  newAnalyticsSessionId,
} from "@/lib/analytics/cookie";
import { ANALYTICS_CAMPAIGN, type AnalyticsEventType } from "@/lib/analytics/types";

function sanitizeSessionId(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

export async function resolveAnalyticsSession(explicitSessionId = "") {
  const session = await readAnalyticsSession();
  const sessionId =
    session.sessionId ||
    sanitizeSessionId(explicitSessionId) ||
    newAnalyticsSessionId();
  if (!session.sessionId) {
    try {
      const jar = await cookies();
      const secure = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
      jar.set(ANALYTICS_SESSION_COOKIE, sessionId, analyticsCookieOptions(secure));
    } catch {
      /* Cookie write is optional; the event still records. */
    }
  }
  return {
    sessionId,
    qrCodeId: session.qrCodeId,
  };
}

export async function trackServerEvent(
  eventType: AnalyticsEventType,
  metadata: Record<string, string> = {},
  explicitSessionId = "",
) {
  try {
    const session = await resolveAnalyticsSession(explicitSessionId);
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
