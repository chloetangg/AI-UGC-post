import { clientAnalyticsSessionId } from "@/lib/analytics/track-client";

const FUNNEL_TIMEOUT_MS = 10_000;

/**
 * Sends `rating_submitted`, `form_submit` or `generate` and reports whether MongoDB has the row.
 * Unlike trackAnalyticsEvent there is no beacon fallback: a beacon cannot say whether the write happened.
 * A duplicate (same round or click sent again) counts as saved.
 */
export async function sendFunnelEvent(input: {
  eventType: "rating_submitted" | "form_submit" | "generate";
  metadata: Record<string, string>;
}): Promise<boolean> {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FUNNEL_TIMEOUT_MS) : null;
  try {
    const response = await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, sessionId: clientAnalyticsSessionId() }),
      credentials: "same-origin",
      keepalive: true,
      signal: controller?.signal,
    });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean };
    return response.ok && body.ok === true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
