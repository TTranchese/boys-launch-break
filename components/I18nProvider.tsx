"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { LOCALE_COOKIE, messagesFor, type Locale, type Messages } from "@/lib/i18n";

type I18n = { locale: Locale; t: Messages; setLocale: (locale: Locale) => void };

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState(initialLocale);
  const value = useMemo<I18n>(() => ({
    locale,
    t: messagesFor(locale),
    setLocale: (next) => {
      setLocaleState(next);
      document.documentElement.lang = next;
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    },
  }), [locale]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
