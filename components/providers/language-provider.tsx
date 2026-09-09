"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANGUAGE,
  translations,
  type Dictionary,
  type Language,
} from "@/lib/i18n";

const STORAGE_KEY = "xhs-ugc-ui-language";
const listeners = new Set<() => void>();
let currentLanguage: Language = DEFAULT_LANGUAGE;
let hasLoaded = false;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "zh";
}

function readStoredLanguage(): Language {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (isLanguage(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANGUAGE;
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): Language {
  if (!hasLoaded) {
    currentLanguage = readStoredLanguage();
    hasLoaded = true;
  }
  return currentLanguage;
}

function getServerSnapshot(): Language {
  return DEFAULT_LANGUAGE;
}

function persistLanguage(language: Language) {
  currentLanguage = language;
  hasLoaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    /* ignore */
  }
  listeners.forEach((listener) => listener());
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    persistLanguage(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: translations[language],
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}

export function useT() {
  return useLanguage().t;
}
