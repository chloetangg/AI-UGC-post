import { NextResponse, type NextRequest } from "next/server";
import {
  ANALYTICS_SESSION_COOKIE,
  analyticsCookieOptions,
  newAnalyticsSessionId,
} from "@/lib/analytics/cookie";
import { ANALYTICS_SESSION_HEADER } from "@/lib/analytics/types";

export function middleware(request: NextRequest) {
  const existing = request.cookies.get(ANALYTICS_SESSION_COOKIE)?.value?.trim();
  const sessionId = existing || newAnalyticsSessionId();
  const headers = new Headers(request.headers);
  headers.set(ANALYTICS_SESSION_HEADER, sessionId);
  const response = NextResponse.next({ request: { headers } });
  if (!existing) {
    const secure = request.nextUrl.protocol === "https:";
    response.cookies.set(ANALYTICS_SESSION_COOKIE, sessionId, analyticsCookieOptions(secure));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
