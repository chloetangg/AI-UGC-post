import { cookies, headers } from "next/headers";
import { sanitizeQrCodeId } from "@/lib/analytics/cookie";
import {
  ANALYTICS_QR_COOKIE,
  ANALYTICS_SESSION_COOKIE,
  ANALYTICS_SESSION_HEADER,
} from "@/lib/analytics/types";

export async function readAnalyticsSession() {
  const jar = await cookies();
  const headerStore = await headers();
  const sessionId =
    jar.get(ANALYTICS_SESSION_COOKIE)?.value?.trim() ||
    headerStore.get(ANALYTICS_SESSION_HEADER)?.trim() ||
    "";
  const qrCodeId = sanitizeQrCodeId(jar.get(ANALYTICS_QR_COOKIE)?.value || "");
  return {
    sessionId,
    qrCodeId: qrCodeId || "",
  };
}
