"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyticsRange, AnalyticsReport } from "@/lib/analytics/types";

const RANGES: Array<{ id: AnalyticsRange; label: string }> = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last_7_days", label: "Last 7 Days" },
  { id: "last_30_days", label: "Last 30 Days" },
  { id: "this_month", label: "This Month" },
  { id: "all", label: "All Time" },
];

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRate(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function AnalyticsDashboardPage() {
  const [range, setRange] = useState<AnalyticsRange>("last_7_days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate || endDate) {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    } else {
      params.set("range", range);
    }
    return params.toString();
  }, [endDate, range, startDate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void (async () => {
      try {
        const response = await fetch(`/api/analytics?${query}`);
        const data = (await response.json()) as AnalyticsReport & { error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load analytics");
        if (!cancelled) setReport(data);
      } catch (caught) {
        if (!cancelled) {
          setReport(null);
          setError(caught instanceof Error ? caught.message : "Could not load analytics");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const summary = report?.summary;
  const conversion = report?.conversion;

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,#e8f3ec_0%,#f5f8f5_38%,#eef4ef_100%)] px-5 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <p className="text-sm font-medium text-primary">Baan Ying UGC</p>
          <h1 className="font-display text-3xl text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            QR scans, form submissions, generations, and XHS publish clicks. Dates use Asia/Bangkok.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${
                !startDate && !endDate && range === item.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground ring-1 ring-border"
              }`}
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setRange(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Start
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="mt-1 block rounded-md border border-input bg-card px-3 py-2"
            />
          </label>
          <label className="text-sm">
            End
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="mt-1 block rounded-md border border-input bg-card px-3 py-2"
            />
          </label>
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {summary && conversion ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="QR Scans" value={formatCount(summary.qrScans)} />
              <Metric label="Unique Visitors" value={formatCount(summary.uniqueVisitors)} />
              <Metric label="Form Submissions" value={formatCount(summary.formSubmissions)} />
              <Metric label="Generation Completed" value={formatCount(summary.generations)} />
              <Metric label="XHS Publish Clicks" value={formatCount(summary.xhsPublishClicks)} />
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="QR → Form" value={formatRate(conversion.qrToForm)} />
              <Metric label="Form → Generation" value={formatRate(conversion.formToGeneration)} />
              <Metric label="Generation → XHS Click" value={formatRate(conversion.generationToXhs)} />
              <Metric label="QR → XHS Click" value={formatRate(conversion.qrToXhs)} />
            </section>

            <section className="overflow-x-auto rounded-2xl bg-card p-4 ring-1 ring-border/70">
              <h2 className="mb-3 text-base font-semibold">Daily</h2>
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">QR Scans</th>
                    <th className="pb-2 font-medium">Forms</th>
                    <th className="pb-2 font-medium">Generations</th>
                    <th className="pb-2 font-medium">XHS Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.daily.length ? report.daily : [{ date: "—", qrScans: 0, formSubmissions: 0, generations: 0, xhsPublishClicks: 0 }]).map((row) => (
                    <tr key={row.date} className="border-t border-border/60">
                      <td className="py-2">{row.date}</td>
                      <td>{formatCount(row.qrScans)}</td>
                      <td>{formatCount(row.formSubmissions)}</td>
                      <td>{formatCount(row.generations)}</td>
                      <td>{formatCount(row.xhsPublishClicks)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="overflow-x-auto rounded-2xl bg-card p-4 ring-1 ring-border/70">
              <h2 className="mb-3 text-base font-semibold">QR Code</h2>
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-2 font-medium">QR Code</th>
                    <th className="pb-2 font-medium">Scans</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.byQrCode.length ? report.byQrCode : [{ qrCodeId: "—", scans: 0 }]).map((row) => (
                    <tr key={row.qrCodeId} className="border-t border-border/60">
                      <td className="py-2">{row.qrCodeId}</td>
                      <td>{formatCount(row.scans)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border/70">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
