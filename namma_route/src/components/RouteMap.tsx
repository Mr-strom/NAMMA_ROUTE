import { useState } from "react";
import NearbyStopsMap, { type RoutePlanResult } from "./NearbyStopsMap";
import { Maximize2, X } from "lucide-react";
import type { LocationSuggestion } from "../lib/locationSuggestions";

type RouteMapProps = {
  fromPlace: string;
  toPlace: string;
  fromSelection?: LocationSuggestion | null;
  toSelection?: LocationSuggestion | null;
  routeRequestId: number;
  selectedRouteName?: string | null;
  expandRequestId?: number;
  onRoutePlanReady: (payload: RoutePlanResult) => void;
};

export default function RouteMap({
  fromPlace,
  toPlace,
  fromSelection,
  toSelection,
  routeRequestId,
  selectedRouteName,
  expandRequestId = 0,
  onRoutePlanReady,
}: RouteMapProps) {
  const [manualExpanded, setManualExpanded] = useState(false);
  const [dismissedExpandRequestId, setDismissedExpandRequestId] = useState(0);
  const isExpanded = manualExpanded || expandRequestId > dismissedExpandRequestId;

  return (
    <>
      <div className="relative">
        <div className="absolute top-3 right-3 z-[1200]">
          <button
            type="button"
            onClick={() => setManualExpanded(true)}
            className="min-h-[40px] min-w-[40px] rounded-xl bg-white/90 border border-border shadow-sm hover:bg-white flex items-center justify-center"
            aria-label="Expand map"
            title="Expand map"
          >
            <Maximize2 className="w-4 h-4 text-primary" />
          </button>
        </div>

        <NearbyStopsMap
          fromPlace={fromPlace}
          toPlace={toPlace}
          fromSelection={fromSelection}
          toSelection={toSelection}
          routeRequestId={routeRequestId}
          selectedRouteName={selectedRouteName}
          onRoutePlanReady={onRoutePlanReady}
        />
      </div>

      {isExpanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded map"
          className="fixed inset-0 z-[2000] bg-white"
        >
          <div className="absolute top-3 right-3 z-[2100]">
            <button
              type="button"
              onClick={() => {
                setManualExpanded(false);
                setDismissedExpandRequestId(expandRequestId);
              }}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-white/90 border border-border shadow-sm hover:bg-white flex items-center justify-center"
              aria-label="Close map"
              title="Close"
            >
              <X className="w-4 h-4 text-primary" />
            </button>
          </div>

          <div className="h-full p-3">
            <NearbyStopsMap
              fromPlace={fromPlace}
              toPlace={toPlace}
              fromSelection={fromSelection}
              toSelection={toSelection}
              routeRequestId={routeRequestId}
              selectedRouteName={selectedRouteName}
              onRoutePlanReady={onRoutePlanReady}
            />
          </div>
        </div>
      )}
    </>
  );
}

