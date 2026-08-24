import {
  Bus,
  Clock3,
  Gift,
  GraduationCap,
  Heart,
  IndianRupee,
  Languages,
  Map,
  MapPinned,
  Phone,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import AssistivePanel from "./components/AssistivePanel";
import type { RoutePlanResult } from "./components/NearbyStopsMap";
import ProfilePanel from "./components/ProfilePanel";
import QRCodePanel, { type StopScanResult } from "./components/QRCodePanel";
import RouteMap from "./components/RouteMap";
import SOSButton from "./components/SOSButton";
import TravelComparePanel from "./components/TravelComparePanel";
import TripPlanner, { type TransportMode } from "./components/TripPlanner";
import type { SupportedLanguage } from "./components/LanguageSelector";
import { useUser } from "./context/UserContext";
import {
  buildCompareOptions,
  buildDisplayRoutes,
  buildFallbackBrief,
  estimateRouteDistanceKm,
  getSelectedRouteOption,
  type AssistiveBrief,
} from "./lib/appHelpers";
import type { LocationSuggestion } from "./lib/locationSuggestions";
import { checkTransitServiceHealth } from "./lib/transitService";

type SpeechRecognitionResultEventLike = Event & {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const API_BASE = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "http://localhost:8000";

const SCHEMES = [
  {
    id: "stree",
    title: "Shakti Scheme",
    description: "Women in Karnataka can use eligible BMTC bus services without regular fare payment.",
    icon: Heart,
    tint: "bg-rose-100 text-rose-600",
  },
  {
    id: "senior",
    title: "Senior Citizen Pass",
    description: "Senior citizens can get concessional fares and priority-friendly travel choices.",
    icon: Users,
    tint: "bg-cyan-100 text-cyan-600",
  },
  {
    id: "student",
    title: "Student Pass",
    description: "Students can reduce recurring travel cost through pass-based and concession-based pricing.",
    icon: GraduationCap,
    tint: "bg-indigo-100 text-indigo-600",
  },
] as const;

export default function App() {
  const { t, i18n } = useTranslation();
  const { profile, updateProfile } = useUser();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mapSectionRef = useRef<HTMLElement | null>(null);

  const [language, setLanguage] = useState<SupportedLanguage>(() => (i18n.language === "kn" ? "kn" : "en"));
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("Shivajinagar");
  const [fromSelection, setFromSelection] = useState<LocationSuggestion | null>(null);
  const [toSelection, setToSelection] = useState<LocationSuggestion | null>(null);
  const [selectedMode, setSelectedMode] = useState<TransportMode>("best");
  const [routeRequestId, setRouteRequestId] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<RoutePlanResult | null>(null);
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [selectedRouteName, setSelectedRouteName] = useState<string | null>(null);
  const [mapExpandRequestId, setMapExpandRequestId] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [aiBrief, setAiBrief] = useState<AssistiveBrief | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [scannedStop, setScannedStop] = useState<StopScanResult | null>(null);

  const displayRoutes = useMemo(() => buildDisplayRoutes(routeResult, language), [language, routeResult]);
  const selectedRoute = useMemo(() => getSelectedRouteOption(routeResult, selectedRouteName), [routeResult, selectedRouteName]);
  const compareOptions = useMemo(
    () =>
      buildCompareOptions(
        routeResult,
        selectedRouteName,
        selectedMode,
        profile.assistanceMode,
        profile.isStudent,
        profile.isSenior,
        profile.prefersSingleBus,
        profile.needsWomenSafetyMode,
        language
      ),
    [
      profile.assistanceMode,
      profile.isSenior,
      profile.isStudent,
      profile.needsWomenSafetyMode,
      profile.prefersSingleBus,
      routeResult,
      selectedMode,
      selectedRouteName,
      language,
    ]
  );
  const estimatedDistanceKm = useMemo(() => estimateRouteDistanceKm(routeResult, selectedRouteName), [routeResult, selectedRouteName]);
  const recommendedOption = compareOptions.find((option) => option.recommended) ?? null;
  const currentLocationText =
    fromLocation.trim() || routeResult?.routePlan?.origin_stop.stop_name || (language === "kn" ? "ನನ್ನ ಸ್ಥಳ" : "My location");
  const routeSummaryText = selectedRoute
    ? `${selectedRoute.route_name} from ${selectedRoute.boarding_stop.stop_name} to ${selectedRoute.alighting_stop.stop_name}`
    : "";
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const canListen = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (profile.language !== language) updateProfile({ language });
    void i18n.changeLanguage(language);
  }, [i18n, language, profile.language, updateProfile]);

  useEffect(() => {
    if ((profile.language === "en" || profile.language === "kn") && profile.language !== language) {
      setLanguage(profile.language);
    }
  }, [language, profile.language]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let ignore = false;
    async function checkBackend() {
      const healthy = await checkTransitServiceHealth(API_BASE);
      if (!ignore) setBackendHealthy(healthy);
    }
    void checkBackend();
    return () => {
      ignore = true;
      recognitionRef.current?.stop();
      if (canSpeak) window.speechSynthesis.cancel();
    };
  }, [canSpeak]);

  const speakText = (text: string) => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "kn" ? "kn-IN" : "en-IN";
    utterance.rate = profile.assistanceMode === "blind" ? 0.92 : 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const buildAndSetBrief = async (routePayload: RoutePlanResult | null, stopPayload: StopScanResult | null) => {
    const fallback = buildFallbackBrief(language, routePayload, selectedRouteName, compareOptions, stopPayload, currentLocationText, toLocation);
    setAiLoading(true);
    try {
      const response = await fetch(`${API_BASE}/assistive-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          language,
          selected_mode: selectedMode,
          origin_label: currentLocationText,
          destination_label: toLocation,
          route_result: routePayload,
          comparison_options: compareOptions,
          scanned_stop: stopPayload,
        }),
      });
      if (!response.ok) throw new Error("assistive-brief failed");
      const payload = (await response.json()) as AssistiveBrief;
      setAiBrief(payload);
      if (profile.assistanceMode === "blind") speakText(payload.voice_text);
    } catch {
      setAiBrief(fallback);
      if (profile.assistanceMode === "blind") speakText(fallback.voice_text);
    } finally {
      setAiLoading(false);
    }
  };

  const startVoiceInput = () => {
    if (!canListen) {
      setToast(t("assist.noSpeech"));
      return;
    }
    const RecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setToast(t("assist.noSpeech"));
      return;
    }
    recognitionRef.current?.stop();
    const recognition = new RecognitionCtor();
    recognition.lang = language === "kn" ? "kn-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      setVoiceQuery(transcript);
      setToast(`${t("assist.listen")}: ${transcript}`);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const handleFromLocationChange = (value: string) => {
    setFromLocation(value);
    if (!fromSelection || value.trim() !== fromSelection.label) {
      setFromSelection(null);
    }
  };

  const handleToLocationChange = (value: string) => {
    setToLocation(value);
    if (!toSelection || value.trim() !== toSelection.label) {
      setToSelection(null);
    }
  };

  return (
    <div className={`min-h-screen bg-[#183264] text-slate-900 ${profile.assistanceMode === "blind" ? "tracking-[0.02em]" : ""}`}>
      <header className="border-b border-cyan-400/20 bg-gradient-to-r from-[#23407e] via-[#144b72] to-[#244fce] shadow-[0_20px_45px_-32px_rgba(15,23,42,0.75)]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-18 w-18 items-center justify-center rounded-[1.6rem] border border-cyan-300/30 bg-sky-500/15 text-cyan-300">
              <Bus className="h-9 w-9" />
            </div>
            <div>
              <h1 className="text-5xl font-semibold text-white md:text-6xl">{t("app.title")}</h1>
              <p className="text-xl text-cyan-100/90">{t("app.subtitle")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-cyan-200/30 bg-white/10 px-4 py-3 text-sm font-semibold text-cyan-100">
              {backendHealthy === false ? t("routes.backendOffline") : t("routes.backendOnline")}
            </div>
            <button
              type="button"
              onClick={() => window.location.assign("tel:112")}
              className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-cyan-300/30 bg-sky-500/15 text-cyan-300"
            >
              <Phone className="h-6 w-6" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-10 px-2 py-8 md:px-4">
        <section className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <TripPlanner
            language={language}
            fromLocation={fromLocation}
            setFromLocation={handleFromLocationChange}
            toLocation={toLocation}
            setToLocation={handleToLocationChange}
            apiBase={API_BASE}
            currentLocationText={currentLocationText}
            routeLoading={routeLoading}
            selectedMode={selectedMode}
            onModeChange={setSelectedMode}
            onUseCurrentLocation={() => {
              setFromLocation("");
              setFromSelection(null);
            }}
            onFromSuggestionSelect={(suggestion) => {
              setFromLocation(suggestion.label);
              setFromSelection(suggestion);
            }}
            onToSuggestionSelect={(suggestion) => {
              setToLocation(suggestion.label);
              setToSelection(suggestion);
            }}
            onSwapLocations={() => {
              setFromLocation(toLocation);
              setToLocation(fromLocation);
              setFromSelection(toSelection);
              setToSelection(fromSelection);
              setToast(language === "kn" ? "ಮೂಲ ಮತ್ತು ಗಮ್ಯಸ್ಥಾನವನ್ನು ಬದಲಿಸಲಾಗಿದೆ." : "Source and destination swapped.");
            }}
            onSearchRoutes={() => {
              if (!toLocation.trim()) {
                setRouteError(language === "kn" ? "ಗಮ್ಯಸ್ಥಾನವನ್ನು ನಮೂದಿಸಿ." : "Please enter a destination.");
                return;
              }
              setRouteLoading(true);
              setRouteError(null);
              setRouteResult(null);
              setSelectedRouteName(null);
              setAiBrief(null);
              setRouteRequestId((id) => id + 1);
            }}
          />
          <ProfilePanel
            language={language}
            onLanguageChange={(lang) => {
              setLanguage(lang);
              updateProfile({ language: lang });
            }}
          />
        </section>

        <section ref={mapSectionRef} className="rounded-[2.2rem] bg-[#d6deea] px-4 py-6 md:px-8 md:py-8">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.9)]">
                <MapPinned className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-4xl font-semibold text-slate-800">{t("map.title")}</h2>
                <p className="text-xl text-slate-600">{t("map.subtitle")}</p>
              </div>
            </div>

            <div className="rounded-[1.1rem] bg-white px-5 py-4 text-lg font-semibold text-slate-700 shadow-sm md:text-xl">
              <span className="inline-flex items-center gap-3">
                <Map className="h-6 w-6 text-blue-600" />
                {selectedRouteName ?? t("mode.best")}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-[1.7rem] border border-cyan-200/80 bg-white/50">
            <RouteMap
              fromPlace={fromLocation}
              toPlace={toLocation}
              fromSelection={fromSelection}
              toSelection={toSelection}
              routeRequestId={routeRequestId}
              selectedRouteName={selectedRouteName}
              expandRequestId={mapExpandRequestId}
              onRoutePlanReady={(payload) => {
                setRouteLoading(false);
                setRouteResult(payload);
                setSelectedRouteName(payload.routePlan?.selected_route?.route_name ?? payload.routePlan?.route_options?.[0]?.route_name ?? null);
                setRouteError(payload.routePlan ? null : payload.error ?? "No route found.");
                if (payload.routePlan && profile.assistanceMode === "blind") void buildAndSetBrief(payload, scannedStop);
              }}
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <button type="button" onClick={() => setMapExpandRequestId((value) => value + 1)} className="min-h-[72px] rounded-[1.2rem] bg-gradient-to-r from-blue-500 to-blue-600 text-xl font-semibold text-white shadow-[0_18px_40px_-24px_rgba(37,99,235,0.95)] md:text-2xl">{t("map.expand")}</button>
            <button type="button" onClick={() => mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="min-h-[72px] rounded-[1.2rem] bg-gradient-to-r from-fuchsia-500 to-purple-600 text-xl font-semibold text-white shadow-[0_18px_40px_-24px_rgba(168,85,247,0.95)] md:text-2xl">{t("map.nearby")}</button>
            <button type="button" onClick={() => {
              const origin = fromLocation.trim() || currentLocationText;
              const destination = toLocation.trim();
              if (!destination) return;
              const waypoints = selectedRoute?.segment_stops?.slice(1, -1).slice(0, 6) ?? [];
              const waypointQuery = waypoints.length > 0 ? `&waypoints=${waypoints.map((stop) => `${stop.lat},${stop.lng}`).join("|")}` : "";
              const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=transit${waypointQuery}`;
              window.open(url, "_blank", "noopener,noreferrer");
            }} className="min-h-[72px] rounded-[1.2rem] bg-gradient-to-r from-emerald-500 to-green-500 text-xl font-semibold text-white shadow-[0_18px_40px_-24px_rgba(34,197,94,0.95)] md:text-2xl">{t("map.track")}</button>
          </div>
        </section>

        {(displayRoutes.length > 0 || routeError) && (
          <section className="rounded-[2.2rem] bg-[#d6deea] px-4 py-6 md:px-8 md:py-8">
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.9)]">
                <Bus className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-4xl font-semibold text-slate-800">{t("routes.title")}</h2>
                <p className="text-xl text-slate-600">{backendHealthy === false ? t("routes.backendOffline") : t("routes.backendOnline")}</p>
              </div>
            </div>

            {routeError && <div className="mb-4 text-lg font-semibold text-red-700">{routeError}</div>}

            <div className="grid gap-4">
              {displayRoutes.map((route) => (
                <article key={route.id} className="rounded-[1.5rem] bg-white px-5 py-5 shadow-[0_16px_35px_-28px_rgba(15,23,42,0.55)]">
                  {route.isBestRoute && <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-2 text-base font-semibold text-amber-700"><Star className="h-4 w-4 fill-current" />{t("routes.best")}</div>}
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="rounded-[1rem] bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-4 text-xl font-semibold text-white">{route.routeNumber}</div>
                      <div>
                        <div className="text-2xl font-semibold text-slate-800">{route.departure} to {route.arrival}</div>
                        <div className="mt-1 inline-flex items-center gap-2 text-lg text-slate-500"><Clock3 className="h-5 w-5" />{route.duration}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">{route.serviceLabel}</span>
                          {route.distanceKm != null && <span>{route.distanceKm.toFixed(1)} km priced</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-8">
                      <div className="text-center">
                        <div className="text-2xl font-semibold text-slate-800">{route.stops}</div>
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">{t("routes.stops")}</div>
                      </div>
                      <div className="text-center">
                        <div className="inline-flex items-center gap-1 text-2xl font-semibold text-slate-800"><IndianRupee className="h-5 w-5" />{route.cost ?? "-"}</div>
                        <div className="text-sm uppercase tracking-[0.18em] text-slate-500">{t("routes.fare")}</div>
                      </div>
                      <button type="button" onClick={() => {
                        setSelectedRouteName(route.routeNumber);
                        mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        setToast(language === "kn" ? `${route.routeNumber} ಆಯ್ಕೆಮಾಡಲಾಗಿದೆ.` : `Selected route ${route.routeNumber}`);
                      }} className="min-h-[56px] rounded-[1rem] bg-gradient-to-r from-blue-600 to-sky-500 px-6 text-lg font-semibold text-white">{t("routes.select")}</button>
                    </div>
                  </div>
                  {route.fareNote && <p className="mt-4 text-sm text-slate-500">{route.fareNote}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {(compareOptions.length > 0 || aiBrief || scannedStop) && (
          <section className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <TravelComparePanel options={compareOptions} estimatedDistanceKm={estimatedDistanceKm} language={language} />
            <AssistivePanel
              aiBrief={aiBrief}
              aiLoading={aiLoading}
              isSpeaking={isSpeaking}
              isListening={isListening}
              voiceQuery={voiceQuery}
              scannedStop={scannedStop}
              recommendedOption={recommendedOption}
              onGenerate={() => void buildAndSetBrief(routeResult, scannedStop)}
              onSpeak={() => {
                if (!aiBrief) return;
                if (isSpeaking) stopSpeaking();
                else speakText(aiBrief.voice_text);
              }}
              onRepeat={() => {
                if (aiBrief?.steps[0]) speakText(aiBrief.steps[0]);
              }}
              onListenToggle={() => {
                if (isListening) {
                  recognitionRef.current?.stop();
                  setIsListening(false);
                } else {
                  startVoiceInput();
                }
              }}
              onCopyMessage={(text) => void navigator.clipboard.writeText(text)}
            />
          </section>
        )}

        <QRCodePanel language={language} onStopDetected={(stop) => {
          setScannedStop(stop);
          setToast(language === "kn" ? `${stop.stop_name} ಗುರುತಿಸಲಾಗಿದೆ.` : `${stop.stop_name} identified.`);
          void buildAndSetBrief(routeResult, stop);
        }} />

        <section className="rounded-[2.2rem] bg-[#d6deea] px-4 py-6 md:px-8 md:py-8">
          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.9)]">
              <Gift className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-4xl font-semibold text-slate-800">{t("schemes.title")}</h2>
              <p className="text-xl text-slate-600">{t("schemes.subtitle")}</p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {SCHEMES.map((scheme) => {
              const Icon = scheme.icon;
              return (
                <article key={scheme.id} className="rounded-[1.6rem] bg-white p-6 shadow-[0_16px_35px_-28px_rgba(15,23,42,0.55)]">
                  <div className={`mb-8 flex h-20 w-20 items-center justify-center rounded-[1.6rem] ${scheme.tint}`}><Icon className="h-10 w-10" /></div>
                  <h3 className="text-3xl font-semibold text-slate-800">{scheme.title}</h3>
                  <p className="mt-4 text-lg leading-8 text-slate-500">{scheme.description}</p>
                  <button type="button" onClick={() => void navigator.clipboard.writeText(`${scheme.title}: ${scheme.description}`)} className="mt-8 inline-flex items-center gap-3 text-xl font-semibold text-sky-600"><Languages className="h-6 w-6" />{t("schemes.read")}</button>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      <div className="fixed bottom-4 right-4">
        <SOSButton routeSummary={routeSummaryText} />
      </div>

      {toast && <div className="fixed bottom-4 left-1/2 z-[5000] -translate-x-1/2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg">{toast}</div>}
    </div>
  );
}
