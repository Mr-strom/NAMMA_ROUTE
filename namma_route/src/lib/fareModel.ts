import type { RouteOption, RoutePlanResult } from "../components/NearbyStopsMap/NearbyStopsMap";
import type { SupportedLanguage } from "../components/LanguageSelector";
import { getMetroTripSuggestion, haversineKm, type LatLng } from "./metroNetwork";

export type BusServiceType = "non_ac" | "ac";
export type ComparisonModeId = "bus_non_ac" | "bus_ac" | "metro" | "uber" | "namma_yatri";

const BUS_NON_AC_RATE_PER_KM = 3;
const BUS_NON_AC_MIN_FARE = 6;
const UBER_BASE_FARE = 55;
const UBER_RATE_PER_KM = 18;
const NAMMA_YATRI_BASE_FARE = 40;
const NAMMA_YATRI_RATE_PER_KM = 16;

function roundCurrency(amount: number) {
  return Math.max(0, Math.round(amount));
}

function toLatLng(point: LatLng) {
  return { lat: point.lat, lng: point.lng };
}

export function getBusServiceType(routeName: string | null | undefined): BusServiceType {
  const normalized = routeName?.trim().toUpperCase() ?? "";
  if (normalized.includes("AC") || normalized.startsWith("KIA") || normalized.startsWith("V-")) {
    return "ac";
  }
  return "non_ac";
}

export function getBusServiceTypeLabel(serviceType: BusServiceType, language: SupportedLanguage) {
  if (language === "kn") {
    return serviceType === "ac" ? "AC service" : "Non-AC service";
  }
  return serviceType === "ac" ? "AC service" : "Non-AC service";
}

export function getBusFareRate(serviceType: BusServiceType) {
  return serviceType === "ac" ? 5 : BUS_NON_AC_RATE_PER_KM;
}

function estimateNonAcBusFare(distanceKm: number) {
  if (distanceKm <= 2) return 6;
  if (distanceKm <= 4) return 12;
  if (distanceKm <= 6) return 18;
  if (distanceKm <= 14) return 23;
  if (distanceKm <= 40) return 29;
  return 32;
}

function estimateAcBusFare(distanceKm: number) {
  if (distanceKm <= 2) return 10;
  if (distanceKm <= 4) return 15;
  if (distanceKm <= 6) return 20;
  if (distanceKm <= 10) return 25;
  if (distanceKm <= 14) return 30;
  if (distanceKm <= 22) return 35;
  if (distanceKm <= 30) return 40;
  if (distanceKm <= 40) return 45;
  return 50;
}

export function estimateBusFare(distanceKm: number, serviceType: BusServiceType) {
  if (serviceType === "ac") {
    return estimateAcBusFare(distanceKm);
  }

  return roundCurrency(Math.max(BUS_NON_AC_MIN_FARE, estimateNonAcBusFare(distanceKm)));
}

export function estimateUberFare(distanceKm: number) {
  return roundCurrency(UBER_BASE_FARE + distanceKm * UBER_RATE_PER_KM);
}

export function estimateNammaYatriFare(distanceKm: number) {
  return roundCurrency(NAMMA_YATRI_BASE_FARE + distanceKm * NAMMA_YATRI_RATE_PER_KM);
}

export function estimateMetroFare(distanceKm: number, isStudent: boolean, isSenior: boolean) {
  const base = distanceKm <= 2 ? 10 : distanceKm <= 4 ? 15 : distanceKm <= 8 ? 20 : distanceKm <= 15 ? 30 : 40;
  if (isStudent) return roundCurrency(base * 0.75);
  if (isSenior) return roundCurrency(base * 0.85);
  return base;
}

export function getRoutePathDistanceKm(path: LatLng[]) {
  let totalKm = 0;

  for (let index = 1; index < path.length; index += 1) {
    totalKm += haversineKm(toLatLng(path[index - 1]), toLatLng(path[index]));
  }

  return totalKm;
}

export function getRouteOptionDistanceKm(routePlan: RoutePlanResult["routePlan"], option: RouteOption) {
  if (!routePlan) return null;

  const pathKm = getRoutePathDistanceKm(option.path);
  const totalKm = pathKm + (routePlan.walk_to_stop_m + routePlan.walk_from_stop_m) / 1000;
  return Number(totalKm.toFixed(1));
}

export function getSelectedRouteDistanceKm(routeResult: RoutePlanResult | null, selectedRouteName: string | null) {
  if (!routeResult?.routePlan) return null;
  const options = routeResult.routePlan.route_options ?? [];
  const selectedRoute =
    (selectedRouteName ? options.find((option) => option.route_name === selectedRouteName) : null) ??
    routeResult.routePlan.selected_route ??
    options[0] ??
    null;

  if (!selectedRoute) return null;
  return getRouteOptionDistanceKm(routeResult.routePlan, selectedRoute);
}

export function getDirectTripDistanceKm(routeResult: RoutePlanResult | null) {
  const from = routeResult?.tripCoords?.from;
  const to = routeResult?.tripCoords?.to;
  if (!from || !to) return null;
  return Number(haversineKm(from, to).toFixed(1));
}

export function getRoadRideDistanceKm(routeResult: RoutePlanResult | null, selectedRouteName: string | null) {
  const directDistanceKm = getDirectTripDistanceKm(routeResult);
  const routeDistanceKm = getSelectedRouteDistanceKm(routeResult, selectedRouteName);

  if (directDistanceKm != null) {
    return Number(Math.max(directDistanceKm * 1.2, routeDistanceKm ?? 0).toFixed(1));
  }

  return routeDistanceKm;
}

export function getMetroSuggestion(routeResult: RoutePlanResult | null) {
  const from = routeResult?.tripCoords?.from;
  const to = routeResult?.tripCoords?.to;

  if (!from || !to) {
    const fallbackFrom = routeResult?.routePlan?.origin_stop;
    const fallbackTo = routeResult?.routePlan?.destination_stop;
    if (!fallbackFrom || !fallbackTo) return null;
    return getMetroTripSuggestion(fallbackFrom, fallbackTo);
  }

  return getMetroTripSuggestion(from, to);
}

export function getComparisonRateLabel(modeId: ComparisonModeId, language: SupportedLanguage) {
  switch (modeId) {
    case "bus_non_ac":
      return language === "kn"
        ? "BMTC stage fare estimate: starts at Rs 6 for 2 km"
        : "BMTC stage fare estimate: starts at Rs 6 for 2 km";
    case "bus_ac":
      return language === "kn"
        ? "Vajra stage fare estimate: Rs 10 for first 2 km"
        : "Vajra stage fare estimate: Rs 10 for first 2 km";
    case "metro":
      return language === "kn" ? "Metro slab fare" : "Metro slab fare";
    case "uber":
      return language === "kn" ? "Base Rs 55 + Rs 18 per km" : "Base Rs 55 + Rs 18 per km";
    case "namma_yatri":
      return language === "kn" ? "Base Rs 40 + Rs 16 per km" : "Base Rs 40 + Rs 16 per km";
    default:
      return "";
  }
}

export function getShaktiSchemeText(language: SupportedLanguage) {
  if (language === "kn") {
    return "Shakti scheme: eligible women pay Rs 0 on Non-AC BMTC";
  }
  return "Shakti scheme: eligible women pay Rs 0 on Non-AC BMTC";
}
