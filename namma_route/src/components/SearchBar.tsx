import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";

interface SearchBarProps {
  onSearch: (from: string, to: string) => void;
  loading?: boolean;
}

export const SearchBar = ({ onSearch, loading = false }: SearchBarProps) => {
  const { t } = useTranslation();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(from.trim(), to.trim());
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">{t("searchTitle")}</h1>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 md:flex-row">
        <input
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          placeholder={t("fromPlaceholder")}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
        <input
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder={t("toPlaceholder")}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {t("searchButton")}
        </button>
      </form>
    </section>
  );
};
