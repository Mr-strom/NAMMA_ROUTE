import { Bus, Car, Route, TrainFront } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CompareOption } from "../lib/appHelpers";
import type { SupportedLanguage } from "./LanguageSelector";
import { metresToLabel } from "../lib/appHelpers";
import MetroFareCompare from "./MetroFareCompare";

type TravelComparePanelProps = {
  options: CompareOption[];
  estimatedDistanceKm: number | null;
  language: SupportedLanguage;
};

function getOptionIcon(optionId: CompareOption["id"]) {
  if (optionId === "metro") return TrainFront;
  if (optionId === "uber" || optionId === "namma_yatri") return Car;
  return Bus;
}

export default function TravelComparePanel({
  options,
  estimatedDistanceKm,
  language,
}: TravelComparePanelProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-8 rounded-[2.2rem] bg-[#d6deea] px-4 py-6 md:px-8 md:py-8">
      <div className="mb-2 flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_12px_30px_-18px_rgba(16,185,129,0.9)]">
          <Route className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-4xl font-semibold text-slate-800">{t("compare.title")}</h2>
          <p className="text-xl text-slate-600">{t("compare.subtitle")}</p>
        </div>
      </div>

      <div className="rounded-[1.7rem] border border-white/70 bg-white px-5 py-4 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Fare calculator distance</div>
        <div className="mt-2 text-2xl font-semibold text-slate-800">
          {estimatedDistanceKm == null ? t("common.notAvailable") : `${estimatedDistanceKm.toFixed(1)} km`}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          BMTC prices use the selected route distance with current stage-fare estimates, while Uber and Namma Yatri use a road-distance estimate and metro uses the nearest metro path.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {options.map((option) => {
          const Icon = getOptionIcon(option.id);
          return (
            <article
              key={option.id}
              className={`rounded-[1.6rem] border p-5 shadow-sm ${
                option.recommended
                  ? "border-amber-300 bg-amber-50 shadow-[0_20px_45px_-28px_rgba(245,158,11,0.5)]"
                  : "border-white/70 bg-white"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-xl font-semibold text-slate-800">{option.label}</div>
                    <div className="text-sm text-slate-500">{option.bestFor}</div>
                  </div>
                </div>
                {option.recommended && (
                  <span className="rounded-full bg-amber-200 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-900">
                    {t("compare.recommended")}
                  </span>
                )}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("compare.time")}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-800">{option.minutes} min</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("compare.cost")}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-800">
                    {option.cost == null ? t("common.notAvailable") : `Rs ${option.cost}`}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("compare.walking")}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-800">
                    {metresToLabel(option.walkingMetres, language)}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{t("compare.accessibility")}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-800">{option.accessibilityScore}/10</div>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>{option.note}</p>
                <p className="font-semibold text-slate-700">{option.rateLabel}</p>
                {option.extraFareLabel && <p>{option.extraFareLabel}</p>}
                {option.distanceKm != null && (
                  <p className="text-slate-500">
                    Distance used: {option.distanceKm.toFixed(1)} km{option.isEstimated ? " (estimated)" : ""}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <MetroFareCompare estimatedDistanceKm={estimatedDistanceKm} language={language} options={options} />
    </section>
  );
}
