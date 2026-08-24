import { useMemo } from "react";
import { Home, LocateFixed, Search } from "lucide-react";
import { useGeolocation } from "../hooks/useGeolocation";
import type { SupportedLanguage } from "./LanguageSelector";

type LocationButtonsProps = {
  language: SupportedLanguage;
  fromLocation: string;
  setFromLocation: (v: string) => void;
  onUseCurrentLocation: () => void;
};

const STORAGE_KEY = "nammaroute_my_location";

export default function LocationButtons({
  language,
  fromLocation,
  setFromLocation,
  onUseCurrentLocation,
}: LocationButtonsProps) {
  const { getLocation, error } = useGeolocation();

  const labels = useMemo(() => {
    if (language === "kn") {
      return {
        current: "ಪ್ರಸ್ತುತ ಸ್ಥಳ",
        my: "ನನ್ನ ಸ್ಥಳ",
        search: "ಮಾರ್ಗ ಹುಡುಕಿ",
      };
    }
    return {
      current: "Current Location",
      my: "My Location",
      search: "Search Route",
    };
  }, [language]);

  const handleCurrentLocation = () => {
    // Best-effort: trigger geolocation permission once and then let the map consume GPS.
    // The map still relies on `fromLocation === ""` to decide GPS vs landmark.
    getLocation({ force: true });
    onUseCurrentLocation();
  };

  const handleMyLocation = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.trim().length > 0) {
        setFromLocation(saved);
        return;
      }

      const toSave = fromLocation.trim();
      if (!toSave) {
        alert(
          language === "kn"
            ? "ಮೊದಲು `From` ನಲ್ಲಿ ಸ್ಥಳವನ್ನು ಟೈಪ್ ಮಾಡಿ, ನಂತರ My Location ಒತ್ತಿ."
            : "Type a place in `From` first, then press My Location."
        );
        return;
      }

      const ok = confirm(
        language === "kn"
          ? `ಈ "${toSave}" ಅನ್ನು ನನ್ನ ಸ್ಥಳವಾಗಿ ಉಳಿಸಬೇಕೆ?`
          : `Save "${toSave}" as My Location?`
      );
      if (ok) {
        localStorage.setItem(STORAGE_KEY, toSave);
        setFromLocation(toSave);
      }
    } catch {
      // ignore
    }
  };

  const handleSearchFocus = () => {
    const el = document.getElementById("from-input") as HTMLInputElement | null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  };

  return (
    <div className="flex gap-3 flex-wrap">
      <button
        type="button"
        onClick={handleCurrentLocation}
        className="flex-1 min-w-[140px] bg-[#0EA5E9] hover:brightness-110 text-white font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 min-h-[44px] transition-colors"
        aria-label={labels.current}
      >
        <LocateFixed className="w-5 h-5" />
        {labels.current}
      </button>

      <button
        type="button"
        onClick={handleMyLocation}
        className="flex-1 min-w-[140px] bg-[#10B981] hover:brightness-110 text-white font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 min-h-[44px] transition-colors"
        aria-label={labels.my}
      >
        <Home className="w-5 h-5" />
        {labels.my}
      </button>

      <button
        type="button"
        onClick={handleSearchFocus}
        className="flex-1 min-w-[140px] bg-[#8B5CF6] hover:brightness-110 text-white font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 min-h-[44px] transition-colors"
        aria-label={labels.search}
      >
        <Search className="w-5 h-5" />
        {labels.search}
      </button>

      {error && (
        <div className="w-full text-sm text-red-700 mt-2" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

