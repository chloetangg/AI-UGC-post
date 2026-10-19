"use client";

import { useEffect, useMemo, useState } from "react";
import { getDeploymentConfig } from "@/lib/deployment/config";
import { DASHBOARD_BRANCHES } from "@/lib/deployment/databases";
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
  const [branchId, setBranchId] = useState(() => getDeploymentConfig().branchId);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lowStars, setLowStars] = useState<"" | "1" | "2">("");
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("branch", branchId);
    if (startDate || endDate) {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    } else {
      params.set("range", range);
    }
    if (lowStars) params.set("stars", lowStars);
    return params.toString();
  }, [branchId, endDate, lowStars, range, startDate]);

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
    <div className="flex min-h-full flex-1 flex-col px-5 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <p className="text-sm font-medium text-primary">Baan Ying UGC</p>
          <h1 className="font-display text-3xl text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            QR scans, ratings, form submissions, Generate clicks, completed generations, Rednote and Dianping
            publish clicks. Dates use Asia/Bangkok. Each branch is stored in its own database.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {DASHBOARD_BRANCHES.map((branch) => (
            <button
              key={branch.id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm ${
                branchId === branch.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground ring-1 ring-border"
              }`}
              onClick={() => setBranchId(branch.id)}
            >
              {branch.name}
            </button>
          ))}
        </div>

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
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="QR Scans" value={formatCount(summary.qrScans)} />
              <Metric label="Unique Visitors" value={formatCount(summary.uniqueVisitors)} />
              <Metric
                label="Rating Submitted"
                value={formatCount(summary.ratingSubmissions)}
                note={`${formatCount(summary.lowRatings)} at 1–2 stars`}
              />
              <Metric
                label="Form Submissions"
                value={formatCount(summary.formSubmissions)}
                note="3–5 stars, Continue to review"
              />
              <Metric label="Generate" value={formatCount(summary.generateActions)} note="Generate + Regenerate + Retry clicks" />
              <Metric label="Generation Completed" value={formatCount(summary.generations)} />
              <Metric label="XHS Publish Clicks" value={formatCount(summary.xhsPublishClicks)} />
              <Metric label="Dianping Publish Clicks" value={formatCount(summary.dianpingPublishClicks)} />
            </section>
            {summary.legacyFormSubmissions > 0 ? (
              <p className="text-xs text-muted-foreground">
                {formatCount(summary.legacyFormSubmissions)} older form submissions in this range were recorded once per
                generation request (before 2026-10-19). They are not included in Form Submissions or Generate.
              </p>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="QR → Rating" value={formatRate(conversion.qrToRating)} />
              <Metric label="QR → Form" value={formatRate(conversion.qrToForm)} />
              <Metric label="Form → Generate" value={formatRate(conversion.formToGenerate)} />
              <Metric label="Generate → Completed" value={formatRate(conversion.generateToComplete)} />
              <Metric label="Generation → XHS Click" value={formatRate(conversion.generationToXhs)} />
              <Metric label="QR → XHS Click" value={formatRate(conversion.qrToXhs)} />
            </section>

            <section className="overflow-x-auto rounded-2xl bg-card p-4 ring-1 ring-border/70">
              <h2 className="mb-3 text-base font-semibold">Daily</h2>
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">QR Scans</th>
                    <th className="pb-2 font-medium">Ratings</th>
                    <th className="pb-2 font-medium">Forms</th>
                    <th className="pb-2 font-medium">Generate</th>
                    <th className="pb-2 font-medium">Completed</th>
                    <th className="pb-2 font-medium">XHS Clicks</th>
                    <th className="pb-2 font-medium">Dianping Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {(report.daily.length
                    ? report.daily
                    : [
                        {
                          date: "—",
                          qrScans: 0,
                          ratingSubmissions: 0,
                          formSubmissions: 0,
                          generateActions: 0,
                          generations: 0,
                          xhsPublishClicks: 0,
                          dianpingPublishClicks: 0,
                        },
                      ]
                  ).map((row) => (
                    <tr key={row.date} className="border-t border-border/60">
                      <td className="py-2">{row.date}</td>
                      <td>{formatCount(row.qrScans)}</td>
                      <td>{formatCount(row.ratingSubmissions)}</td>
                      <td>{formatCount(row.formSubmissions)}</td>
                      <td>{formatCount(row.generateActions)}</td>
                      <td>{formatCount(row.generations)}</td>
                      <td>{formatCount(row.xhsPublishClicks)}</td>
                      <td>{formatCount(row.dianpingPublishClicks)}</td>
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

            <section className="overflow-x-auto rounded-2xl bg-card p-4 ring-1 ring-border/70">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="mr-2 text-base font-semibold">Low-rating feedback</h2>
                {(
                  [
                    { id: "", label: "1–2 stars" },
                    { id: "1", label: "1 star" },
                    { id: "2", label: "2 stars" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id || "all"}
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs ${
                      lowStars === item.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground ring-1 ring-border"
                    }`}
                    onClick={() => setLowStars(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="pb-2 font-medium">Time (Bangkok)</th>
                    <th className="pb-2 font-medium">Stars</th>
                    <th className="pb-2 font-medium">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lowRatingFeedback.length ? (
                    report.lowRatingFeedback.map((row) => (
                      <tr key={row.reviewId || row.timestamp} className="border-t border-border/60 align-top">
                        <td className="whitespace-nowrap py-2 pr-4">{formatBangkokTime(row.timestamp)}</td>
                        <td className="pr-4">{row.rating}</td>
                        <td className="whitespace-pre-wrap break-words">{row.feedback || "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr className="border-t border-border/60">
                      <td className="py-2" colSpan={3}>
                        —
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">Newest 100 in the selected range.</p>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function formatBangkokTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 ring-1 ring-border/70">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
