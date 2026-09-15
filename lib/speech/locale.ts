import type { Language } from "@/lib/i18n";

/** Whisper / STT language. Prefer Mandarin; never default to English. */
export function speechLanguageForUi(language: Language): "zh" | "th" {
  return language === "th" ? "th" : "zh";
}
