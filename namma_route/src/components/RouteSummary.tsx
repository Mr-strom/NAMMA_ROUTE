import { useMemo } from "react";
import type { RoutePlanResult } from "./NearbyStopsMap";
import { Sparkles } from "lucide-react";

type Translation = {
  commuteSnapshot: string;
  commuteDesc: string;
};

type RouteSummaryProps = {
  routeLoading: boolean;
  routeError: string | null;
  routeResult: RoutePlanResult | null;
  t: Translation;
  language: "en" | "kn";
};

const WALK_SPEED_M_PER_MIN = 80;

function formatMinutesFromMeters(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 1;
  return Math.max(1, Math.round(meters / WALK_SPEED_M_PER_MIN));
}

function formatKmFromMeters(meters: number): string {
  const km = meters / 1000;
  if (!Number.isFinite(km)) return "-";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export default function RouteSummary({
  routeLoading,
  routeError,
  routeResult,
  t,
  language,
}: RouteSummaryProps) {
  const content = useMemo(() => {
    if (routeLoading) {
      return {
        kind: "loading" as const,
      };
    }

    if (routeError) {
      return { kind: "error" as const, message: routeError };
    }

    if (!routeResult?.routePlan) {
      return { kind: "empty" as const };
    }

    const plan = routeResult.routePlan;
    const toWalkM = plan?.walk_to_stop_m ?? 0;
    const fromWalkM = plan?.walk_from_stop_m ?? 0;

    const steps = [
      {
        icon: "🚶",
        title:
          language === "kn" ? "ನಡೆದು ಬಸ್ ನಿಲ್ದಾಣಕ್ಕೆ ಹೋಗಿ" : "Walk to boarding stop",
        durationMin: formatMinutesFromMeters(toWalkM),
        distanceKm: formatKmFromMeters(toWalkM),
      },
      {
        icon: "🚌",
        title:
          plan?.common_routes?.length > 0
            ? language === "kn"
              ? `ಕೊಳ್ಳಿ: ${plan.common_routes[0]}`
              : `Take: ${plan.common_routes[0]}`
            : language === "kn"
              ? "ನೆರೆಮಾವಿನ ಮಾರ್ಗ ಪ್ರಯತ್ನಿಸಿ"
              : "Try a nearby landmark",
        durationMin: 0,
        distanceKm: "-",
      },
      {
        icon: "🚶",
        title:
          language === "kn" ? "ಇಳಿದು ನಡೆಯಿರಿ" : "Walk from alighting stop",
        durationMin: formatMinutesFromMeters(fromWalkM),
        distanceKm: formatKmFromMeters(fromWalkM),
      },
    ];

    const totalMinutes = steps.reduce((acc, s) => acc + (s.durationMin || 0), 0);

    return {
      kind: "result" as const,
      steps,
      totalMinutes,
      fareEstimate: routeResult.fareEstimate,
    };
  }, [language, routeError, routeLoading, routeResult]);

  if (content.kind === "loading") {
    return (
      <div className="bg-white rounded-2xl border border-border p-5 shadow-sm fade-in-up">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Sparkles className="w-4 h-4 text-accent" />
          Loading route...
        </div>
        <h3 className="text-xl font-bold text-foreground">{t.commuteSnapshot}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t.commuteDesc}</p>
      </div>
    );
  }

  if (content.kind === "error") {
    return (
      <div className="bg-white rounded-2xl border border-border p-5 shadow-sm fade-in-up border-l-4 border-[#6D28D9]">
        <h3 className="text-xl font-bold text-foreground mb-2">
          {language === "kn" ? "ಮಾರ್ಗ ಸಿಗಲಿಲ್ಲ" : "No route found"}
        </h3>
        <p className="text-sm text-red-700">{content.message}</p>
      </div>
    );
  }

  if (content.kind === "empty") {
    return (
      <div className="bg-white rounded-2xl border border-border p-5 shadow-sm fade-in-up border-l-4 border-[#6D28D9]">
        <h3 className="text-xl font-bold text-foreground">
          {language === "kn" ? "ಯಾವ ಮಾರ್ಗವೂ ಸಿಗಲಿಲ್ಲ" : "No routes found"}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {language === "kn"
            ? "ಫಿಲ್ಟರ್‌ಗಳನ್ನು ಬದಲಿಸಿ ಅಥವಾ ಸಮೀಪದ ಸ್ಥಳವನ್ನು ಪ್ರಯತ್ನಿಸಿ."
            : "Try adjusting your inputs or use a nearby landmark."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-5 shadow-sm fade-in-up border-l-4 border-[#6D28D9]">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="text-sm uppercase tracking-widest text-muted-foreground">
            {language === "kn" ? "ನಿಮ್ಮ ಮಾರ್ಗ" : "Your Route Summary"}
          </div>
          <div className="text-xl font-bold text-foreground">
            {language === "kn" ? "ಸೂಚಿಸಿದ ಹೆಜ್ಜೆಗಳು" : "Suggested steps"}
          </div>
        </div>
        <div className="bg-secondary rounded-xl px-4 py-2 text-center">
          <div className="text-sm font-bold text-foreground">{content.totalMinutes} min</div>
          <div className="text-xs text-muted-foreground">{language === "kn" ? "ಒಟ್ಟು ಸಮಯ" : "Total time"}</div>
        </div>
      </div>

      <div role="list" aria-label="Route steps" className="space-y-3">
        {content.steps.map((s, idx) => (
          <div key={idx} role="listitem" className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary text-center flex items-center justify-center text-lg">
              {s.icon}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-foreground text-sm">{s.title}</div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">{s.durationMin}</span>{" "}
                {language === "kn" ? "ನಿಮಿಷ" : "min"} •{" "}
                <span className="font-semibold text-foreground">{s.distanceKm}</span>
              </div>
            </div>
            {idx < content.steps.length - 1 && (
              <div className="text-muted-foreground text-lg leading-none">↓</div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 bg-[#0D9488]/10 rounded-xl p-4 border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-foreground font-semibold">
            {language === "kn" ? "🕐 ಒಟ್ಟು ಸಮಯ" : "🕐 Total Time"}: {content.totalMinutes} min
          </div>
          <div className="text-sm text-foreground font-semibold">
            {language === "kn" ? "💰 ಅಂದಾಜು ದರ" : "💰 Estimated Fare"}:{" "}
            {content.fareEstimate != null ? `₹${content.fareEstimate}` : "-"}
          </div>
          <div className="text-sm text-foreground font-semibold">
            {language === "kn" ? "🔄 ಬದಲಾವಣೆ" : "🔄 Transfers"}: 0
          </div>
        </div>

        <div className="flex gap-3 mt-4 flex-wrap">
          <button
            type="button"
            className="px-4 py-2 rounded-xl border-2 border-[#6D28D9] text-[#6D28D9] font-semibold hover:bg-[#6D28D9]/10"
            onClick={() => {
              // Best-effort: store last summary.
              try {
                localStorage.setItem("nammaroute_saved_summary", JSON.stringify(routeResult));
              } catch {
                // ignore
              }
            }}
          >
            {language === "kn" ? "ಉಳಿಸಿ" : "Save Route"}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl border-2 border-[#0D9488] text-[#0D9488] font-semibold hover:bg-[#0D9488]/10"
            onClick={async () => {
              const text =
                language === "kn"
                  ? `Namma Route - ಒಟ್ಟು ಸಮಯ: ${content.totalMinutes} min`
                  : `Namma Route - total time: ${content.totalMinutes} min`;
              try {
                if (navigator.share) {
                  await navigator.share({ text });
                } else {
                  await navigator.clipboard.writeText(text);
                  alert(language === "kn" ? "ಕಾಪಿ ಆಯಿತು!" : "Copied!");
                }
              } catch {
                // ignore
              }
            }}
          >
            {language === "kn" ? "ಹಂಚಿ" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

