import { NextResponse } from "next/server";
import { recordAnalyticsEvent } from "@/lib/analytics/events";
import { readAnalyticsSession } from "@/lib/analytics/session";
import {
  ANALYTICS_QR_COOKIE,
  analyticsCookieOptions,
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
    const body = (await request.json()) as Record<string, unknown>;
    const eventType = asEventType(body.eventType);
    if (!eventType) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const session = await readAnalyticsSession();
    if (!session.sessionId) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const qrCodeId =
      typeof body.qrCodeId === "string" && body.qrCodeId.trim()
        ? sanitizeQrCodeId(body.qrCodeId)
        : session.qrCodeId;
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
      sessionId: session.sessionId,
      qrCodeId,
      campaign: ANALYTICS_CAMPAIGN,
      metadata,
    });
    const response = NextResponse.json({ ok: true });
    if (eventType === "qr_scan" && qrCodeId) {
      const secure = new URL(request.url).protocol === "https:";
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
