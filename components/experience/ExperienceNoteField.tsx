"use client";

import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/components/providers/language-provider";
import { appendSpokenText } from "@/lib/speech/append-transcript";
import { simplifyChineseIfPresent } from "@/lib/speech/to-simplified";
import {
  canUseLiveSpeech,
  createLiveSpeechRecognition,
  splitTranscripts,
  type LiveSpeechRecognition,
} from "@/lib/speech/web-speech";
import { cn } from "@/lib/utils";

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
  const recognitionRef = useRef<LiveSpeechRecognition | null>(null);
  const listeningRef = useRef(false);
  const baseTextRef = useRef("");
  const committedRef = useRef("");
  const finalsRef = useRef("");
  const networkFailsRef = useRef(0);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<VoiceError>(null);

  valueRef.current = value;
  onChangeRef.current = onChange;

  function publish(interim: string) {
    const spoken = simplifyChineseIfPresent(`${finalsRef.current}${interim}`);
    onChangeRef.current(appendSpokenText(baseTextRef.current, spoken));
  }

  function stopListening() {
    listeningRef.current = false;
    setListening(false);
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.stop();
    } catch {
      /* already stopped */
    }
  }

  function startListening() {
    if (listeningRef.current) return;
    if (!canUseLiveSpeech()) {
      setError("unsupported");
      return;
    }

    const recognition = createLiveSpeechRecognition(language);
    if (!recognition) {
      setError("unsupported");
      return;
    }

    baseTextRef.current = valueRef.current;
    committedRef.current = "";
    finalsRef.current = "";
    networkFailsRef.current = 0;
    setError(null);

    recognition.onresult = (event) => {
      networkFailsRef.current = 0;
      setError(null);
      const { finals, interim } = splitTranscripts(event);
      finalsRef.current = `${committedRef.current}${finals}`;
      publish(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "audio-capture") {
        listeningRef.current = false;
        setListening(false);
        setError("permission");
        return;
      }
      if (event.error === "service-not-allowed") {
        listeningRef.current = false;
        setListening(false);
        setError("unsupported");
        return;
      }
      if (event.error === "network") {
        networkFailsRef.current += 1;
        if (networkFailsRef.current >= 3) {
          listeningRef.current = false;
          setListening(false);
          setError("recognize");
        }
      }
    };

    recognition.onend = () => {
      if (!listeningRef.current) {
        recognitionRef.current = null;
        return;
      }
      committedRef.current = finalsRef.current;
      try {
        recognition.start();
      } catch {
        listeningRef.current = false;
        setListening(false);
      }
    };

    recognitionRef.current = recognition;
    listeningRef.current = true;
    setListening(true);
    try {
      recognition.start();
    } catch {
      listeningRef.current = false;
      recognitionRef.current = null;
      setListening(false);
      setError("unsupported");
    }
  }

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  function handleMicClick() {
    if (listening) {
      stopListening();
      return;
    }
    startListening();
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
          aria-label={listening ? t.experience.q7MicStop : t.experience.q7MicLabel}
          aria-pressed={listening}
          className={cn(
            "absolute bottom-2.5 right-2.5 flex size-11 items-center justify-center rounded-full border shadow-sm transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
            listening
              ? "border-red-500 bg-red-500 text-white"
              : "border-border bg-card text-foreground hover:bg-muted",
          )}
          onClick={handleMicClick}
        >
          {listening ? <span className="size-3.5 rounded-sm bg-white" /> : <Mic className="size-5" />}
        </button>
      </div>
      {listening ? (
        <p className="text-sm font-medium text-foreground" aria-live="polite">
          {t.experience.q7MicListening}{" "}
          <button type="button" className="underline underline-offset-2" onClick={stopListening}>
            {t.experience.q7MicStop}
          </button>
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
