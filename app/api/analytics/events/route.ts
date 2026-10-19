import { NextResponse } from "next/server";
import { recordAnalyticsEvent } from "@/lib/analytics/events";
import { isFunnelEventType, recordFunnelEvent } from "@/lib/analytics/funnel";
import { readAnalyticsSession } from "@/lib/analytics/session";
import {
  ANALYTICS_QR_COOKIE,
  ANALYTICS_SESSION_COOKIE,
  analyticsCookieOptions,
  newAnalyticsSessionId,
  sanitizeQrCodeId,
} from "@/lib/analytics/cookie";
import {
  ANALYTICS_CAMPAIGN,
  ANALYTICS_EVENT_TYPES,
  sanitizeEventMetadata,
  type AnalyticsEventType,
} from "@/lib/analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asEventType(value: unknown): AnalyticsEventType | "" {
  return ANALYTICS_EVENT_TYPES.includes(value as AnalyticsEventType)
    ? (value as AnalyticsEventType)
    : "";
}

export async function POST(request: Request) {
  let funnel = false;
  try {
    const rawBody = await request.text();
    const body = (rawBody ? JSON.parse(rawBody) : {}) as Record<string, unknown>;
    const eventType = asEventType(body.eventType);
    if (!eventType) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    funnel = isFunnelEventType(eventType);
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
    let response: NextResponse;
    if (isFunnelEventType(eventType)) {
      const result = await recordFunnelEvent(eventType, body.metadata, { sessionId, qrCodeId });
      response = result.ok
        ? NextResponse.json({ ok: true, duplicate: result.duplicate })
        : NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    } else {
      await recordAnalyticsEvent({
        eventType,
        eventId: typeof body.eventId === "string" ? body.eventId : undefined,
        sessionId,
        qrCodeId,
        campaign: ANALYTICS_CAMPAIGN,
        metadata: sanitizeEventMetadata(body.metadata),
      });
      response = NextResponse.json({ ok: true });
    }
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
    if (funnel) {
      return NextResponse.json({ ok: false, error: "Could not save. Please try again." }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  }
}
