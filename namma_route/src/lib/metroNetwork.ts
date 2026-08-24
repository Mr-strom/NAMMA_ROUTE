export type MetroLineId = "purple" | "green";

export type LatLng = {
  lat: number;
  lng: number;
};

export type MetroStation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  lines: MetroLineId[];
};

export type MetroLine = {
  id: MetroLineId;
  name: string;
  color: string;
  stationIds: string[];
};

type MetroEdge = {
  to: string;
  distanceKm: number;
  lineId: MetroLineId;
};

type PathResult = {
  pathIds: string[];
  edgeLineIds: MetroLineId[];
  distanceKm: number;
};

export type MetroTripSuggestion = {
  originStation: MetroStation;
  destinationStation: MetroStation;
  stationPath: MetroStation[];
  edgeLineIds: MetroLineId[];
  rideDistanceKm: number;
  accessWalkingMetres: number;
  egressWalkingMetres: number;
  lineSummary: string;
};

export const METRO_STATIONS: MetroStation[] = [
  { id: "kengeri", name: "Kengeri", lat: 12.9112, lng: 77.4841, lines: ["purple"] },
  { id: "majestic", name: "Majestic", lat: 12.9767, lng: 77.5713, lines: ["purple", "green"] },
  { id: "mg-road", name: "MG Road", lat: 12.9757, lng: 77.6011, lines: ["purple"] },
  { id: "indiranagar", name: "Indiranagar", lat: 12.9784, lng: 77.6408, lines: ["purple"] },
  { id: "whitefield", name: "Whitefield", lat: 12.9698, lng: 77.7499, lines: ["purple"] },
  { id: "yeshwanthpur", name: "Yeshwanthpur", lat: 13.0277, lng: 77.5391, lines: ["green"] },
  { id: "jayanagar", name: "Jayanagar", lat: 12.93, lng: 77.5833, lines: ["green"] },
  { id: "banashankari", name: "Banashankari", lat: 12.9253, lng: 77.5468, lines: ["green"] },
];

export const METRO_LINES: MetroLine[] = [
  {
    id: "purple",
    name: "Purple Line",
    color: "#7c3aed",
    stationIds: ["kengeri", "majestic", "mg-road", "indiranagar", "whitefield"],
  },
  {
    id: "green",
    name: "Green Line",
    color: "#16a34a",
    stationIds: ["yeshwanthpur", "majestic", "jayanagar", "banashankari"],
  },
];

const METRO_STATION_BY_ID = new Map(METRO_STATIONS.map((station) => [station.id, station]));
const EDGE_MAP = buildEdgeMap();

function buildEdgeMap() {
  const graph = new Map<string, MetroEdge[]>();

  for (const line of METRO_LINES) {
    for (let index = 1; index < line.stationIds.length; index += 1) {
      const from = METRO_STATION_BY_ID.get(line.stationIds[index - 1]);
      const to = METRO_STATION_BY_ID.get(line.stationIds[index]);
      if (!from || !to) continue;

      const distanceKm = haversineKm(from, to);
      const edge: MetroEdge = { to: to.id, distanceKm, lineId: line.id };
      const reverseEdge: MetroEdge = { to: from.id, distanceKm, lineId: line.id };

      graph.set(from.id, [...(graph.get(from.id) ?? []), edge]);
      graph.set(to.id, [...(graph.get(to.id) ?? []), reverseEdge]);
    }
  }

  return graph;
}

export function haversineKm(from: LatLng, to: LatLng) {
  const earthRadiusKm = 6371;
  const radians = Math.PI / 180;
  const a =
    0.5 -
    Math.cos((to.lat - from.lat) * radians) / 2 +
    (Math.cos(from.lat * radians) *
      Math.cos(to.lat * radians) *
      (1 - Math.cos((to.lng - from.lng) * radians))) /
      2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

export function getMetroLineName(lineId: MetroLineId) {
  return METRO_LINES.find((line) => line.id === lineId)?.name ?? lineId;
}

export function getNearestMetroStation(point: LatLng) {
  let nearest: MetroStation | null = null;
  let nearestDistanceKm = Number.POSITIVE_INFINITY;

  for (const station of METRO_STATIONS) {
    const distanceKm = haversineKm(point, station);
    if (distanceKm < nearestDistanceKm) {
      nearest = station;
      nearestDistanceKm = distanceKm;
    }
  }

  if (!nearest || !Number.isFinite(nearestDistanceKm)) return null;

  return {
    station: nearest,
    distanceMetres: Math.round(nearestDistanceKm * 1000),
  };
}

function getShortestPath(startId: string, endId: string): PathResult | null {
  if (startId === endId) {
    return {
      pathIds: [startId],
      edgeLineIds: [],
      distanceKm: 0,
    };
  }

  const distances = new Map<string, number>();
  const previous = new Map<string, { stationId: string; lineId: MetroLineId }>();
  const queue = new Set<string>(METRO_STATIONS.map((station) => station.id));

  for (const station of METRO_STATIONS) {
    distances.set(station.id, station.id === startId ? 0 : Number.POSITIVE_INFINITY);
  }

  while (queue.size > 0) {
    let currentId: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;

    for (const stationId of queue) {
      const distance = distances.get(stationId) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) {
        currentDistance = distance;
        currentId = stationId;
      }
    }

    if (!currentId || !Number.isFinite(currentDistance)) break;
    if (currentId === endId) break;

    queue.delete(currentId);

    for (const edge of EDGE_MAP.get(currentId) ?? []) {
      if (!queue.has(edge.to)) continue;
      const nextDistance = currentDistance + edge.distanceKm;
      if (nextDistance < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        distances.set(edge.to, nextDistance);
        previous.set(edge.to, { stationId: currentId, lineId: edge.lineId });
      }
    }
  }

  const totalDistance = distances.get(endId);
  if (totalDistance == null || !Number.isFinite(totalDistance)) return null;

  const pathIds: string[] = [endId];
  const edgeLineIds: MetroLineId[] = [];
  let currentId = endId;

  while (currentId !== startId) {
    const prev = previous.get(currentId);
    if (!prev) return null;
    pathIds.unshift(prev.stationId);
    edgeLineIds.unshift(prev.lineId);
    currentId = prev.stationId;
  }

  return {
    pathIds,
    edgeLineIds,
    distanceKm: totalDistance,
  };
}

function buildLineSummary(edgeLineIds: MetroLineId[]) {
  if (edgeLineIds.length === 0) return "Single-station access";

  const uniqueLineIds = edgeLineIds.filter((lineId, index) => edgeLineIds.indexOf(lineId) === index);
  if (uniqueLineIds.length === 1) {
    return getMetroLineName(uniqueLineIds[0]);
  }

  return `${uniqueLineIds.map(getMetroLineName).join(" + ")} via Majestic`;
}

export function getMetroTripSuggestion(from: LatLng, to: LatLng): MetroTripSuggestion | null {
  const nearestOrigin = getNearestMetroStation(from);
  const nearestDestination = getNearestMetroStation(to);
  if (!nearestOrigin || !nearestDestination) return null;

  const shortestPath = getShortestPath(nearestOrigin.station.id, nearestDestination.station.id);
  if (!shortestPath) return null;

  const stationPath = shortestPath.pathIds
    .map((stationId) => METRO_STATION_BY_ID.get(stationId))
    .filter((station): station is MetroStation => Boolean(station));

  return {
    originStation: nearestOrigin.station,
    destinationStation: nearestDestination.station,
    stationPath,
    edgeLineIds: shortestPath.edgeLineIds,
    rideDistanceKm: Number(shortestPath.distanceKm.toFixed(1)),
    accessWalkingMetres: nearestOrigin.distanceMetres,
    egressWalkingMetres: nearestDestination.distanceMetres,
    lineSummary: buildLineSummary(shortestPath.edgeLineIds),
  };
}
