"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/providers/language-provider";
import { appendSpokenText } from "@/lib/speech/append-transcript";
import { speechLanguageForUi } from "@/lib/speech/locale";
import {
  SpeechRecorderError,
  canRecordAudio,
  startAudioRecording,
} from "@/lib/speech/record-audio";
import { cn } from "@/lib/utils";

type VoiceStatus = "idle" | "recording" | "processing";
type VoiceError = "permission" | "recognize" | "unsupported" | null;

export function ExperienceNoteField({
  value,
  placeholder,
  invalid,
  onChange,
}: {
  value: string;
  placeholder: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const { language, t } = useLanguage();
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const sessionRef = useRef<{ stop: () => Promise<{ blob: Blob; filename: string }>; cancel: () => void } | null>(
    null,
  );
  const aliveRef = useRef(true);
  const startingRef = useRef(false);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<VoiceError>(null);

  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      sessionRef.current?.cancel();
      sessionRef.current = null;
    };
  }, []);

  async function transcribe(recording: { blob: Blob; filename: string }) {
    const formData = new FormData();
    formData.append("audio", recording.blob, recording.filename);
    formData.append("language", speechLanguageForUi(language));

    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error("transcribe_failed");
    }
    const payload = (await response.json()) as { text?: unknown };
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text) {
      throw new Error("empty_transcript");
    }
    return text;
  }

  async function stopRecording() {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (!session) return;
    setStatus("processing");
    setError(null);
    try {
      const recording = await session.stop();
      const spoken = await transcribe(recording);
      if (!aliveRef.current) return;
      onChangeRef.current(appendSpokenText(valueRef.current, spoken));
      setStatus("idle");
    } catch {
      if (!aliveRef.current) return;
      setError("recognize");
      setStatus("idle");
    }
  }

  async function startRecording() {
    if (status !== "idle" || startingRef.current) return;
    if (!canRecordAudio()) {
      setError("unsupported");
      return;
    }
    startingRef.current = true;
    setError(null);
    try {
      const session = await startAudioRecording();
      if (!aliveRef.current) {
        session.cancel();
        return;
      }
      sessionRef.current = session;
      setStatus("recording");
      autoStopRef.current = setTimeout(() => {
        void stopRecording();
      }, 60_000);
    } catch (caught) {
      if (!aliveRef.current) return;
      if (caught instanceof SpeechRecorderError && caught.code === "permission_denied") {
        setError("permission");
        return;
      }
      setError(caught instanceof SpeechRecorderError && caught.code === "unsupported" ? "unsupported" : "permission");
    } finally {
      startingRef.current = false;
    }
  }

  function handleMicClick() {
    if (status === "processing") return;
    if (status === "recording") {
      void stopRecording();
      return;
    }
    void startRecording();
  }

  const errorMessage =
    error === "permission"
      ? t.experience.q7MicPermission
      : error === "unsupported"
        ? t.experience.q7MicUnsupported
        : error === "recognize"
          ? t.experience.q7MicError
          : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          value={value}
          placeholder={placeholder}
          aria-invalid={invalid}
          className="resize-none pb-14 pr-14"
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={status === "recording" ? t.experience.q7MicStop : t.experience.q7MicLabel}
          aria-pressed={status === "recording"}
          disabled={status === "processing"}
          className={cn(
            "absolute bottom-2.5 right-2.5 flex size-11 items-center justify-center rounded-full border shadow-sm transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
            "disabled:pointer-events-none disabled:opacity-50",
            status === "recording"
              ? "border-red-500 bg-red-500 text-white"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
          onClick={handleMicClick}
        >
          {status === "processing" ? (
            <Loader2 className="size-5 animate-spin" />
          ) : status === "recording" ? (
            <span className="size-3.5 rounded-sm bg-white" />
          ) : (
            <Mic className="size-5" />
          )}
        </button>
      </div>
      {status === "recording" ? (
        <p className="text-sm font-medium text-foreground" aria-live="polite">
          {t.experience.q7MicListening}{" "}
          <button type="button" className="underline underline-offset-2" onClick={() => void stopRecording()}>
            {t.experience.q7MicStop}
          </button>
        </p>
      ) : null}
      {status === "processing" ? (
        <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
          {t.experience.q7MicProcessing}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
