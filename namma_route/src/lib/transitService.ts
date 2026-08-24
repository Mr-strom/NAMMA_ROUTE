const DEFAULT_API_BASE = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:8000";
const LOCAL_ROUTE_SEARCH_LIMIT = 20;

type BackendMode = "unknown" | "online" | "offline";

type RawStop = {
  stop_id: string;
  stop_name: string;
  lat: number;
  lng: number;
  routes: string[];
};

type RawRoute = {
  route_id: string;
  route_name: string;
};

type StopTimesMap = Record<string, string[]>;

export type TransitStop = {
  stop_id: string;
  stop_name: string;
  lat: number;
  lng: number;
  routes: string[];
  distance_metres: number;
};

export type TransitRouteOption = {
  route_name: string;
  route_id: string;
  trip_id: string;
  boarding_stop: TransitStop;
  alighting_stop: TransitStop;
  stop_count: number;
  path: Array<{ lat: number; lng: number }>;
  segment_stops: Array<{
    stop_id: string;
    stop_name: string;
    lat: number;
    lng: number;
  }>;
  score: number;
};

export type TransitRoutePlan = {
  origin_stop: TransitStop;
  destination_stop: TransitStop;
  common_routes: string[];
  route_options: TransitRouteOption[];
  selected_route: TransitRouteOption | null;
  walk_to_stop_m: number;
  walk_from_stop_m: number;
};

let stopsPromise: Promise<RawStop[]> | null = null;
let routesPromise: Promise<RawRoute[]> | null = null;
let stopTimesPromise: Promise<StopTimesMap> | null = null;
let routeNameToIdsPromise: Promise<Map<string, string[]>> | null = null;
let backendMode: BackendMode = "unknown";

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = 6371000;
  const p = Math.PI / 180;
  const a =
    0.5 -
    Math.cos((lat2 - lat1) * p) / 2 +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) * (1 - Math.cos((lng2 - lng1) * p)) / 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(a)));
}

async function loadStops() {
  if (!stopsPromise) {
    stopsPromise = import("../../backend/data/stops_clean.json").then((module) => module.default as RawStop[]);
  }
  return stopsPromise;
}

async function loadRoutes() {
  if (!routesPromise) {
    routesPromise = import("../../backend/data/routes_clean.json").then((module) => module.default as RawRoute[]);
  }
  return routesPromise;
}

async function loadStopTimes() {
  if (!stopTimesPromise) {
    stopTimesPromise = import("../../backend/data/stop_times_clean.json").then((module) => module.default as StopTimesMap);
  }
  return stopTimesPromise;
}

async function loadRouteNameToIds() {
  if (!routeNameToIdsPromise) {
    routeNameToIdsPromise = loadRoutes().then((routes) => {
      const map = new Map<string, string[]>();
      routes.forEach((route) => {
        const existing = map.get(route.route_name) ?? [];
        existing.push(route.route_id);
        map.set(route.route_name, existing);
      });
      return map;
    });
  }
  return routeNameToIdsPromise;
}

async function fetchBackend<T>(path: string, apiBase = DEFAULT_API_BASE): Promise<T> {
  if (backendMode === "offline") {
    throw new Error(`Backend unavailable: ${path}`);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`);
  } catch {
    backendMode = "offline";
    throw new Error(`Backend unreachable: ${path}`);
  }

  if (!response.ok) {
    backendMode = "offline";
    throw new Error(`Backend request failed: ${path}`);
  }
  backendMode = "online";
  return (await response.json()) as T;
}

function withDistance(stop: RawStop, lat: number, lng: number): TransitStop {
  return {
    stop_id: stop.stop_id,
    stop_name: stop.stop_name,
    lat: stop.lat,
    lng: stop.lng,
    routes: stop.routes ?? [],
    distance_metres: haversine(lat, lng, stop.lat, stop.lng),
  };
}

function buildFallbackPath(originStop: TransitStop, destinationStop: TransitStop) {
  const midLat = Number(((originStop.lat + destinationStop.lat) / 2).toFixed(6));
  const midLng = Number(((originStop.lng + destinationStop.lng) / 2).toFixed(6));
  return [
    { lat: originStop.lat, lng: originStop.lng },
    { lat: midLat, lng: midLng },
    { lat: destinationStop.lat, lng: destinationStop.lng },
  ];
}

async function getNearbyStopsLocal(lat: number, lng: number, limit: number) {
  const stops = await loadStops();
  return stops
    .map((stop) => withDistance(stop, lat, lng))
    .sort((left, right) => left.distance_metres - right.distance_metres)
    .slice(0, limit);
}

function rankStopMatch(stop: RawStop, queryNorm: string) {
  const stopNameNorm = normalizeSearchText(stop.stop_name);
  const stopIdNorm = stop.stop_id.toLowerCase();

  if (queryNorm === stopNameNorm || queryNorm === stopIdNorm) return 0;
  if (stopNameNorm.startsWith(queryNorm)) return 1;
  if (stopNameNorm.split(" ").some((part) => part.startsWith(queryNorm))) return 2;
  if (stopNameNorm.includes(queryNorm) || stopIdNorm.includes(queryNorm)) return 3;
  return null;
}

async function searchStopsLocal(query: string, limit: number) {
  const queryNorm = normalizeSearchText(query);
  if (!queryNorm) return [];
  const stops = await loadStops();

  return stops
    .map((stop) => {
      const rank = rankStopMatch(stop, queryNorm);
      if (rank == null) return null;
      return {
        rank,
        stop,
      };
    })
    .filter((item): item is { rank: number; stop: RawStop } => item != null)
    .sort((left, right) => {
      const leftName = normalizeSearchText(left.stop.stop_name);
      const rightName = normalizeSearchText(right.stop.stop_name);
      return (
        left.rank - right.rank ||
        leftName.length - rightName.length ||
        right.stop.routes.length - left.stop.routes.length ||
        leftName.localeCompare(rightName)
      );
    })
    .slice(0, limit)
    .map((item) => ({
      stop_id: item.stop.stop_id,
      stop_name: item.stop.stop_name,
      lat: item.stop.lat,
      lng: item.stop.lng,
      routes: item.stop.routes ?? [],
    }));
}

async function lookupStopLocal(query: string) {
  const results = await searchStopsLocal(query, 1);
  return results[0] ?? null;
}

async function getStopTimesLocal(stopId: string, limit: number) {
  const stopTimes = await loadStopTimes();
  return (stopTimes[stopId] ?? []).slice(0, limit);
}

async function buildRoutePlanLocal(fromLat: number, fromLng: number, toLat: number, toLng: number): Promise<TransitRoutePlan> {
  const [originStops, destinationStops, routeNameToIds] = await Promise.all([
    getNearbyStopsLocal(fromLat, fromLng, LOCAL_ROUTE_SEARCH_LIMIT),
    getNearbyStopsLocal(toLat, toLng, LOCAL_ROUTE_SEARCH_LIMIT),
    loadRouteNameToIds(),
  ]);

  const routeOptions: TransitRouteOption[] = [];
  const seenRouteNames = new Set<string>();

  originStops.forEach((originStop) => {
    destinationStops.forEach((destinationStop) => {
      const commonRoutes = [...new Set(originStop.routes.filter((route) => destinationStop.routes.includes(route)))].sort();
      commonRoutes.forEach((routeName) => {
        if (seenRouteNames.has(routeName)) return;
        seenRouteNames.add(routeName);

        const directDistanceKm = haversine(originStop.lat, originStop.lng, destinationStop.lat, destinationStop.lng) / 1000;
        const stopCount = Math.max(1, Math.round(directDistanceKm * 1.9));
        const routeId = routeNameToIds.get(routeName)?.[0] ?? routeName;
        const score = originStop.distance_metres + destinationStop.distance_metres + stopCount * 12;

        routeOptions.push({
          route_name: routeName,
          route_id: routeId,
          trip_id: `fallback-${routeId}`,
          boarding_stop: originStop,
          alighting_stop: destinationStop,
          stop_count: stopCount,
          path: buildFallbackPath(originStop, destinationStop),
          segment_stops: [
            {
              stop_id: originStop.stop_id,
              stop_name: originStop.stop_name,
              lat: originStop.lat,
              lng: originStop.lng,
            },
            {
              stop_id: destinationStop.stop_id,
              stop_name: destinationStop.stop_name,
              lat: destinationStop.lat,
              lng: destinationStop.lng,
            },
          ],
          score,
        });
      });
    });
  });

  routeOptions.sort((left, right) => left.score - right.score);
  const selectedRoute = routeOptions[0] ?? null;
  const originStop = selectedRoute?.boarding_stop ?? originStops[0];
  const destinationStop = selectedRoute?.alighting_stop ?? destinationStops[0];

  return {
    origin_stop: originStop,
    destination_stop: destinationStop,
    common_routes: routeOptions.map((option) => option.route_name),
    route_options: routeOptions.slice(0, 5),
    selected_route: selectedRoute,
    walk_to_stop_m: originStop.distance_metres,
    walk_from_stop_m: destinationStop.distance_metres,
  };
}

export async function checkTransitServiceHealth(apiBase = DEFAULT_API_BASE) {
  try {
    await fetchBackend<{ status: string }>("/health", apiBase);
    backendMode = "online";
    return true;
  } catch {
    try {
      const stops = await loadStops();
      backendMode = stops.length > 0 ? "offline" : "unknown";
      return stops.length > 0;
    } catch {
      backendMode = "unknown";
      return false;
    }
  }
}

export async function getNearbyStops(lat: number, lng: number, limit = 4, apiBase = DEFAULT_API_BASE) {
  try {
    const payload = await fetchBackend<{ stops: TransitStop[] }>(`/nearby-stops?lat=${lat}&lng=${lng}&limit=${limit}`, apiBase);
    return payload.stops;
  } catch {
    return getNearbyStopsLocal(lat, lng, limit);
  }
}

export async function lookupStop(query: string, apiBase = DEFAULT_API_BASE) {
  try {
    const payload = await fetchBackend<{ stop: Omit<TransitStop, "distance_metres"> | null }>(
      `/stop-lookup?q=${encodeURIComponent(query)}`,
      apiBase
    );
    return payload.stop;
  } catch {
    return lookupStopLocal(query);
  }
}

export async function searchStops(query: string, limit = 8, apiBase = DEFAULT_API_BASE) {
  try {
    const payload = await fetchBackend<{ stops: Array<Omit<TransitStop, "distance_metres">> }>(
      `/stop-search?q=${encodeURIComponent(query)}&limit=${limit}`,
      apiBase
    );
    return payload.stops;
  } catch {
    return searchStopsLocal(query, limit);
  }
}

export async function getStopTimes(stopId: string, limit = 5, apiBase = DEFAULT_API_BASE) {
  try {
    const payload = await fetchBackend<{ times?: string[] }>(`/stop-times?stop_id=${encodeURIComponent(stopId)}&limit=${limit}`, apiBase);
    return payload.times ?? [];
  } catch {
    return getStopTimesLocal(stopId, limit);
  }
}

export async function getRoutePlan(fromLat: number, fromLng: number, toLat: number, toLng: number, apiBase = DEFAULT_API_BASE) {
  try {
    return await fetchBackend<TransitRoutePlan>(
      `/route-plan?from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`,
      apiBase
    );
  } catch {
    return buildRoutePlanLocal(fromLat, fromLng, toLat, toLng);
  }
}
