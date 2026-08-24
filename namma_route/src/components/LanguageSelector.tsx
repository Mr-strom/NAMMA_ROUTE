import { useEffect } from "react";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

export type SupportedLanguage = "en" | "kn";

const LANGUAGE_OPTIONS = [
  { code: "en" as const, key: "language.english" },
  { code: "kn" as const, key: "language.kannada" },
];

type LanguageSelectorProps = {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
};

const STORAGE_KEY = "nammaroute_lang";

export default function LanguageSelector({ language, onLanguageChange }: LanguageSelectorProps) {
  const { t } = useTranslation();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }
  }, [language]);

  return (
    <div
      className="flex items-center gap-2 rounded-[1.4rem] border border-cyan-300/20 bg-[#264ea4] p-2 shadow-[0_18px_35px_-24px_rgba(15,23,42,0.65)]"
      role="radiogroup"
      aria-label="Select language"
    >
      {LANGUAGE_OPTIONS.map((option) => {
        const active = option.code === language;
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onLanguageChange(option.code)}
            className={`flex min-h-[56px] items-center gap-3 rounded-[1.1rem] px-6 text-lg font-semibold transition md:text-xl ${
              active
                ? "bg-gradient-to-r from-sky-500 to-blue-500 text-white"
                : "bg-transparent text-cyan-100"
            }`}
          >
            {option.code === "en" && <Globe className="h-5 w-5" />}
            {t(option.key)}
          </button>
        );
      })}
    </div>
  );
}
