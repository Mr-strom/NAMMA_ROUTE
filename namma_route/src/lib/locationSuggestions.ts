export type LocationSuggestion = {
  id: string;
  label: string;
  description: string;
  lat: number;
  lng: number;
  kind: "stop" | "landmark";
  stopId?: string;
  routes?: string[];
};

const LANDMARK_COORDINATES: Array<{ label: string; lat: number; lng: number }> = [
  { label: "Majestic", lat: 12.9767, lng: 77.5713 },
  { label: "Koramangala", lat: 12.9352, lng: 77.6245 },
  { label: "MG Road", lat: 12.9757, lng: 77.6011 },
  { label: "Whitefield", lat: 12.9698, lng: 77.7499 },
  { label: "Electronic City", lat: 12.8399, lng: 77.677 },
  { label: "Hebbal", lat: 13.0354, lng: 77.597 },
  { label: "BTM Layout", lat: 12.9166, lng: 77.6101 },
  { label: "Jayanagar", lat: 12.93, lng: 77.5833 },
  { label: "Indiranagar", lat: 12.9784, lng: 77.6408 },
  { label: "Marathahalli", lat: 12.9591, lng: 77.6974 },
  { label: "Silk Board", lat: 12.9172, lng: 77.6228 },
  { label: "KR Market", lat: 12.9674, lng: 77.5765 },
  { label: "Yeshwanthpur", lat: 13.0277, lng: 77.5391 },
  { label: "Banashankari", lat: 12.9253, lng: 77.5468 },
  { label: "Kengeri", lat: 12.9112, lng: 77.4841 },
  { label: "Shivajinagar", lat: 12.9833, lng: 77.6033 },
];

export const BENGALURU_LANDMARKS: LocationSuggestion[] = LANDMARK_COORDINATES.map((landmark) => ({
  id: `landmark-${landmark.label.toLowerCase().replace(/\s+/g, "-")}`,
  label: landmark.label,
  description: "Bengaluru landmark",
  lat: landmark.lat,
  lng: landmark.lng,
  kind: "landmark",
}));

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

export function findLandmarkCoordinates(input: string): [number, number] | null {
  const normalized = normalizeQuery(input);
  const landmark = BENGALURU_LANDMARKS.find((entry) => normalizeQuery(entry.label) === normalized);
  return landmark ? [landmark.lat, landmark.lng] : null;
}

export function searchLandmarks(query: string, limit = 5): LocationSuggestion[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  return BENGALURU_LANDMARKS.filter((entry) => {
    const label = normalizeQuery(entry.label);
    return label.startsWith(normalized) || label.includes(normalized);
  }).slice(0, limit);
}

export function makeStopSuggestion(stop: {
  stop_id: string;
  stop_name: string;
  lat: number;
  lng: number;
  routes?: string[];
}): LocationSuggestion {
  const routeCount = stop.routes?.length ?? 0;
  const routePreview = routeCount > 0 ? stop.routes?.slice(0, 3).join(", ") : "No route data";
  return {
    id: `stop-${stop.stop_id}`,
    label: stop.stop_name,
    description: routeCount > 0 ? `${routeCount} routes - ${routePreview}` : "BMTC stop",
    lat: stop.lat,
    lng: stop.lng,
    kind: "stop",
    stopId: stop.stop_id,
    routes: stop.routes ?? [],
  };
}
