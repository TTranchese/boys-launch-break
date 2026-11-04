import { en } from "./en";
import { it, type Messages } from "./it";

export type { Messages, ServerErrorCode } from "./it";

export const LOCALES = ["it", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "it";
/** Read by the server so the first render is already in the chosen language. */
export const LOCALE_COOKIE = "locale";

/** Each language names itself, so it can be found by someone who doesn't read the current one. */
export const LOCALE_NAMES: Record<Locale, string> = { it: "Italiano", en: "English" };

const MESSAGES: Record<Locale, Messages> = { it, en };

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);
export const resolveLocale = (value: unknown): Locale => (isLocale(value) ? value : DEFAULT_LOCALE);
export const messagesFor = (locale: Locale) => MESSAGES[locale];
