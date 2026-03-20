import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import de from "./locales/de.json";
import zh from "./locales/zh.json";
import es from "./locales/es.json";
import ja from "./locales/ja.json";
import fr from "./locales/fr.json";

export const SUPPORTED_UI_LANGUAGES = [
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "de", flag: "🇩🇪", label: "Deutsch" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
] as const;

export type UiLanguageCode = (typeof SUPPORTED_UI_LANGUAGES)[number]["code"];

const UI_LANGUAGE_STORAGE_KEY = "lingua-ui-language";

export function getCachedUiLanguage(): UiLanguageCode {
  const stored = localStorage.getItem(UI_LANGUAGE_STORAGE_KEY);
  const valid = SUPPORTED_UI_LANGUAGES.map((l) => l.code) as string[];
  if (stored && valid.includes(stored)) return stored as UiLanguageCode;
  return "en";
}

export function setCachedUiLanguage(code: UiLanguageCode) {
  localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, code);
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, de: { translation: de }, zh: { translation: zh }, es: { translation: es }, ja: { translation: ja }, fr: { translation: fr } },
  lng: getCachedUiLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
