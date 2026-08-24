import { useEffect, useMemo, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

interface StopPoint {
  name: string;
  lat: number;
  lng: number;
}

interface MapViewProps {
  boardingStop?: StopPoint;
  alightStop?: StopPoint;
}

export const MapView = ({ boardingStop, alightStop }: MapViewProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);

  const fallbackStops = useMemo(
    () => ({
      boarding: { name: "Majestic", lat: 12.9767, lng: 77.5713 },
      alight: { name: "MG Road", lat: 12.9757, lng: 77.6095 }
    }),
    []
  );

  const blueIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: '<div class="map-marker-dot map-marker-blue"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      }),
    []
  );

  const redIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: '<div class="map-marker-dot map-marker-red"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      }),
    []
  );

  useEffect(() => {
    if (mapRef.current || !mapElRef.current) return;

    mapRef.current = L.map(mapElRef.current, {
      center: [12.9716, 77.5946],
      zoom: 12,
      zoomControl: true
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(mapRef.current);

    markersRef.current = L.layerGroup().addTo(mapRef.current);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();

    const boarding = boardingStop ?? fallbackStops.boarding;
    const alight = alightStop ?? fallbackStops.alight;

    L.marker([boarding.lat, boarding.lng], { icon: blueIcon })
      .addTo(markersRef.current)
      .bindPopup(boarding.name);

    L.marker([alight.lat, alight.lng], { icon: redIcon })
      .addTo(markersRef.current)
      .bindPopup(alight.name);

    const centerLat = (boarding.lat + alight.lat) / 2;
    const centerLng = (boarding.lng + alight.lng) / 2;
    mapRef.current.setView([centerLat, centerLng], 12);
  }, [boardingStop, alightStop, blueIcon, redIcon, fallbackStops]);

  return <div ref={mapElRef} className="h-80 w-full rounded-2xl border border-slate-200" />;
};
