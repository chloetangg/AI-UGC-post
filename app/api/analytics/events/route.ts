import { NextResponse } from "next/server";
import { recordAnalyticsEvent } from "@/lib/analytics/events";
import { readAnalyticsSession } from "@/lib/analytics/session";
import {
  ANALYTICS_QR_COOKIE,
  ANALYTICS_SESSION_COOKIE,
  analyticsCookieOptions,
  newAnalyticsSessionId,
  sanitizeQrCodeId,
} from "@/lib/analytics/cookie";
import { ANALYTICS_CAMPAIGN, ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from "@/lib/analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asEventType(value: unknown): AnalyticsEventType | "" {
  return ANALYTICS_EVENT_TYPES.includes(value as AnalyticsEventType)
    ? (value as AnalyticsEventType)
    : "";
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const body = (rawBody ? JSON.parse(rawBody) : {}) as Record<string, unknown>;
    const eventType = asEventType(body.eventType);
    if (!eventType) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const session = await readAnalyticsSession();
    const fromBody =
      typeof body.sessionId === "string"
        ? body.sessionId.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)
        : "";
    const sessionId = session.sessionId || fromBody || newAnalyticsSessionId();
    const qrCodeId = sanitizeQrCodeId(
      typeof body.qrCodeId === "string" && body.qrCodeId.trim()
        ? body.qrCodeId
        : session.qrCodeId,
    );
    const metadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? Object.fromEntries(
            Object.entries(body.metadata as Record<string, unknown>)
              .filter(([, value]) => typeof value === "string")
              .map(([key, value]) => [key, String(value).slice(0, 180)]),
          )
        : {};
    await recordAnalyticsEvent({
      eventType,
      eventId: typeof body.eventId === "string" ? body.eventId : undefined,
      sessionId,
      qrCodeId,
      campaign: ANALYTICS_CAMPAIGN,
      metadata,
    });
    const response = NextResponse.json({ ok: true });
    const secure = new URL(request.url).protocol === "https:";
    if (!session.sessionId) {
      response.cookies.set(ANALYTICS_SESSION_COOKIE, sessionId, analyticsCookieOptions(secure));
    }
    if (eventType === "qr_scan" && qrCodeId) {
      response.cookies.set(ANALYTICS_QR_COOKIE, qrCodeId, analyticsCookieOptions(secure));
    }
    return response;
  } catch (error) {
    console.error("[analytics] client event failed");
    const detail = error instanceof Error ? error.message : "";
    if (detail) console.error("[analytics]", detail);
    return NextResponse.json({ ok: true });
  }
}
