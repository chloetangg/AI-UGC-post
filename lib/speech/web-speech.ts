import type { Language } from "@/lib/i18n";

export const SPEECH_RECOGNITION_LANG: Record<Language, string> = {
  zh: "zh-CN",
  en: "en-US",
  th: "th-TH",
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: { transcript?: string };
};

export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike> & { length: number };
};

export type SpeechRecognitionErrorEventLike = {
  error: string;
};

export type LiveSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => LiveSpeechRecognition;

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

export function canUseLiveSpeech() {
  return Boolean(speechRecognitionCtor());
}

export function createLiveSpeechRecognition(language: Language) {
  const Ctor = speechRecognitionCtor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = SPEECH_RECOGNITION_LANG[language];
  return recognition;
}

export function splitTranscripts(event: SpeechRecognitionEventLike) {
  let finals = "";
  let interim = "";
  for (let index = 0; index < event.results.length; index += 1) {
    const piece = event.results[index]?.[0]?.transcript ?? "";
    if (event.results[index]?.isFinal) finals += piece;
    else interim += piece;
  }
  return { finals, interim };
}
