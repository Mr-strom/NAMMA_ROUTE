import { useTranslation } from "react-i18next";

export const LanguageToggle = () => {
  const { i18n } = useTranslation();
  const next = i18n.language === "kn" ? "en" : "kn";

  return (
    <button
      type="button"
      onClick={() => void i18n.changeLanguage(next)}
      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300"
      aria-label="Toggle language"
    >
      {next === "kn" ? "ಕನ್ನಡ" : "English"}
    </button>
  );
};
