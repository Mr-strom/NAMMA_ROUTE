import type { CompareOption } from "../lib/appHelpers";

type MetroFareCompareProps = {
  estimatedDistanceKm?: number | null;
  language?: "en" | "kn";
  options: CompareOption[];
};

export default function MetroFareCompare({
  estimatedDistanceKm,
  language = "en",
  options,
}: MetroFareCompareProps) {
  return (
    <section className="rounded-2xl border border-border bg-white p-5 shadow-sm fade-in-up">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground">
            {language === "kn" ? "Fare price calculator" : "Fare price calculator"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {estimatedDistanceKm == null
              ? "Set a source and destination to compare fares."
              : `Current trip distance: ${estimatedDistanceKm.toFixed(1)} km`}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[1.2fr_1fr_0.9fr_1.5fr] overflow-hidden rounded-xl bg-[#0f766e] text-white">
            <div className="px-4 py-3 text-sm font-bold">Mode</div>
            <div className="px-4 py-3 text-sm font-bold">Rate / rule</div>
            <div className="px-4 py-3 text-sm font-bold">Fare</div>
            <div className="px-4 py-3 text-sm font-bold">Special note</div>
          </div>

          <div className="mt-3 space-y-3">
            {options.map((option, index) => (
              <div
                key={option.id}
                className={`grid grid-cols-[1.2fr_1fr_0.9fr_1.5fr] overflow-hidden rounded-xl border border-border ${
                  option.recommended ? "bg-amber-50" : index % 2 === 0 ? "bg-[#ecfeff]" : "bg-white"
                }`}
              >
                <div className="px-4 py-3 text-sm font-semibold text-foreground">{option.label}</div>
                <div className="px-4 py-3 text-sm text-muted-foreground">{option.rateLabel}</div>
                <div className="px-4 py-3 text-sm font-semibold text-foreground">
                  {option.cost == null ? "-" : `Rs ${option.cost}`}
                </div>
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  {option.extraFareLabel ?? option.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
