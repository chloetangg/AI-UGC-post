import { createId } from "@/lib/id";
import { getDeploymentConfig, isCurrentDeploymentRef } from "@/lib/deployment/config";

export { ANALYTICS_QR_COOKIE, ANALYTICS_SESSION_COOKIE } from "@/lib/analytics/types";

export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function analyticsCookieOptions(secure: boolean) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
    secure,
  };
}

export function sanitizeQrCodeId(raw: string) {
  const id = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 64);
  return id || "baan-ying";
}

export function campaignIdFromQrCode(qrCodeId: string) {
  const deployment = getDeploymentConfig();
  const id = sanitizeQrCodeId(qrCodeId);
  if (isCurrentDeploymentRef(id)) return deployment.campaignId;
  return deployment.campaignId;
}

export function newAnalyticsSessionId() {
  return createId();
}
