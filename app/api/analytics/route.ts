import { NextResponse } from "next/server";
import { queryAnalyticsReport } from "@/lib/analytics/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const report = await queryAnalyticsReport({
      range: url.searchParams.get("range") ?? "last_7_days",
      startDate: url.searchParams.get("startDate") ?? "",
      endDate: url.searchParams.get("endDate") ?? "",
      qrCodeId: url.searchParams.get("qrCodeId") ?? "",
      branchId: url.searchParams.get("branch") ?? "",
    });
    return NextResponse.json(report);
  } catch (error) {
    console.error("[analytics] query failed");
    const detail = error instanceof Error ? error.message : "";
    if (detail) console.error("[analytics]", detail);
    if (detail === "Unknown branch") {
      return NextResponse.json({ error: "Unknown branch" }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not load analytics" }, { status: 500 });
  }
}
