import { NextResponse, type NextRequest } from "next/server";
import { deviceTypeFromUserAgent } from "@/lib/analytics/device";
import { recordAnalyticsEvent } from "@/lib/analytics/events";
import {
  ANALYTICS_QR_COOKIE,
  ANALYTICS_SESSION_COOKIE,
  analyticsCookieOptions,
  campaignIdFromQrCode,
  newAnalyticsSessionId,
  sanitizeQrCodeId,
} from "@/lib/analytics/cookie";
import { ANALYTICS_CAMPAIGN, ANALYTICS_SESSION_HEADER } from "@/lib/analytics/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ qrCodeId: string }> },
) {
  const { qrCodeId: rawId } = await context.params;
  const qrCodeId = sanitizeQrCodeId(rawId);
  const campaignId = campaignIdFromQrCode(qrCodeId);
  const sessionId =
    request.headers.get(ANALYTICS_SESSION_HEADER)?.trim() ||
    request.cookies.get(ANALYTICS_SESSION_COOKIE)?.value?.trim() ||
    newAnalyticsSessionId();
  const secure = request.nextUrl.protocol === "https:";
  const userAgent = request.headers.get("user-agent") ?? "";

  try {
    await recordAnalyticsEvent({
      eventType: "qr_scan",
      sessionId,
      qrCodeId,
      campaign: ANALYTICS_CAMPAIGN,
      metadata: {
        userAgent: userAgent.slice(0, 180),
        deviceType: deviceTypeFromUserAgent(userAgent),
        source: "qr",
      },
    });
  } catch {
    /* Tracking must not block the redirect. */
  }

  const destination = request.nextUrl.clone();
  destination.pathname = `/c/${campaignId}/customer`;
  destination.search = "";
  destination.hash = "";
  const response = NextResponse.redirect(destination, 302);
  if (!request.cookies.get(ANALYTICS_SESSION_COOKIE)?.value?.trim()) {
    response.cookies.set(ANALYTICS_SESSION_COOKIE, sessionId, analyticsCookieOptions(secure));
  }
  response.cookies.set(ANALYTICS_QR_COOKIE, qrCodeId, analyticsCookieOptions(secure));
  return response;
}
