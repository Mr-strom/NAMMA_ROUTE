import { useTranslation } from "react-i18next";

interface CompareCardProps {
  busFare: number;
  autoFare: number;
}

export const CompareCard = ({ busFare, autoFare }: CompareCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm uppercase tracking-widest text-slate-400">Cost Compare</h3>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
        <span className="text-sm font-semibold text-slate-700">{t("busLabel")}</span>
        <span className="text-lg font-semibold text-slate-900">₹{busFare}</span>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
        <span className="text-sm font-semibold text-slate-700">{t("autoLabel")}</span>
        <span className="text-lg font-semibold text-slate-900">₹{autoFare}</span>
      </div>
      <p className="text-xs text-slate-400">
        Compare fares quickly. Values are placeholders until real-time pricing is wired.
      </p>
    </div>
  );
};
