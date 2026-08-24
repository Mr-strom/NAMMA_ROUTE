import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Copy, Lock, MapPinned, QrCode, RefreshCw, ScanSearch } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { useGeolocation } from "../hooks/useGeolocation";
import { lookupStop } from "../lib/transitService";
import type { SupportedLanguage } from "./LanguageSelector";

export type StopScanResult = {
  stop_id: string;
  stop_name: string;
  lat: number;
  lng: number;
  source: "qr" | "lookup";
};

type QRCodePanelProps = {
  language: SupportedLanguage;
  onStopDetected?: (stop: StopScanResult) => void;
};

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
    };
  }
}

const FEATURED_STOPS = [
  { stop_id: "majestic", name: "Majestic", lat: 12.9767, lng: 77.5713 },
  { stop_id: "shivajinagar", name: "Shivajinagar", lat: 12.9833, lng: 77.6033 },
  { stop_id: "mg-road", name: "MG Road", lat: 12.9757, lng: 77.6011 },
  { stop_id: "whitefield", name: "Whitefield", lat: 12.9698, lng: 77.7499 },
] as const;

function buildMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

function buildStopPayload(stop: { stop_id: string; name: string; lat: number; lng: number }) {
  return JSON.stringify({
    type: "namma-stop",
    stop_id: stop.stop_id,
    stop_name: stop.name,
    lat: stop.lat,
    lng: stop.lng,
  });
}

export default function QRCodePanel({ language, onStopDetected }: QRCodePanelProps) {
  const { t } = useTranslation();
  const { coords, error, loading, getLocation } = useGeolocation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scanValue, setScanValue] = useState("");
  const [detectedStop, setDetectedStop] = useState<StopScanResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [cameraScanning, setCameraScanning] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);

  void language;

  const mapsUrl = useMemo(() => {
    if (!coords) return null;
    return buildMapsUrl(coords.lat, coords.lng);
  }, [coords]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    setCameraSupported(Boolean(window.BarcodeDetector && navigator.mediaDevices?.getUserMedia));
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const copyLink = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setToast(t("common.copied"));
    } catch {
      // ignore
    }
  };

  const handleDetectStop = async () => {
    const trimmed = scanValue.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed) as {
        type?: string;
        stop_id: string;
        stop_name: string;
        lat: number;
        lng: number;
      };
      if (parsed.type === "namma-stop") {
        const stop = {
          stop_id: parsed.stop_id,
          stop_name: parsed.stop_name,
          lat: parsed.lat,
          lng: parsed.lng,
          source: "qr" as const,
        };
        setDetectedStop(stop);
        onStopDetected?.(stop);
        return;
      }
    } catch {
      // continue to backend lookup
    }

    setLookupLoading(true);
    try {
      const stopResult = await lookupStop(trimmed);
      if (!stopResult) {
        setToast(t("qr.invalid"));
      } else {
        const stop = {
          stop_id: stopResult.stop_id,
          stop_name: stopResult.stop_name,
          lat: stopResult.lat,
          lng: stopResult.lng,
          source: "lookup" as const,
        };
        setDetectedStop(stop);
        onStopDetected?.(stop);
      }
    } catch {
      setToast(t("qr.invalid"));
    } finally {
      setLookupLoading(false);
    }
  };

  const stopCameraScan = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraScanning(false);
  };

  const startCameraScan = async () => {
    if (!window.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      setToast("Camera QR scanning is not supported on this device.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const detectFrame = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const code = codes.find((item) => item.rawValue)?.rawValue;
          if (code) {
            setScanValue(code);
            stopCameraScan();
            window.setTimeout(() => {
              void handleDetectStop();
            }, 50);
            return;
          }
        } catch {
          // ignore detection frame errors
        }

        if (streamRef.current) {
          window.requestAnimationFrame(() => {
            void detectFrame();
          });
        }
      };

      void detectFrame();
    } catch {
      setToast("Could not open the camera for QR scanning.");
      stopCameraScan();
    }
  };

  return (
    <section className="rounded-[2rem] bg-[#d7dfeb] p-6 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.35)] md:p-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_12px_30px_-18px_rgba(168,85,247,0.8)]">
          <QrCode className="h-8 w-8" />
        </div>
        <div>
          <h3 className="text-3xl font-semibold text-slate-800">{t("qr.title")}</h3>
          <p className="text-lg text-slate-600">{t("qr.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="mb-4 text-lg font-semibold text-slate-700">{t("qr.featured")}</div>
          <div className="grid gap-4 md:grid-cols-2">
            {FEATURED_STOPS.map((stop) => {
              const url = buildMapsUrl(stop.lat, stop.lng);
              const payload = buildStopPayload(stop);
              return (
                <article
                  key={stop.stop_id}
                  className="rounded-[1.5rem] bg-white p-5 shadow-[0_12px_30px_-22px_rgba(15,23,42,0.35)]"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                      <MapPinned className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-xl font-semibold text-slate-800">{stop.name}</div>
                      <div className="text-sm text-slate-500">
                        {stop.lat.toFixed(4)}, {stop.lng.toFixed(4)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] bg-slate-50 p-4">
                    <QRCodeSVG value={payload} size={132} fgColor="#1d4ed8" bgColor="#FFFFFF" className="mx-auto" />
                  </div>

                  <div className="mt-4 grid gap-3">
                    <button
                      type="button"
                      onClick={() => void copyLink(payload)}
                      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[1rem] bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-base font-semibold text-white transition hover:brightness-105"
                    >
                      <Copy className="h-5 w-5" />
                      {t("qr.copyPayload")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyLink(url)}
                      className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[1rem] bg-slate-100 px-4 text-base font-semibold text-slate-700 transition hover:bg-slate-200"
                    >
                      <Copy className="h-5 w-5" />
                      {t("qr.copyLink")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.7rem] bg-white p-5 shadow-[0_12px_30px_-22px_rgba(15,23,42,0.35)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold text-slate-800">{t("qr.myLocation")}</div>
                <div className="text-base text-slate-500">{t("qr.help")}</div>
              </div>

              <button
                type="button"
                onClick={() => getLocation({ force: true })}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-[1rem] bg-slate-100 px-4 text-base font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                <RefreshCw className="h-4 w-4" />
                {loading ? t("common.loading") : t("qr.generate")}
              </button>
            </div>

            {error && <div className="mb-3 text-sm text-red-700">{error}</div>}

            {!coords ? (
              <div className="flex items-start gap-3 rounded-[1.2rem] bg-slate-50 p-4 text-slate-600">
                <Lock className="mt-0.5 h-5 w-5 text-sky-600" />
                <div>Enable location access to generate your live QR code.</div>
              </div>
            ) : (
              <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
                <div className="rounded-[1.2rem] bg-slate-50 p-4">
                  <QRCodeSVG value={mapsUrl ?? ""} size={180} fgColor="#1d4ed8" bgColor="#FFFFFF" className="mx-auto" />
                </div>

                <div className="space-y-3">
                  <div className="text-lg font-semibold text-slate-800">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </div>
                  <button
                    type="button"
                    onClick={() => mapsUrl && void copyLink(mapsUrl)}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-[1rem] bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-base font-semibold text-white transition hover:brightness-105"
                  >
                    <Copy className="h-4 w-4" />
                    {t("qr.copyLink")}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[1.7rem] bg-white p-5 shadow-[0_12px_30px_-22px_rgba(15,23,42,0.35)]">
            <div className="mb-3 flex items-center gap-3">
              <ScanSearch className="h-5 w-5 text-sky-600" />
              <div className="text-xl font-semibold text-slate-800">{t("qr.scanTitle")}</div>
            </div>
            {cameraSupported && (
              <div className="mb-3">
                <button
                  type="button"
                  onClick={() => {
                    if (cameraScanning) stopCameraScan();
                    else void startCameraScan();
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-[1rem] bg-slate-100 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  <Camera className="h-4 w-4" />
                  {cameraScanning ? "Stop Camera Scan" : "Scan with Camera"}
                </button>
              </div>
            )}
            {cameraScanning && (
              <video
                ref={videoRef}
                className="mb-3 h-52 w-full rounded-2xl bg-slate-900 object-cover"
                muted
                playsInline
              />
            )}
            <textarea
              value={scanValue}
              onChange={(event) => setScanValue(event.target.value)}
              placeholder={t("qr.scanPlaceholder")}
              className="min-h-[130px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-400"
            />
            <button
              type="button"
              onClick={() => void handleDetectStop()}
              className="mt-3 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-3 text-base font-semibold text-white"
            >
              {lookupLoading ? t("common.loading") : t("qr.identify")}
            </button>

            {detectedStop && (
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-slate-800">
                <div className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">{t("qr.stopDetected")}</div>
                <div className="mt-2 text-xl font-semibold">{detectedStop.stop_name}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {detectedStop.lat.toFixed(4)}, {detectedStop.lng.toFixed(4)}
                </div>
              </div>
            )}
            {toast && <div className="mt-3 text-sm font-semibold text-emerald-700">{toast}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
