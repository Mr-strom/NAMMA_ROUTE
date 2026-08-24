import { type Dispatch, type SetStateAction, useEffect, useEffectEvent, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

import { estimateBusFare, estimateNammaYatriFare, getBusServiceType, getRouteOptionDistanceKm } from "../../lib/fareModel";
import { findLandmarkCoordinates, type LocationSuggestion } from "../../lib/locationSuggestions";
import { getMetroTripSuggestion, METRO_LINES, METRO_STATIONS } from "../../lib/metroNetwork";
import { getNearbyStops, getRoutePlan, getStopTimes, lookupStop } from "../../lib/transitService";
import "./NearbyStopsMap.css";

export type BusStop = {
  stop_id: string;
  stop_name: string;
  lat: number;
  lng: number;
  distance_metres: number;
  routes: string[];
};

export type RoutePathPoint = {
  lat: number;
  lng: number;
};

export type RouteOption = {
  route_name: string;
  route_id: string;
  trip_id: string;
  boarding_stop: BusStop;
  alighting_stop: BusStop;
  stop_count: number;
  path: RoutePathPoint[];
  segment_stops: Array<{
    stop_id: string;
    stop_name: string;
    lat: number;
    lng: number;
  }>;
  score: number;
};

export type TripCoords = {
  from: RoutePathPoint;
  to: RoutePathPoint;
};

export type RoutePlanResult = {
  routePlan: {
    origin_stop: BusStop;
    destination_stop: BusStop;
    common_routes: string[];
    route_options?: RouteOption[];
    selected_route?: RouteOption | null;
    walk_to_stop_m: number;
    walk_from_stop_m: number;
  } | null;
  stopTimes: string[];
  fareEstimate: number | null;
  autoEstimate: number | null;
  tripCoords?: TripCoords | null;
  error?: string | null;
};

type NearbyStopsMapProps = {
  fromPlace: string;
  toPlace: string;
  fromSelection?: LocationSuggestion | null;
  toSelection?: LocationSuggestion | null;
  routeRequestId: number;
  selectedRouteName?: string | null;
  onRoutePlanReady: (payload: RoutePlanResult) => void;
  gpsCoords?: { lat: number; lng: number } | null;
};

delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const API_BASE = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:8000";

function coordinatesMatch(left: [number, number] | null, right: [number, number] | null) {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return left[0] === right[0] && left[1] === right[1];
}

function updateCoords(
  setter: Dispatch<SetStateAction<[number, number] | null>>,
  nextValue: [number, number] | null
) {
  setter((currentValue) => (coordinatesMatch(currentValue, nextValue) ? currentValue : nextValue));
}

function resolveDestination(input: string): [number, number] | null {
  return findLandmarkCoordinates(input);
}

async function lookupStopCoordinates(place: string): Promise<[number, number] | null> {
  const query = place.trim();
  if (!query) return null;

  try {
    const stop = await lookupStop(query, API_BASE);
    if (!stop) return null;
    return [stop.lat, stop.lng];
  } catch {
    return null;
  }
}

function makeBusIcon(index: number) {
  return L.divIcon({
    className: "",
    html: `<div class="pin-drop" style="
      width:30px; height:30px; background:hsl(var(--primary)); color:white;
      border-radius:50% 50% 50% 0; transform:rotate(-45deg);
      display:flex; align-items:center; justify-content:center;
      border:2px solid white; box-shadow:0 2px 8px rgba(0,0,0,0.25);
      animation-delay:${index * 0.15}s;
    ">
      <span style="transform:rotate(45deg); font-size:12px; font-weight:700">
        ${index + 1}
      </span>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}

const userIcon = L.divIcon({
  className: "",
  html: '<div class="user-dot"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const destIcon = L.divIcon({
  className: "",
  html: `<div style="
    width:20px; height:20px; background:hsl(var(--success));
    border:3px solid white; border-radius:4px;
    box-shadow:0 2px 8px rgba(0,0,0,0.25);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function MapViewportController({
  originCoords,
  destinationCoords,
  routeLine,
  metroRouteLine,
  metroAccessLines,
  visibleStops,
}: {
  originCoords: [number, number] | null;
  destinationCoords: [number, number] | null;
  routeLine: [number, number][] | null;
  metroRouteLine: [number, number][] | null;
  metroAccessLines: [number, number][][];
  visibleStops: BusStop[];
}) {
  const map = useMap();

  useEffect(() => {
    const timedRefresh = window.setTimeout(() => {
      map.invalidateSize();
    }, 40);

    const points: [number, number][] = [];

    if (originCoords) points.push(originCoords);
    if (destinationCoords) points.push(destinationCoords);
    if (routeLine) points.push(...routeLine);
    if (metroRouteLine) points.push(...metroRouteLine);
    metroAccessLines.forEach((line) => points.push(...line));
    visibleStops.forEach((stop) => points.push([stop.lat, stop.lng]));

    const uniquePoints = points.filter(
      (point, index) => points.findIndex((candidate) => candidate[0] === point[0] && candidate[1] === point[1]) === index
    );

    if (uniquePoints.length >= 2) {
      map.fitBounds(L.latLngBounds(uniquePoints), {
        padding: [36, 36],
        maxZoom: 14,
      });
    } else if (uniquePoints.length === 1) {
      map.setView(uniquePoints[0], 14, { animate: true });
    }

    return () => window.clearTimeout(timedRefresh);
  }, [map, destinationCoords, metroAccessLines, metroRouteLine, originCoords, routeLine, visibleStops]);

  return null;
}

export default function NearbyStopsMap({
  fromPlace,
  toPlace,
  fromSelection,
  toSelection,
  routeRequestId,
  selectedRouteName,
  onRoutePlanReady,
  gpsCoords,
}: NearbyStopsMapProps) {
  const emitRoutePlanReady = useEffectEvent(onRoutePlanReady);
  const resolvedFrom = useMemo(() => resolveDestination(fromPlace), [fromPlace]);
  const resolvedTo = useMemo(() => resolveDestination(toPlace), [toPlace]);
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(
    (fromSelection ? [fromSelection.lat, fromSelection.lng] : null) ?? resolvedFrom ?? (gpsCoords ? [gpsCoords.lat, gpsCoords.lng] : null)
  );
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(
    (toSelection ? [toSelection.lat, toSelection.lng] : null) ?? resolvedTo
  );
  const [stops, setStops] = useState<BusStop[]>([]);
  const [loadingStops, setLoadingStops] = useState(true);
  const [stopsError, setStopsError] = useState<string | null>(null);
  const [routePlan, setRoutePlan] = useState<RoutePlanResult["routePlan"]>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (fromSelection) {
      updateCoords(setOriginCoords, [fromSelection.lat, fromSelection.lng]);
      return;
    }
    if (resolvedFrom) {
      updateCoords(setOriginCoords, resolvedFrom);
      return;
    }
    if (!fromPlace.trim()) {
      updateCoords(setOriginCoords, gpsCoords ? [gpsCoords.lat, gpsCoords.lng] : null);
    }
  }, [fromPlace, fromSelection, gpsCoords, resolvedFrom]);

  useEffect(() => {
    if (!resolvedFrom && gpsCoords) updateCoords(setOriginCoords, [gpsCoords.lat, gpsCoords.lng]);
  }, [gpsCoords, resolvedFrom]);

  useEffect(() => {
    if (toSelection) {
      updateCoords(setDestinationCoords, [toSelection.lat, toSelection.lng]);
      return;
    }
    if (resolvedTo) {
      updateCoords(setDestinationCoords, resolvedTo);
      return;
    }
    if (!toPlace.trim()) {
      updateCoords(setDestinationCoords, null);
    }
  }, [resolvedTo, toPlace, toSelection]);

  useEffect(() => {
    let cancelled = false;

    async function loadNearby() {
      setLoadingStops(true);
      setStopsError(null);

      try {
        if (originCoords) {
          const [lat, lng] = originCoords;
          const nearby = await getNearbyStops(lat, lng, 4, API_BASE);
          if (!cancelled) setStops(nearby as BusStop[]);
          if (!cancelled) setLoadingStops(false);
          return;
        }

        if (!navigator.geolocation) {
          setStopsError("Geolocation is not supported by your browser.");
          setLoadingStops(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            updateCoords(setOriginCoords, [lat, lng]);

            try {
              const nearby = await getNearbyStops(lat, lng, 4, API_BASE);
              if (!cancelled) setStops(nearby as BusStop[]);
            } catch {
              if (!cancelled) {
                setStopsError("Could not load nearby stops.");
              }
            } finally {
              if (!cancelled) setLoadingStops(false);
            }
          },
          () => {
            setStopsError("Location access was denied. Please allow location or type a known landmark in From/To.");
            setLoadingStops(false);
          }
        );
      } catch {
        if (!cancelled) {
          setStopsError("Could not load nearby stops.");
          setLoadingStops(false);
        }
      }
    }

    void loadNearby();
    return () => {
      cancelled = true;
    };
  }, [originCoords]);

  useEffect(() => {
    let cancelled = false;

    async function planRoute() {
      if (!routeRequestId) return;

      const hasTypedOrigin = fromPlace.trim().length > 0;
      const selectedFromCoords = fromSelection ? ([fromSelection.lat, fromSelection.lng] as [number, number]) : null;
      const selectedToCoords = toSelection ? ([toSelection.lat, toSelection.lng] as [number, number]) : null;

      const lookedUpTo = selectedToCoords ? null : await lookupStopCoordinates(toPlace);
      if (cancelled) return;
      const toCoords = selectedToCoords ?? lookedUpTo ?? resolvedTo ?? destinationCoords;
      if (toPlace.trim() && !toCoords) {
        emitRoutePlanReady({
          routePlan: null,
          stopTimes: [],
          fareEstimate: null,
          autoEstimate: null,
          tripCoords: null,
          error: "Destination was not recognized. Pick a stop from the dropdown or type a Bengaluru landmark like Majestic or MG Road.",
        });
        return;
      }

      const lookedUpFrom = hasTypedOrigin && !selectedFromCoords ? await lookupStopCoordinates(fromPlace) : null;
      if (cancelled) return;
      const fromCoords = selectedFromCoords ?? lookedUpFrom ?? resolvedFrom ?? (!hasTypedOrigin ? originCoords : null);
      if (hasTypedOrigin && !fromCoords) {
        emitRoutePlanReady({
          routePlan: null,
          stopTimes: [],
          fareEstimate: null,
          autoEstimate: null,
          tripCoords: null,
          error: "Source was not recognized. Pick a stop from the dropdown or use the current-location button.",
        });
        return;
      }
      if (!fromCoords) {
        emitRoutePlanReady({
          routePlan: null,
          stopTimes: [],
          fareEstimate: null,
          autoEstimate: null,
          tripCoords: null,
          error: "Origin location is not ready yet. Allow GPS or pick a stop from the source search.",
        });
        return;
      }

      if (!toCoords) {
        return;
      }

      const [fromLat, fromLng] = fromCoords;
      const [toLat, toLng] = toCoords;
      updateCoords(setOriginCoords, fromCoords);
      updateCoords(setDestinationCoords, toCoords);

      try {
        const data = (await getRoutePlan(fromLat, fromLng, toLat, toLng, API_BASE)) as NonNullable<RoutePlanResult["routePlan"]>;
        if (cancelled) return;
        setRoutePlan(data);
        setDrawerOpen(true);

        const stopId = data?.origin_stop?.stop_id;
        let stopTimes: string[] = [];

        if (stopId) {
          stopTimes = await getStopTimes(stopId, 5, API_BASE);
        }
        if (cancelled) return;

        const selectedRoute = data?.selected_route ?? data?.route_options?.[0] ?? null;
        const selectedDistanceKm = selectedRoute ? getRouteOptionDistanceKm(data, selectedRoute) : null;
        const selectedRouteType = getBusServiceType(selectedRoute?.route_name);
        const fareEstimate = selectedDistanceKm == null ? null : estimateBusFare(selectedDistanceKm, selectedRouteType);
        const autoEstimate =
          selectedDistanceKm == null
            ? null
            : estimateNammaYatriFare(Math.max(1, Number((selectedDistanceKm * 0.9).toFixed(1))));

        emitRoutePlanReady({
          routePlan: data,
          stopTimes,
          fareEstimate,
          autoEstimate,
          tripCoords: {
            from: { lat: fromLat, lng: fromLng },
            to: { lat: toLat, lng: toLng },
          },
          error: null,
        });
      } catch {
        if (cancelled) return;
        setRoutePlan(null);
        emitRoutePlanReady({
          routePlan: null,
          stopTimes: [],
          fareEstimate: null,
          autoEstimate: null,
          tripCoords: null,
          error: "Could not build route data right now. Try another source/destination pair.",
        });
      }
    }

    void planRoute();
    return () => {
      cancelled = true;
    };
  }, [routeRequestId, resolvedFrom, resolvedTo, originCoords, destinationCoords, fromPlace, toPlace, fromSelection, toSelection]);

  const defaultCenter: [number, number] = [12.9716, 77.5946];

  const selectedRouteOption = useMemo(() => {
    if (!routePlan) return null;
    const options = routePlan.route_options ?? [];
    if (selectedRouteName) {
      return options.find((option) => option.route_name === selectedRouteName) ?? routePlan.selected_route ?? null;
    }
    return routePlan.selected_route ?? options[0] ?? null;
  }, [routePlan, selectedRouteName]);

  const routeLine: [number, number][] | null = selectedRouteOption?.path?.length
    ? selectedRouteOption.path.map((point) => [point.lat, point.lng] as [number, number])
    : routePlan
      ? [
          [routePlan.origin_stop.lat, routePlan.origin_stop.lng],
          [routePlan.destination_stop.lat, routePlan.destination_stop.lng],
        ]
      : null;

  const tripMetroSuggestion = useMemo(() => {
    const fromPoint = originCoords ? { lat: originCoords[0], lng: originCoords[1] } : null;
    const toPoint = destinationCoords ? { lat: destinationCoords[0], lng: destinationCoords[1] } : null;
    if (!fromPoint || !toPoint) return null;
    return getMetroTripSuggestion(fromPoint, toPoint);
  }, [destinationCoords, originCoords]);

  const metroRouteLine =
    tripMetroSuggestion && tripMetroSuggestion.stationPath.length > 1
      ? tripMetroSuggestion.stationPath.map((station) => [station.lat, station.lng] as [number, number])
      : null;

  const metroAccessLines =
    tripMetroSuggestion && originCoords && destinationCoords
      ? [
          [originCoords, [tripMetroSuggestion.originStation.lat, tripMetroSuggestion.originStation.lng] as [number, number]],
          [
            [tripMetroSuggestion.destinationStation.lat, tripMetroSuggestion.destinationStation.lng] as [number, number],
            destinationCoords,
          ],
        ]
      : [];

  const visibleStops = routePlan ? stops.slice(0, 2) : stops;
  const showLocationAccessNeeded =
    !!stopsError &&
    (stopsError.toLowerCase().includes("denied") ||
      stopsError.toLowerCase().includes("allow location") ||
      stopsError.toLowerCase().includes("permission"));

  return (
    <div className="map-wrapper">
      {showLocationAccessNeeded && (
        <div
          className="absolute left-3 top-3 z-[1100] rounded-xl border border-border bg-white/95 px-3 py-2 text-sm font-semibold text-red-700 shadow-sm"
          role="status"
        >
          Location access needed
        </div>
      )}

      <div className="map-legend" role="note" aria-label="Map legend">
        <div className="map-legend__title">Map layers</div>
        <div className="map-legend__item">
          <span className="map-legend__swatch map-legend__swatch--bus" />
          Bus route
        </div>
        <div className="map-legend__item">
          <span className="map-legend__swatch map-legend__swatch--metro" />
          Metro corridors
        </div>
        <div className="map-legend__item">
          <span className="map-legend__swatch map-legend__swatch--connector" />
          Metro access walk
        </div>
      </div>

      <MapContainer center={originCoords ?? destinationCoords ?? defaultCenter} zoom={13} zoomControl={false}>
        <MapViewportController
          originCoords={originCoords}
          destinationCoords={destinationCoords}
          routeLine={routeLine}
          metroRouteLine={metroRouteLine}
          metroAccessLines={metroAccessLines}
          visibleStops={visibleStops}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {METRO_LINES.map((line) => {
          const linePath = line.stationIds
            .map((stationId) => METRO_STATIONS.find((station) => station.id === stationId))
            .filter((station): station is (typeof METRO_STATIONS)[number] => Boolean(station))
            .map((station) => [station.lat, station.lng] as [number, number]);
          return (
            <Polyline
              key={line.id}
              positions={linePath}
              pathOptions={{ className: line.id === "purple" ? "metro-line-purple" : "metro-line-green" }}
            />
          );
        })}

        {originCoords && <Marker position={originCoords} icon={userIcon} />}
        {destinationCoords && <Marker position={destinationCoords} icon={destIcon} />}
        {routeLine && <Polyline positions={routeLine} pathOptions={{ className: "route-line" }} />}
        {metroRouteLine && <Polyline positions={metroRouteLine} pathOptions={{ className: "metro-route-line" }} />}
        {metroAccessLines.map((positions, index) => (
          <Polyline key={`metro-access-${index}`} positions={positions} pathOptions={{ className: "metro-access-line" }} />
        ))}

        {METRO_STATIONS.map((station) => (
          <CircleMarker
            key={station.id}
            center={[station.lat, station.lng]}
            radius={7}
            pathOptions={{
              color: station.lines.length > 1 ? "#0f172a" : "#ffffff",
              weight: 2,
              fillColor: station.lines.length > 1 ? "#f59e0b" : station.lines.includes("purple") ? "#7c3aed" : "#16a34a",
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <strong>{station.name}</strong>
              <br />
              {station.lines.map((lineId) => METRO_LINES.find((line) => line.id === lineId)?.name ?? lineId).join(" + ")}
            </Popup>
          </CircleMarker>
        ))}

        {visibleStops.map((stop, index) => (
          <Marker key={stop.stop_id} position={[stop.lat, stop.lng]} icon={makeBusIcon(index)}>
            <Popup>
              <strong>{stop.stop_name}</strong>
              <br />
              {stop.distance_metres}m away
              <br />
              Routes: {stop.routes.join(", ") || "-"}
            </Popup>
          </Marker>
        ))}

        {originCoords && (
          <Circle
            center={originCoords}
            radius={80}
            pathOptions={{
              color: "hsl(var(--primary))",
              fillColor: "hsl(var(--primary))",
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
        )}
      </MapContainer>

      <div className={`bottom-drawer ${drawerOpen ? "open" : "closed"}`}>
        <button
          type="button"
          className="drawer-handle"
          onClick={() => setDrawerOpen((value) => !value)}
          aria-label="Toggle nearby stops"
        />

        <div className="drawer-content">
          {tripMetroSuggestion && (
            <div className="metro-summary-card">
              <div className="metro-summary-card__title">Metro route</div>
              <div className="metro-summary-card__body">
                {tripMetroSuggestion.originStation.name} to {tripMetroSuggestion.destinationStation.name}
              </div>
              <div className="metro-summary-card__meta">
                {tripMetroSuggestion.lineSummary} - {tripMetroSuggestion.rideDistanceKm.toFixed(1)} km on metro
              </div>
            </div>
          )}

          {loadingStops && (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid #f3f3f3" }}
                >
                  <div className="skeleton" style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="skeleton" style={{ height: 14, width: "60%" }} />
                    <div className="skeleton" style={{ height: 12, width: "40%" }} />
                  </div>
                </div>
              ))}
            </>
          )}

          {stopsError && <p style={{ color: "#dc2626", fontSize: 14, padding: "8px 0" }}>{stopsError}</p>}

          {!loadingStops &&
            !stopsError &&
            stops.map((stop) => (
              <div
                key={stop.stop_id}
                className="stop-card"
                onClick={() => window.open(`https://www.google.com/maps?q=${stop.lat},${stop.lng}`, "_blank", "noopener,noreferrer")}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    window.open(`https://www.google.com/maps?q=${stop.lat},${stop.lng}`, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                <div className="stop-icon">B</div>
                <div className="stop-info">
                  <div className="stop-name">{stop.stop_name}</div>
                  <div className="stop-routes">
                    {stop.routes.length > 0 ? `Routes: ${stop.routes.join(", ")}` : "No route info available"}
                  </div>
                </div>
                <div className="stop-distance">{stop.distance_metres}m</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
