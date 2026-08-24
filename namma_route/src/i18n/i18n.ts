import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import kn from "./kn.json";

const STORAGE_KEY = "nammaroute_lang";

function getSavedLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "kn") return saved;
  } catch {
    // ignore
  }
  return "en";
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    kn: { translation: kn },
  },
  lng: getSavedLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
