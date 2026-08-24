import type { StopScanResult } from "../components/QRCodePanel";
import type { RoutePlanResult } from "../components/NearbyStopsMap";
import type { AssistanceMode } from "../context/UserContext";
import type { TransportMode } from "../components/TripPlanner";
import type { SupportedLanguage } from "../components/LanguageSelector";
import {
  estimateBusFare,
  estimateMetroFare,
  estimateNammaYatriFare,
  estimateUberFare,
  getBusServiceType,
  getBusServiceTypeLabel,
  getComparisonRateLabel,
  getDirectTripDistanceKm,
  getMetroSuggestion,
  getRoadRideDistanceKm,
  getRouteOptionDistanceKm,
  getSelectedRouteDistanceKm,
  getShaktiSchemeText,
  type BusServiceType,
  type ComparisonModeId,
} from "./fareModel";

export type DisplayRoute = {
  id: string;
  routeNumber: string;
  departure: string;
  arrival: string;
  duration: string;
  durationMinutes: number;
  cost: number | null;
  stops: number;
  isBestRoute: boolean;
  serviceType: BusServiceType;
  serviceLabel: string;
  fareNote: string | null;
  distanceKm: number | null;
};

export type CompareOption = {
  id: ComparisonModeId;
  minutes: number;
  cost: number | null;
  walkingMetres: number;
  accessibilityScore: number;
  label: string;
  bestFor: string;
  note: string;
  recommended: boolean;
  rateLabel: string;
  extraFareLabel?: string | null;
  distanceKm: number | null;
  isEstimated?: boolean;
};

export type AssistiveBrief = {
  summary: string;
  steps: string[];
  voice_text: string;
  message_draft: string;
  lost_support: string;
};

export function addMinutesToTimeLabel(timeLabel: string, minutesToAdd: number) {
  const parts = timeLabel.match(/^(\d{1,2}):(\d{2})$/);
  if (!parts) return timeLabel;

  const hours = Number(parts[1]);
  const minutes = Number(parts[2]);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const nextHours = Math.floor(normalized / 60);
  const nextMinutes = normalized % 60;
  const suffix = nextHours >= 12 ? "PM" : "AM";
  const displayHour = nextHours % 12 === 0 ? 12 : nextHours % 12;
  return `${displayHour}:${String(nextMinutes).padStart(2, "0")} ${suffix}`;
}

export function metresToMinutes(metres: number) {
  return Math.max(1, Math.round(metres / 80));
}

export function metresToLabel(metres: number, language: SupportedLanguage) {
  if (metres >= 1000) {
    return `${(metres / 1000).toFixed(1)} km`;
  }
  return language === "kn" ? `${Math.round(metres)} m` : `${Math.round(metres)} m`;
}

function getDisplayText(
  language: SupportedLanguage,
  english: string,
  kannadaFallback: string
) {
  return language === "kn" ? kannadaFallback : english;
}

function getModeLabel(language: SupportedLanguage, modeId: ComparisonModeId) {
  switch (modeId) {
    case "bus_non_ac":
      return getDisplayText(language, "BMTC Non-AC", "BMTC Non-AC");
    case "bus_ac":
      return getDisplayText(language, "BMTC AC", "BMTC AC");
    case "metro":
      return getDisplayText(language, "Metro", "Metro");
    case "uber":
      return getDisplayText(language, "Uber", "Uber");
    case "namma_yatri":
      return getDisplayText(language, "Namma Yatri", "Namma Yatri");
    default:
      return modeId;
  }
}

function getBestForLabel(language: SupportedLanguage, modeId: ComparisonModeId) {
  switch (modeId) {
    case "bus_non_ac":
      return getDisplayText(language, "Lowest public fare", "Lowest public fare");
    case "bus_ac":
      return getDisplayText(language, "More comfort on longer rides", "More comfort on longer rides");
    case "metro":
      return getDisplayText(language, "Predictable station-to-station fare", "Predictable station-to-station fare");
    case "uber":
      return getDisplayText(language, "Fastest premium ride estimate", "Fastest premium ride estimate");
    case "namma_yatri":
      return getDisplayText(language, "Lower-cost ride-hailing option", "Lower-cost ride-hailing option");
    default:
      return "";
  }
}

function scoreAccessibility(mode: ComparisonModeId, walkingMetres: number, assistanceMode: AssistanceMode) {
  const walkingPenalty = walkingMetres / 180;
  const modeBase =
    mode === "uber" || mode === "namma_yatri"
      ? 9
      : mode === "metro"
        ? 7
        : mode === "bus_ac"
          ? 7
          : 6;
  const assistBoost = assistanceMode === "standard" ? 0 : assistanceMode === "blind" ? -1 : 1;
  return Math.max(1, Math.min(10, Math.round(modeBase + assistBoost - walkingPenalty)));
}

export function getSelectedRouteOption(routeResult: RoutePlanResult | null, selectedRouteName: string | null) {
  if (!routeResult?.routePlan) return null;
  const options = routeResult.routePlan.route_options ?? [];
  if (selectedRouteName) {
    return options.find((option) => option.route_name === selectedRouteName) ?? routeResult.routePlan.selected_route ?? null;
  }
  return routeResult.routePlan.selected_route ?? options[0] ?? null;
}

export function estimateRouteDistanceKm(routeResult: RoutePlanResult | null, selectedRouteName: string | null) {
  return getSelectedRouteDistanceKm(routeResult, selectedRouteName) ?? getDirectTripDistanceKm(routeResult);
}

export function buildDisplayRoutes(routeResult: RoutePlanResult | null, language: SupportedLanguage = "en"): DisplayRoute[] {
  if (!routeResult?.routePlan) return [];

  const plan = routeResult.routePlan;
  const options = Array.isArray(plan.route_options) ? plan.route_options : [];
  const times = Array.isArray(routeResult.stopTimes) ? routeResult.stopTimes : [];
  const bestTime = times[0] ?? "10:30";

  return options.map((option, index) => {
    const durationMinutes = Math.max(
      12,
      Math.round(((plan.walk_to_stop_m ?? 0) + (plan.walk_from_stop_m ?? 0)) / 150) + option.stop_count * 2
    );
    const distanceKm = getRouteOptionDistanceKm(plan, option);
    const serviceType = getBusServiceType(option.route_name);
    const cost = distanceKm == null ? null : estimateBusFare(distanceKm, serviceType);
    const fareNote =
      serviceType === "non_ac"
        ? getShaktiSchemeText(language)
        : getDisplayText(
            language,
            "AC BMTC fares are estimated from current Vajra stage fares.",
            "AC BMTC fares are estimated from current Vajra stage fares."
          );

    return {
      id: `${option.route_name}-${index}`,
      routeNumber: option.route_name,
      departure: addMinutesToTimeLabel(times[index] ?? bestTime, index * 5),
      arrival: addMinutesToTimeLabel(times[index] ?? bestTime, durationMinutes),
      duration:
        durationMinutes >= 60
          ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`
          : `${durationMinutes} min`,
      durationMinutes,
      cost,
      stops: option.stop_count,
      isBestRoute: index === 0,
      serviceType,
      serviceLabel: getBusServiceTypeLabel(serviceType, language),
      fareNote,
      distanceKm,
    };
  });
}

export function buildCompareOptions(
  routeResult: RoutePlanResult | null,
  selectedRouteName: string | null,
  selectedMode: TransportMode,
  assistanceMode: AssistanceMode,
  isStudent: boolean,
  isSenior: boolean,
  prefersSingleBus: boolean,
  needsWomenSafetyMode: boolean,
  language: SupportedLanguage
): CompareOption[] {
  const activeRoute = getSelectedRouteOption(routeResult, selectedRouteName);
  if (!routeResult?.routePlan && !routeResult?.tripCoords) return [];

  const totalWalking = routeResult.routePlan
    ? routeResult.routePlan.walk_to_stop_m + routeResult.routePlan.walk_from_stop_m
    : 0;
  const routeDistanceKm = getSelectedRouteDistanceKm(routeResult, selectedRouteName) ?? getDirectTripDistanceKm(routeResult) ?? 5;
  const rideDistanceKm = getRoadRideDistanceKm(routeResult, selectedRouteName) ?? routeDistanceKm;
  const directDistanceKm = getDirectTripDistanceKm(routeResult);
  const metroSuggestion = getMetroSuggestion(routeResult);
  const metroDistanceKm = Math.max(1, metroSuggestion?.rideDistanceKm ?? directDistanceKm ?? routeDistanceKm * 0.85);

  const baseMinutes = activeRoute
    ? Math.max(12, activeRoute.stop_count * 2 + metresToMinutes(totalWalking))
    : Math.max(15, Math.round(routeDistanceKm * 3.2 + totalWalking / 90 + 4));
  const metroWalking = metroSuggestion
    ? metroSuggestion.accessWalkingMetres + metroSuggestion.egressWalkingMetres
    : Math.max(300, Math.round(totalWalking * 0.7));
  const uberMinutes = Math.max(10, Math.round(rideDistanceKm * 2.2 + 5));
  const nammaYatriMinutes = Math.max(10, Math.round(rideDistanceKm * 2.4 + 6));

  const options: CompareOption[] = [
    {
      id: "bus_non_ac",
      minutes: baseMinutes,
      cost: estimateBusFare(routeDistanceKm, "non_ac"),
      walkingMetres: totalWalking,
      accessibilityScore: scoreAccessibility("bus_non_ac", totalWalking, assistanceMode),
      label: getModeLabel(language, "bus_non_ac"),
      bestFor: getBestForLabel(language, "bus_non_ac"),
      note:
        !activeRoute
          ? getDisplayText(language, "No direct bus was matched, so this fare is shown from trip distance.", "No direct bus was matched, so this fare is shown from trip distance.")
          : prefersSingleBus
          ? getDisplayText(language, "Matches the current bus-first route and keeps pricing simple.", "Matches the current bus-first route and keeps pricing simple.")
          : getDisplayText(
              language,
              "BMTC Non-AC fare estimated from the current stage-fare slabs for this route distance.",
              "BMTC Non-AC fare estimated from the current stage-fare slabs for this route distance."
            ),
      recommended: false,
      rateLabel: getComparisonRateLabel("bus_non_ac", language),
      extraFareLabel: getShaktiSchemeText(language),
      distanceKm: routeDistanceKm,
    },
    {
      id: "bus_ac",
      minutes: Math.max(10, baseMinutes - 2),
      cost: estimateBusFare(routeDistanceKm, "ac"),
      walkingMetres: totalWalking,
      accessibilityScore: scoreAccessibility("bus_ac", totalWalking, assistanceMode),
      label: getModeLabel(language, "bus_ac"),
      bestFor: getBestForLabel(language, "bus_ac"),
      note: getDisplayText(
        language,
        "Useful when you want BMTC comfort with an AC Vajra-style fare estimate.",
        "Useful when you want BMTC comfort with an AC Vajra-style fare estimate."
      ),
      recommended: false,
      rateLabel: getComparisonRateLabel("bus_ac", language),
      extraFareLabel: getDisplayText(language, "Not covered by the Shakti scheme.", "Not covered by the Shakti scheme."),
      distanceKm: routeDistanceKm,
    },
    {
      id: "metro",
      minutes: Math.max(18, Math.round(metroDistanceKm * 2.4 + metroWalking / 85 + 6)),
      cost: estimateMetroFare(metroDistanceKm, isStudent, isSenior),
      walkingMetres: metroWalking,
      accessibilityScore: scoreAccessibility("metro", metroWalking, assistanceMode),
      label: getModeLabel(language, "metro"),
      bestFor: getBestForLabel(language, "metro"),
      note: metroSuggestion
        ? `${metroSuggestion.originStation.name} to ${metroSuggestion.destinationStation.name} via ${metroSuggestion.lineSummary}.`
        : getDisplayText(language, "Metro fare is estimated from the nearest corridor.", "Metro fare is estimated from the nearest corridor."),
      recommended: false,
      rateLabel: getComparisonRateLabel("metro", language),
      extraFareLabel: metroSuggestion ? `${metroSuggestion.rideDistanceKm.toFixed(1)} km on metro` : null,
      distanceKm: metroDistanceKm,
    },
    {
      id: "uber",
      minutes: uberMinutes,
      cost: estimateUberFare(rideDistanceKm),
      walkingMetres: 90,
      accessibilityScore: scoreAccessibility("uber", 90, assistanceMode),
      label: getModeLabel(language, "uber"),
      bestFor: getBestForLabel(language, "uber"),
      note: getDisplayText(language, "Estimated from road distance for a direct ride.", "Estimated from road distance for a direct ride."),
      recommended: false,
      rateLabel: getComparisonRateLabel("uber", language),
      extraFareLabel: getDisplayText(language, "Ride-hailing price can surge with demand.", "Ride-hailing price can surge with demand."),
      distanceKm: rideDistanceKm,
      isEstimated: true,
    },
    {
      id: "namma_yatri",
      minutes: nammaYatriMinutes,
      cost: estimateNammaYatriFare(rideDistanceKm),
      walkingMetres: 120,
      accessibilityScore: scoreAccessibility("namma_yatri", 120, assistanceMode),
      label: getModeLabel(language, "namma_yatri"),
      bestFor: getBestForLabel(language, "namma_yatri"),
      note: getDisplayText(language, "Useful for comparing local ride-hailing against bus and metro.", "Useful for comparing local ride-hailing against bus and metro."),
      recommended: false,
      rateLabel: getComparisonRateLabel("namma_yatri", language),
      extraFareLabel: getDisplayText(language, "Usually cheaper than Uber for the same road distance.", "Usually cheaper than Uber for the same road distance."),
      distanceKm: rideDistanceKm,
      isEstimated: true,
    },
  ];

  let explicitChoice: ComparisonModeId | null = null;
  if (selectedMode === "bus") {
    explicitChoice = activeRoute && getBusServiceType(activeRoute.route_name) === "ac" ? "bus_ac" : "bus_non_ac";
  } else if (selectedMode === "metro") {
    explicitChoice = "metro";
  } else if (selectedMode === "auto") {
    explicitChoice = needsWomenSafetyMode || estimateNammaYatriFare(rideDistanceKm) <= estimateUberFare(rideDistanceKm) ? "namma_yatri" : "uber";
  }

  const recommendedId =
    explicitChoice ??
    options
      .map((option) => {
        let score = option.minutes + (option.cost ?? 0) * 0.55 + option.walkingMetres / 65;
        if (assistanceMode === "blind") score += option.walkingMetres / 25;
        if (assistanceMode === "wheelchair") score += option.walkingMetres / 22;
        if (prefersSingleBus && (option.id === "bus_non_ac" || option.id === "bus_ac")) score -= 10;
        if (needsWomenSafetyMode && option.id === "namma_yatri") score -= 8;
        if (needsWomenSafetyMode && option.id === "metro") score -= 3;
        return { id: option.id, score };
      })
      .sort((left, right) => left.score - right.score)[0].id;

  return options.map((option) => ({
    ...option,
    recommended: option.id === recommendedId,
  }));
}

export function buildFallbackBrief(
  language: SupportedLanguage,
  routeResult: RoutePlanResult | null,
  selectedRouteName: string | null,
  compareOptions: CompareOption[],
  stop: StopScanResult | null,
  originLabel: string,
  destinationLabel: string
): AssistiveBrief {
  const selectedRoute = getSelectedRouteOption(routeResult, selectedRouteName);
  const recommended = compareOptions.find((option) => option.recommended) ?? compareOptions[0];

  if (stop) {
    const summary =
      language === "kn"
        ? `You are currently at ${stop.stop_name}. The app can now explain the safest and cheapest next step from this stop.`
        : `You are currently at ${stop.stop_name}. The app can now explain the safest and cheapest next step from this stop.`;
    const steps =
      language === "kn"
        ? [
            `${stop.stop_name} has been identified as your current stop.`,
            `The recommended option toward ${destinationLabel || "your destination"} is ${recommended?.label ?? "bus"}.`,
            "Use the message draft below if you need to alert family or a caregiver.",
          ]
        : [
            `${stop.stop_name} has been identified as your current stop.`,
            `The recommended option toward ${destinationLabel || "your destination"} is ${recommended?.label ?? "bus"}.`,
            "Use the message draft below if you need to alert family or a caregiver.",
          ];
    return {
      summary,
      steps,
      voice_text: `${summary} ${steps.join(" ")}`,
      message_draft: `I am at ${stop.stop_name}. Please help me with directions or call me.`,
      lost_support: `Scanned stop: ${stop.stop_name}`,
    };
  }

  const summary =
    language === "kn"
      ? `${selectedRoute?.route_name ?? "The suggested route"} is ready from ${originLabel || "your current location"} to ${destinationLabel || "your destination"}.`
      : `${selectedRoute?.route_name ?? "The suggested route"} is ready from ${originLabel || "your current location"} to ${destinationLabel || "your destination"}.`;

  const steps =
    selectedRoute
      ? [
          `Walk to ${selectedRoute.boarding_stop.stop_name}.`,
          `Board bus ${selectedRoute.route_name}.`,
          `Get down at ${selectedRoute.alighting_stop.stop_name}.`,
          `Walk the last stretch to ${destinationLabel || "your destination"}.`,
        ]
      : ["Route details are not ready yet."];

  return {
    summary,
    steps,
    voice_text: `${summary} ${steps.join(" ")}`,
    message_draft: `I am travelling to ${destinationLabel || "my destination"}. The recommended option is ${recommended?.label ?? "bus"}.`,
    lost_support: "If you get lost, scan the nearest stop QR to identify your location.",
  };
}
