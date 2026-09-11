import type { AnalyticsDeviceType } from "@/lib/analytics/types";

export function deviceTypeFromUserAgent(userAgent: string): AnalyticsDeviceType {
  const ua = userAgent || "";
  if (/iPad|Tablet|PlayBook/i.test(ua)) return "tablet";
  if (/Mobile|Android|iPhone|iPod|webOS|BlackBerry/i.test(ua)) return "mobile";
  return "desktop";
}
