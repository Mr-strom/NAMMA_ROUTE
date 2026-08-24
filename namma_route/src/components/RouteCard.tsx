import { useTranslation } from "react-i18next";
import type { RouteResult } from "../api/query";

interface RouteCardProps {
  result: RouteResult;
}

export const RouteCard = ({ result }: RouteCardProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm uppercase tracking-widest text-slate-400">{t("busLabel")}</span>
        <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-semibold text-white">
          {result.busNumber}
        </span>
      </div>
      <div className="space-y-2 text-sm text-slate-700">
        <p>
          <span className="font-semibold text-slate-900">{t("boardLabel")}:</span> {result.boardingStop}
        </p>
        <p>
          <span className="font-semibold text-slate-900">{t("alightLabel")}:</span> {result.alightStop}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase text-slate-400">{t("fareLabel")}</p>
          <p className="text-lg font-semibold text-slate-900">₹{result.fare}</p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs uppercase text-slate-400">{t("durationLabel")}</p>
          <p className="text-lg font-semibold text-slate-900">{result.duration}</p>
        </div>
        <div className="col-span-2 rounded-xl bg-emerald-50 p-3 text-emerald-800">
          <p className="text-xs uppercase text-emerald-500">{t("shaktiLabel")}</p>
          <p className="text-sm font-semibold">{result.shakti}</p>
        </div>
      </div>
    </div>
  );
};
