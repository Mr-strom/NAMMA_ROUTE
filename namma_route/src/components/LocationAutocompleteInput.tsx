import { Loader2, Search, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { makeStopSuggestion, searchLandmarks, type LocationSuggestion } from "../lib/locationSuggestions";
import { searchStops } from "../lib/transitService";

type LocationAutocompleteInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  icon: LucideIcon;
  apiBase: string;
  onValueChange: (value: string) => void;
  onSuggestionSelect: (suggestion: LocationSuggestion) => void;
};

function dedupeSuggestions(suggestions: LocationSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    if (seen.has(suggestion.id)) return false;
    seen.add(suggestion.id);
    return true;
  });
}

export default function LocationAutocompleteInput({
  id,
  label,
  value,
  placeholder,
  icon: Icon,
  apiBase,
  onValueChange,
  onSuggestionSelect,
}: LocationAutocompleteInputProps) {
  const [backendSuggestions, setBackendSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!query) {
      setBackendSuggestions([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const stops = await searchStops(query, 8, apiBase);
        if (!controller.signal.aborted) {
          setBackendSuggestions(stops.map(makeStopSuggestion));
        }
      } catch {
        if (!controller.signal.aborted) {
          setBackendSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 140);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [apiBase, value]);

  const suggestions = useMemo(() => {
    const query = value.trim();
    if (!query) return [];
    return dedupeSuggestions([...searchLandmarks(query, 4), ...backendSuggestions]).slice(0, 8);
  }, [backendSuggestions, value]);

  const shouldShowEmptyState = value.trim().length > 0 && !loading && suggestions.length === 0;

  return (
    <label className="block">
      <div className="mb-2 text-sm font-semibold text-slate-700">{label}</div>
      <div className="relative">
        <div className="flex min-h-[78px] items-center gap-4 rounded-[1.4rem] border border-cyan-200 bg-white px-6 shadow-sm">
          <Icon className="h-6 w-6 text-slate-300" />
          <input
            id={id}
            type="text"
            value={value}
            onChange={(event) => {
              onValueChange(event.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setIsOpen(false), 120);
            }}
            className="w-full bg-transparent text-xl font-medium text-slate-800 outline-none placeholder:text-slate-400 md:text-2xl"
            placeholder={placeholder}
            autoComplete="off"
            aria-autocomplete="list"
          />
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-sky-500" /> : <Search className="h-5 w-5 text-slate-300" />}
        </div>

        {isOpen && (suggestions.length > 0 || shouldShowEmptyState) && (
          <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-[1.25rem] border border-slate-200 bg-white p-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSuggestionSelect(suggestion);
                  setIsOpen(false);
                }}
                className="flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold text-slate-800 md:text-lg">{suggestion.label}</div>
                  <div className="mt-1 text-sm text-slate-500">{suggestion.description}</div>
                </div>
                <span
                  className={`mt-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${
                    suggestion.kind === "stop" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {suggestion.kind}
                </span>
              </button>
            ))}

            {shouldShowEmptyState && (
              <div className="rounded-xl px-4 py-3 text-sm text-slate-500">No matching stops or landmarks found.</div>
            )}
          </div>
        )}
      </div>
    </label>
  );
}
