export const ANALYTICS_COLLECTION = "analytics_events";
export const ANALYTICS_SESSION_COOKIE = "ugc_sid";
export const ANALYTICS_QR_COOKIE = "ugc_qr";
export const ANALYTICS_SESSION_HEADER = "x-ugc-sid";
export const ANALYTICS_CAMPAIGN = "baan-ying-ugc";
export const ANALYTICS_TIMEZONE = "Asia/Bangkok";

export const ANALYTICS_EVENT_TYPES = [
  "qr_scan",
  "form_submit",
  "generation_complete",
  "xhs_publish_click",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];
export type AnalyticsDeviceType = "mobile" | "tablet" | "desktop";

export const ANALYTICS_RANGES = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "all",
] as const;

export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export type AnalyticsEventDocument = {
  eventId: string;
  eventType: AnalyticsEventType;
  sessionId: string;
  qrCodeId: string;
  campaign: string;
  timestamp: Date;
  metadata: Record<string, string>;
};

export type RecordAnalyticsInput = {
  eventType: AnalyticsEventType;
  eventId?: string;
  sessionId: string;
  qrCodeId?: string;
  campaign?: string;
  metadata?: Record<string, string>;
};

export type AnalyticsSummary = {
  qrScans: number;
  uniqueVisitors: number;
  formSubmissions: number;
  generations: number;
  xhsPublishClicks: number;
};

export type AnalyticsConversion = {
  qrToForm: number;
  formToGeneration: number;
  generationToXhs: number;
  qrToXhs: number;
};

export type AnalyticsDailyRow = {
  date: string;
  qrScans: number;
  formSubmissions: number;
  generations: number;
  xhsPublishClicks: number;
};

export type AnalyticsQrRow = {
  qrCodeId: string;
  scans: number;
};

export type AnalyticsReport = {
  range: AnalyticsRange | "custom";
  startDate: string | null;
  endDate: string | null;
  timezone: string;
  summary: AnalyticsSummary;
  conversion: AnalyticsConversion;
  daily: AnalyticsDailyRow[];
  byQrCode: AnalyticsQrRow[];
};
