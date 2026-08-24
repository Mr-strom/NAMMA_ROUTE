import { useCallback, useEffect, useRef, useState } from "react";

export type GeolocationCoords = { lat: number; lng: number };

type GetLocationOptions = {
  force?: boolean;
  onSuccess?: (coords: GeolocationCoords) => void;
  onError?: (message: string) => void;
};

export function useGeolocation() {
  const [coords, setCoords] = useState<GeolocationCoords | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent repeated prompts unless forced.
  const hasRequestedRef = useRef(false);
  const coordsRef = useRef<GeolocationCoords | null>(null);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  const getLocation = useCallback(
    (opts?: GetLocationOptions) => {
      const force = opts?.force ?? false;

      if (!force && coordsRef.current) return;
      if (!force && hasRequestedRef.current) return;

      if (!navigator.geolocation) {
        const message = "Geolocation is not supported by your browser.";
        setError(message);
        setLoading(false);
        opts?.onError?.(message);
        return;
      }

      hasRequestedRef.current = true;
      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const nextCoords = { lat, lng };
          setCoords(nextCoords);
          setLoading(false);
          opts?.onSuccess?.(nextCoords);
        },
        (e) => {
          const message =
            e?.message ||
            "Location access was denied. Please allow location to use this feature.";
          setError(
            message
          );
          setLoading(false);
          opts?.onError?.(message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30_000,
        }
      );
    },
    []
  );

  return { coords, loading, error, getLocation, setCoords };
}

