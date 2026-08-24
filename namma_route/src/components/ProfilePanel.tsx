import { UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import LanguageSelector, { type SupportedLanguage } from "./LanguageSelector";
import { useUser, type AssistanceMode, type ContactMethod, type Gender } from "../context/UserContext";

type ProfilePanelProps = {
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
};

export default function ProfilePanel({ language, onLanguageChange }: ProfilePanelProps) {
  const { t } = useTranslation();
  const { profile, updateProfile, updateEmergencyContact, addEmergencyContact, removeEmergencyContact } = useUser();

  const genders: Array<{ value: Gender; key: string }> = [
    { value: "male", key: "profile.gender.male" },
    { value: "female", key: "profile.gender.female" },
    { value: "other", key: "profile.gender.other" },
    { value: "unspecified", key: "profile.gender.unspecified" },
  ];

  const assistanceModes: Array<{ value: AssistanceMode; key: string }> = [
    { value: "standard", key: "profile.mode.standard" },
    { value: "blind", key: "profile.mode.blind" },
    { value: "low_mobility", key: "profile.mode.low_mobility" },
    { value: "wheelchair", key: "profile.mode.wheelchair" },
  ];

  const contactMethods: Array<{ value: ContactMethod; key: string }> = [
    { value: "call", key: "profile.method.call" },
    { value: "sms", key: "profile.method.sms" },
    { value: "both", key: "profile.method.both" },
  ];

  return (
    <section className="rounded-[2rem] bg-[#d7dfeb] p-6 shadow-[0_22px_50px_-34px_rgba(15,23,42,0.35)] md:p-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_12px_30px_-18px_rgba(37,99,235,0.9)]">
          <UserRound className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-3xl font-semibold text-slate-800">{t("profile.title")}</h2>
          <p className="text-base text-slate-600">{t("profile.subtitle")}</p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-2 text-sm font-semibold text-slate-700">{t("profile.name")}</div>
          <input
            type="text"
            value={profile.name}
            onChange={(event) => updateProfile({ name: event.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-800 outline-none transition focus:border-sky-400"
            placeholder={t("profile.name")}
          />
        </div>

        <div className="hidden rounded-full bg-[#244fce] p-2 md:block">
          <LanguageSelector language={language} onLanguageChange={onLanguageChange} />
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-700">{t("profile.gender")}</div>
          <div className="grid gap-3 sm:grid-cols-4">
            {genders.map((gender) => (
              <button
                key={gender.value}
                type="button"
                onClick={() =>
                  updateProfile({
                    gender: gender.value,
                    needsWomenSafetyMode: gender.value === "female" ? true : profile.needsWomenSafetyMode,
                  })
                }
                className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                  profile.gender === gender.value
                    ? "border-sky-500 bg-sky-50 text-sky-700"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {t(gender.key)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold text-slate-700">{t("profile.assistance")}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {assistanceModes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => updateProfile({ assistanceMode: mode.value })}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  profile.assistanceMode === mode.value
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {t(mode.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["isStudent", "profile.student"],
            ["isSenior", "profile.senior"],
            ["prefersSingleBus", "profile.singleBus"],
            ["needsWomenSafetyMode", "profile.womenSafety"],
          ] as const).map(([field, labelKey]) => (
            <label key={field} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
              <input
                type="checkbox"
                checked={Boolean(profile[field])}
                onChange={(event) => updateProfile({ [field]: event.target.checked } as Partial<typeof profile>)}
                className="h-4 w-4 accent-sky-600"
              />
              <span className="text-sm font-semibold text-slate-700">{t(labelKey)}</span>
            </label>
          ))}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-700">{t("profile.contacts")}</div>
            <button
              type="button"
              onClick={addEmergencyContact}
              className="rounded-full bg-sky-100 px-3 py-2 text-sm font-semibold text-sky-700"
            >
              {t("profile.addContact")}
            </button>
          </div>

          <div className="space-y-3">
            {profile.emergencyContacts.map((contact, index) => (
              <article key={`${index}-${contact.phone}`} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={contact.name}
                    onChange={(event) => updateEmergencyContact(index, { ...contact, name: event.target.value })}
                    placeholder={t("profile.contactName")}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-sky-400"
                  />
                  <input
                    type="text"
                    value={contact.phone}
                    onChange={(event) => updateEmergencyContact(index, { ...contact, phone: event.target.value })}
                    placeholder={t("profile.contactPhone")}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-sky-400"
                  />
                  <input
                    type="text"
                    value={contact.relation}
                    onChange={(event) => updateEmergencyContact(index, { ...contact, relation: event.target.value })}
                    placeholder={t("profile.contactRelation")}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-sky-400"
                  />
                  <select
                    value={contact.method}
                    onChange={(event) =>
                      updateEmergencyContact(index, { ...contact, method: event.target.value as ContactMethod })
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-sky-400"
                  >
                    {contactMethods.map((method) => (
                      <option key={method.value} value={method.value}>
                        {t(method.key)}
                      </option>
                    ))}
                  </select>
                </div>

                {profile.emergencyContacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEmergencyContact(index)}
                    className="mt-3 text-sm font-semibold text-red-600"
                  >
                    {t("profile.removeContact")}
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
