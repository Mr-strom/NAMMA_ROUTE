import { useEffect, useMemo, useRef, useState } from "react";
import { Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUser } from "../context/UserContext";
import { useGeolocation } from "../hooks/useGeolocation";

function openTel(number: string) {
  window.location.href = `tel:${number}`;
}

type SOSButtonProps = {
  routeSummary?: string;
};

export default function SOSButton({ routeSummary }: SOSButtonProps) {
  const { t } = useTranslation();
  const { profile } = useUser();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { loading, getLocation } = useGeolocation();
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);

  const activeContacts = useMemo(
    () => profile.emergencyContacts.filter((contact) => contact.name.trim() && contact.phone.trim()),
    [profile.emergencyContacts]
  );

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const requestLocationAndProceed = () => {
    if (activeContacts.length === 0 && !profile.needsWomenSafetyMode) {
      setToast(t("sos.missingContacts"));
      return;
    }
    setIsConfirmOpen(false);
    getLocation({
      force: true,
      onSuccess: async (coords) => {
        const mapsLink = `https://maps.google.com/?q=${coords.lat},${coords.lng}`;
        const sms = [
          `SOS from ${profile.name || "Namma Route user"}`,
          routeSummary ? `Route: ${routeSummary}` : "",
          `Live location: ${mapsLink}`,
        ]
          .filter(Boolean)
          .join("\n");

        try {
          await navigator.clipboard.writeText(sms);
        } catch {
          // ignore
        }

        if (activeContacts[0]) {
          openTel(activeContacts[0].phone);
        } else if (profile.needsWomenSafetyMode) {
          openTel("1091");
        } else {
          openTel("112");
        }

        setToast(t("sos.ready"));
      },
      onError: () => {
        setToast("Could not get your location. Please allow location access and try again.");
        setIsConfirmOpen(false);
      },
    });
  };

  const onLongPress = () => {
    longPressFiredRef.current = true;
    requestLocationAndProceed();
  };

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={t("sos.title")}
        onPointerDown={() => {
          clearLongPressTimer();
          longPressFiredRef.current = false;
          longPressTimerRef.current = window.setTimeout(onLongPress, 650);
        }}
        onPointerUp={() => {
          clearLongPressTimer();
          if (!longPressFiredRef.current) {
            setIsConfirmOpen(true);
          }
        }}
        onPointerLeave={clearLongPressTimer}
        onPointerCancel={clearLongPressTimer}
        className="relative inline-flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#DC2626] text-white shadow-lg"
      >
        <Phone className="h-5 w-5" aria-hidden />
        <span className="absolute bottom-1 text-[11px] font-bold">SOS</span>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            animation: "sos-pulse 1.5s infinite",
            boxShadow: "0 0 0 0 rgba(220,38,38,0.7)",
          }}
        />
      </button>

      {isConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm SOS"
          className="fixed inset-0 z-[3000] flex items-center justify-center px-4"
        >
          <div
            className="absolute inset-0"
            style={{ background: "rgba(15,23,42,0.55)" }}
            onClick={() => {
              clearLongPressTimer();
              setIsConfirmOpen(false);
            }}
          />

          <div className="relative w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.5)]">
            <div className="mb-2 text-xl font-bold text-foreground">{t("sos.confirm")}</div>
            <div className="mb-4 text-sm text-muted-foreground">
              {loading ? "Requesting location..." : "SOS will use your current location and prepared route summary."}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 rounded-xl border border-border px-4 py-2 font-semibold text-foreground hover:bg-accent/20"
              >
                {t("sos.cancel")}
              </button>
              <button
                type="button"
                onClick={() => requestLocationAndProceed()}
                className="flex-1 rounded-xl bg-[#DC2626] px-4 py-2 font-bold text-white hover:brightness-110"
              >
                {t("sos.immediate")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="assertive"
          className="fixed bottom-4 left-1/2 z-[4000] -translate-x-1/2 rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold shadow-lg"
        >
          {toast}
        </div>
      )}

      <style>{`
        @keyframes sos-pulse {
          0% { box-shadow: 0 0 0 0 rgba(220,38,38,0.7); }
          100% { box-shadow: 0 0 0 10px rgba(220,38,38,0); }
        }
      `}</style>
    </>
  );
}
