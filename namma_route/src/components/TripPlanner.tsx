import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Bus,
  CalendarDays,
  Clock3,
  LocateFixed,
  Navigation,
  Search,
  Sparkles,
  TrainFront,
  Truck,
  Footprints,
  Send,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SupportedLanguage } from "./LanguageSelector";
import LocationAutocompleteInput from "./LocationAutocompleteInput";
import type { LocationSuggestion } from "../lib/locationSuggestions";

export type TransportMode = "bus" | "metro" | "walk" | "auto" | "best";

type TripPlannerProps = {
  language: SupportedLanguage;
  fromLocation: string;
  setFromLocation: (v: string) => void;
  toLocation: string;
  setToLocation: (v: string) => void;
  apiBase: string;
  currentLocationText: string;
  showUseCurrentLocationButton?: boolean;
  routeLoading: boolean;
  selectedMode: TransportMode;
  onModeChange: (mode: TransportMode) => void;
  onUseCurrentLocation: () => void;
  onFromSuggestionSelect: (suggestion: LocationSuggestion) => void;
  onToSuggestionSelect: (suggestion: LocationSuggestion) => void;
  onSwapLocations: () => void;
  onSearchRoutes: () => void;
};

type DatePreset = "now" | "today" | "tomorrow";

const MODES: Array<{
  key: TransportMode;
  icon: typeof Bus;
  labelKey: string;
}> = [
  { key: "bus", labelKey: "mode.bus", icon: Bus },
  { key: "metro", labelKey: "mode.metro", icon: TrainFront },
  { key: "walk", labelKey: "mode.walk", icon: Footprints },
  { key: "auto", labelKey: "mode.auto", icon: Truck },
  { key: "best", labelKey: "mode.best", icon: Sparkles },
];

export default function TripPlanner({
  fromLocation,
  setFromLocation,
  toLocation,
  setToLocation,
  apiBase,
  currentLocationText,
  showUseCurrentLocationButton = true,
  routeLoading,
  selectedMode,
  onModeChange,
  onUseCurrentLocation,
  onFromSuggestionSelect,
  onToSuggestionSelect,
  onSwapLocations,
  onSearchRoutes,
}: TripPlannerProps) {
  const { t } = useTranslation();
  const [datePreset, setDatePreset] = useState<DatePreset>("now");

  const dateOptions = useMemo(
    () =>
      [
        { key: "now", label: t("trip.now"), icon: Sparkles },
        { key: "today", label: t("trip.today"), icon: Clock3 },
        { key: "tomorrow", label: t("trip.tomorrow"), icon: CalendarDays },
      ] as const,
    [t]
  );

  void datePreset;

  return (
    <section className="rounded-[2rem] bg-[#d7dfeb] px-5 py-6 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.35)] fade-in-up md:px-10 md:py-10">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.9)]">
          <Send className="h-8 w-8" />
        </div>
        <div>
          <div className="text-sm font-bold uppercase tracking-[0.16em] text-sky-600">{t("trip.label")}</div>
          <h2 className="mt-1 text-3xl font-semibold text-slate-800">{t("trip.title")}</h2>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <LocationAutocompleteInput
            id="from-input"
            label={t("trip.from")}
            value={fromLocation}
            placeholder={t("trip.fromPlaceholder")}
            icon={Navigation}
            apiBase={apiBase}
            onValueChange={setFromLocation}
            onSuggestionSelect={onFromSuggestionSelect}
          />

          <button
            type="button"
            onClick={onSwapLocations}
            className="flex min-h-[62px] items-center justify-center gap-2 rounded-[1.15rem] bg-white px-5 text-sm font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm transition hover:bg-slate-50 md:min-h-[78px]"
          >
            <ArrowUpDown className="h-5 w-5 text-sky-600" />
            Swap
          </button>

          <LocationAutocompleteInput
            id="to-input"
            label={t("trip.to")}
            value={toLocation}
            placeholder={t("trip.toPlaceholder")}
            icon={Navigation}
            apiBase={apiBase}
            onValueChange={setToLocation}
            onSuggestionSelect={onToSuggestionSelect}
          />
        </div>

        <div className="pt-2">
          <div className="mb-4 flex items-center gap-3 text-lg font-semibold text-slate-700">
            <Clock3 className="h-5 w-5 text-sky-600" />
            <span>{t("trip.travelWhen")}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {dateOptions.map((item) => {
              const Icon = item.icon;
              const active = item.key === datePreset;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setDatePreset(item.key)}
                  className={`flex min-h-[64px] items-center justify-center gap-3 rounded-[1.25rem] px-5 text-lg font-semibold transition md:text-xl ${
                    active
                      ? "bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-[0_18px_40px_-24px_rgba(37,99,235,0.9)]"
                      : "bg-white text-slate-600 shadow-sm"
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2">
          <div className="mb-4 flex items-center gap-3 text-lg font-semibold text-slate-700">
            <Bus className="h-5 w-5 text-sky-600" />
            <span>{t("trip.transportMode")}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-5">
            {MODES.map((item) => {
              const Icon = item.icon;
              const active = item.key === selectedMode;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onModeChange(item.key)}
                  className={`flex min-h-[110px] flex-col items-center justify-center gap-3 rounded-[1.35rem] px-4 text-base font-semibold transition md:text-lg ${
                    active
                      ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-[0_20px_45px_-24px_rgba(37,99,235,0.95)]"
                      : "bg-white text-slate-700 shadow-sm"
                  }`}
                >
                  <Icon className="h-7 w-7" />
                  <span>{t(item.labelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[1.35rem] bg-gradient-to-r from-cyan-500 to-blue-500 px-6 py-4 text-center text-xl font-semibold text-white shadow-[0_18px_40px_-24px_rgba(14,165,233,0.9)] md:text-2xl">
          <span className="inline-flex items-center gap-3">
            <Navigation className="h-6 w-6" />
            {t("trip.currentLocation")}: {currentLocationText}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-[0.6fr_1.4fr]">
          {showUseCurrentLocationButton && (
            <button
              type="button"
              onClick={onUseCurrentLocation}
              className="flex min-h-[72px] items-center justify-center gap-3 rounded-[1.35rem] bg-white px-5 text-lg font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 md:text-xl"
            >
              <LocateFixed className="h-6 w-6 text-sky-600" />
              {t("trip.useCurrentLocation")}
            </button>
          )}

          <button
            type="button"
            onClick={onSearchRoutes}
            disabled={routeLoading}
            className="flex min-h-[72px] items-center justify-center gap-3 rounded-[1.35rem] bg-gradient-to-r from-blue-600 to-sky-500 px-5 text-xl font-semibold text-white shadow-[0_18px_40px_-24px_rgba(37,99,235,0.95)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-75 md:text-2xl"
          >
            {routeLoading ? <Sparkles className="h-6 w-6" /> : <Search className="h-6 w-6" />}
            {t("trip.searchRoutes")}
          </button>
        </div>
      </div>
    </section>
  );
}
