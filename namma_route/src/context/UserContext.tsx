/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

export type Gender = "male" | "female" | "other" | "unspecified";
export type AssistanceMode = "standard" | "blind" | "low_mobility" | "wheelchair";
export type ContactMethod = "call" | "sms" | "both";

export type EmergencyContact = {
  name: string;
  phone: string;
  relation: string;
  method: ContactMethod;
};

export type UserProfile = {
  name: string;
  gender: Gender;
  language: "en" | "kn";
  assistanceMode: AssistanceMode;
  isStudent: boolean;
  isSenior: boolean;
  needsWomenSafetyMode: boolean;
  prefersSingleBus: boolean;
  emergencyContacts: EmergencyContact[];
};

type UserContextType = {
  profile: UserProfile;
  updateProfile: (patch: Partial<UserProfile>) => void;
  updateEmergencyContact: (index: number, contact: EmergencyContact) => void;
  addEmergencyContact: () => void;
  removeEmergencyContact: (index: number) => void;
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => void;
};

const STORAGE_KEY = "nammaroute_profile_v2";

const defaultProfile: UserProfile = {
  name: "",
  gender: "unspecified",
  language: "en",
  assistanceMode: "standard",
  isStudent: false,
  isSenior: false,
  needsWomenSafetyMode: false,
  prefersSingleBus: false,
  emergencyContacts: [
    { name: "", phone: "", relation: "Family", method: "both" },
  ],
};

const UserContext = createContext<UserContextType | undefined>(undefined);

function loadStoredState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return {
        profile: defaultProfile,
        hasCompletedOnboarding: false,
      };
    }
    const parsed = JSON.parse(saved) as UserProfile;
    return {
      profile: {
        ...defaultProfile,
        ...parsed,
        emergencyContacts:
          Array.isArray(parsed.emergencyContacts) && parsed.emergencyContacts.length > 0
            ? parsed.emergencyContacts
            : defaultProfile.emergencyContacts,
      },
      hasCompletedOnboarding: true,
    };
  } catch {
    return {
      profile: defaultProfile,
      hasCompletedOnboarding: false,
    };
  }
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

function ProfileOnboardingDialog({
  onComplete,
}: {
  onComplete: (profile: Partial<UserProfile>) => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("unspecified");
  const [assistanceMode, setAssistanceMode] = useState<AssistanceMode>("standard");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Profile setup"
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.6)" }}
    >
      <div className="w-full max-w-xl rounded-[2rem] border border-white/20 bg-white p-6 text-slate-900 shadow-[0_35px_80px_-40px_rgba(15,23,42,0.7)]">
        <div className="mb-5">
          <div className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Setup</div>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">Personalize your travel support</h2>
          <p className="mt-2 text-base text-slate-600">
            This powers language, accessibility guidance, route ranking, and SOS shortcuts.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <div className="mb-2 text-sm font-semibold text-slate-700">Name</div>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-sky-400"
            />
          </label>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">Gender</div>
            <div className="grid gap-3 sm:grid-cols-4">
              {([
                ["male", "Male"],
                ["female", "Female"],
                ["other", "Other"],
                ["unspecified", "Skip"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGender(value)}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    gender === value
                      ? "border-sky-500 bg-sky-50 text-sky-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">Accessibility support</div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["standard", "Standard"],
                ["blind", "Blind / voice-first"],
                ["low_mobility", "Low mobility"],
                ["wheelchair", "Wheelchair / PWD"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAssistanceMode(value)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                    assistanceMode === value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            onComplete({
              name,
              gender,
              assistanceMode,
              needsWomenSafetyMode: gender === "female",
            })
          }
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-4 text-lg font-semibold text-white"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [storedState] = useState(loadStoredState);
  const [profile, setProfile] = useState<UserProfile>(storedState.profile);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(storedState.hasCompletedOnboarding);

  const persistProfile = (next: UserProfile) => {
    setProfile(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const value = useMemo<UserContextType>(
    () => ({
      profile,
      updateProfile: (patch) => {
        persistProfile({ ...profile, ...patch });
      },
      updateEmergencyContact: (index, contact) => {
        const emergencyContacts = profile.emergencyContacts.map((item, itemIndex) =>
          itemIndex === index ? contact : item
        );
        persistProfile({ ...profile, emergencyContacts });
      },
      addEmergencyContact: () => {
        persistProfile({
          ...profile,
          emergencyContacts: [
            ...profile.emergencyContacts,
            { name: "", phone: "", relation: "Family", method: "both" },
          ],
        });
      },
      removeEmergencyContact: (index) => {
        const emergencyContacts = profile.emergencyContacts.filter((_, itemIndex) => itemIndex !== index);
        persistProfile({
          ...profile,
          emergencyContacts: emergencyContacts.length > 0 ? emergencyContacts : defaultProfile.emergencyContacts,
        });
      },
      hasCompletedOnboarding,
      completeOnboarding: () => setHasCompletedOnboarding(true),
    }),
    [hasCompletedOnboarding, profile]
  );

  return (
    <UserContext.Provider value={value}>
      {!hasCompletedOnboarding ? (
        <ProfileOnboardingDialog
          onComplete={(patch) => {
            persistProfile({ ...profile, ...patch });
            setHasCompletedOnboarding(true);
          }}
        />
      ) : (
        children
      )}
    </UserContext.Provider>
  );
}
