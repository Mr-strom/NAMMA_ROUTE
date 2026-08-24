import { Mic, ScanSearch, Shield, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StopScanResult } from "./QRCodePanel";
import type { AssistiveBrief, CompareOption } from "../lib/appHelpers";

type AssistivePanelProps = {
  aiBrief: AssistiveBrief | null;
  aiLoading: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  voiceQuery: string;
  scannedStop: StopScanResult | null;
  recommendedOption: CompareOption | null;
  onGenerate: () => void;
  onSpeak: () => void;
  onRepeat: () => void;
  onListenToggle: () => void;
  onCopyMessage: (text: string) => void;
};

export default function AssistivePanel({
  aiBrief,
  aiLoading,
  isSpeaking,
  isListening,
  voiceQuery,
  scannedStop,
  recommendedOption,
  onGenerate,
  onSpeak,
  onRepeat,
  onListenToggle,
  onCopyMessage,
}: AssistivePanelProps) {
  const { t } = useTranslation();

  return (
    <section className="rounded-[2.2rem] bg-[#d6deea] px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_12px_30px_-18px_rgba(168,85,247,0.8)]">
          <Sparkles className="h-8 w-8" />
        </div>
        <div>
          <h2 className="text-4xl font-semibold text-slate-800">{t("assist.title")}</h2>
          <p className="text-xl text-slate-600">{t("assist.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onGenerate}
          className="rounded-2xl bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-4 text-lg font-semibold text-white"
        >
          {aiLoading ? t("common.loading") : t("assist.generate")}
        </button>
        <button
          type="button"
          onClick={onSpeak}
          className="rounded-2xl bg-white px-5 py-4 text-lg font-semibold text-slate-700"
        >
          <span className="inline-flex items-center gap-2">
            {isSpeaking ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            {isSpeaking ? t("assist.voiceStopped") : t("assist.speak")}
          </span>
        </button>
        <button
          type="button"
          onClick={onRepeat}
          className="rounded-2xl bg-white px-5 py-4 text-lg font-semibold text-slate-700"
        >
          {t("assist.repeat")}
        </button>
        <button
          type="button"
          onClick={onListenToggle}
          className="rounded-2xl bg-white px-5 py-4 text-lg font-semibold text-slate-700"
        >
          <span className="inline-flex items-center gap-2">
            <Mic className="h-5 w-5" />
            {isListening ? t("assist.stopListening") : t("assist.listen")}
          </span>
        </button>
      </div>

      {voiceQuery && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-slate-700">
          <span className="mr-2 inline-flex items-center gap-2 text-sky-700">
            <Mic className="h-4 w-4" />
            {t("assist.listen")}
          </span>
          {voiceQuery}
        </div>
      )}

      {scannedStop && (
        <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-slate-800">
          <div className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            <ScanSearch className="h-4 w-4" />
            {t("qr.stopDetected")}
          </div>
          <div className="mt-2 text-xl font-semibold">{scannedStop.stop_name}</div>
          <div className="text-sm text-slate-600">
            {scannedStop.lat.toFixed(4)}, {scannedStop.lng.toFixed(4)}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-[1.6rem] bg-white p-5 shadow-sm">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{t("assist.summary")}</div>
        <p className="mt-2 text-lg font-semibold text-slate-800">{aiBrief?.summary ?? t("assist.lost")}</p>

        <div className="mt-5 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{t("assist.steps")}</div>
        <div className="mt-3 space-y-3">
          {(aiBrief?.steps ?? []).map((step, index) => (
            <div key={`${index}-${step}`} className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-700">
              <span className="mr-2 font-bold text-sky-700">{index + 1}.</span>
              {step}
            </div>
          ))}
          {!aiBrief?.steps?.length && (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-600">{t("assist.lost")}</div>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-cyan-800">
            <Shield className="h-4 w-4" />
            {t("assist.sms")}
          </div>
          <p className="text-sm text-slate-700">{aiBrief?.message_draft ?? t("assist.smsDescription")}</p>
          {aiBrief?.message_draft && (
            <button
              type="button"
              onClick={() => onCopyMessage(aiBrief.message_draft)}
              className="mt-3 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {t("common.copyMessage")}
            </button>
          )}
        </div>

        {recommendedOption && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-800">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-amber-800">
              {t("compare.recommended")}
            </div>
            <div className="mt-1 text-lg font-semibold">{recommendedOption.label}</div>
            <p className="mt-1 text-sm text-slate-700">{recommendedOption.note}</p>
          </div>
        )}
      </div>
    </section>
  );
}
