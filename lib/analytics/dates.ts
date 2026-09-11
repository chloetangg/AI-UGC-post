import { ANALYTICS_RANGES, ANALYTICS_TIMEZONE, type AnalyticsRange } from "@/lib/analytics/types";

const BANGKOK_OFFSET = "+07:00";

export function ymdInTimeZone(date: Date, timeZone = ANALYTICS_TIMEZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function utcFromYmd(ymd: string, endOfDay = false) {
  const stamp = endOfDay ? "23:59:59.999" : "00:00:00.000";
  return new Date(`${ymd}T${stamp}${BANGKOK_OFFSET}`);
}

function shiftYmd(ymd: string, days: number) {
  const date = utcFromYmd(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return ymdInTimeZone(date);
}

export function resolveAnalyticsWindow(input: {
  range?: string;
  startDate?: string;
  endDate?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const today = ymdInTimeZone(now);
  const customStart = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate ?? "") ? input.startDate! : "";
  const customEnd = /^\d{4}-\d{2}-\d{2}$/.test(input.endDate ?? "") ? input.endDate! : "";
  if (customStart || customEnd) {
    const start = customStart || customEnd;
    const end = customEnd || customStart;
    return {
      range: "custom" as const,
      startDate: start,
      endDate: end,
      from: utcFromYmd(start),
      to: utcFromYmd(end, true),
    };
  }

  const range = (ANALYTICS_RANGES as readonly string[]).includes(input.range ?? "")
    ? (input.range as AnalyticsRange)
    : "last_7_days";
  if (range === "all") {
    return { range, startDate: null, endDate: today, from: null, to: utcFromYmd(today, true) };
  }
  if (range === "today") {
    return { range, startDate: today, endDate: today, from: utcFromYmd(today), to: utcFromYmd(today, true) };
  }
  if (range === "yesterday") {
    const yesterday = shiftYmd(today, -1);
    return {
      range,
      startDate: yesterday,
      endDate: yesterday,
      from: utcFromYmd(yesterday),
      to: utcFromYmd(yesterday, true),
    };
  }
  if (range === "this_month") {
    const start = `${today.slice(0, 8)}01`;
    return { range, startDate: start, endDate: today, from: utcFromYmd(start), to: utcFromYmd(today, true) };
  }
  const days = range === "last_30_days" ? 29 : 6;
  const start = shiftYmd(today, -days);
  return { range, startDate: start, endDate: today, from: utcFromYmd(start), to: utcFromYmd(today, true) };
}
