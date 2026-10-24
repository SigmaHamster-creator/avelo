"use client";

/**
 * VoiceCaptureControl (Tasks 4.18-4.23): mic button + browser
 * SpeechRecognition lifecycle, concurrency guard, live transcript,
 * update summary, undo, and the typed-natural-language fallback input that
 * shares the same /api/voice/extract pipeline.
 *
 * Recording mechanism (documented per the brief): recognition runs in
 * continuous mode so natural pauses do NOT end the recording. Recording
 * ends when the caregiver clicks "Stop", after SILENCE_AUTO_STOP_MS with
 * no new speech once something has been heard, or after MAX_LISTEN_MS.
 * Only then is the full transcript sent for extraction -- never mid-sentence.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useBooking } from "@/components/booking/BookingProvider";
import { useLiveRegion } from "@/components/a11y/LiveRegionProvider";
import { Button } from "@/components/ui/Button";
import type { FormFieldPatch } from "@/domain/types";

type CaptureState = "idle" | "listening" | "transcribing" | "updating";
type VoiceErrorState =
  | null
  | "permission-denied"
  | "unsupported-browser"
  | "no-speech-detected"
  | "recording-failure"
  | "transcription-failure"
  | "ai-timeout"
  | "invalid-extraction";

const ERROR_MESSAGES: Record<Exclude<VoiceErrorState, null>, string> = {
  "permission-denied":
    "Microphone access was blocked. Allow microphone access for this site in your browser settings, or type your request below.",
  "unsupported-browser": "Voice input is not supported in this browser. Please use Chrome or Edge, or type your request below.",
  "no-speech-detected": "No speech was detected. Please try again, or type your request below.",
  "recording-failure": "We couldn't access your microphone. Check that it is connected, then try again, or type your request below.",
  "transcription-failure":
    "The speech service could not be reached or could not understand the recording. Please try again, or type your request below.",
  "ai-timeout": "That took too long to process. Your form was not changed. Please try again, or type your request below.",
  "invalid-extraction": "We couldn't process that update. Your form was not changed. Please try again, or type your request below.",
};

/** Stop automatically after this much silence, once some speech has been heard. */
const SILENCE_AUTO_STOP_MS = 4000;
/** Hard cap on a single recording. */
const MAX_LISTEN_MS = 60000;
/** Client-side timeout for the extraction request. */
const EXTRACTION_TIMEOUT_MS = 10000;

// Minimal ambient typing for the Web Speech API (not in the default TS DOM lib).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

interface ExtractResponse {
  patch: FormFieldPatch;
  clarificationNeeded?: string;
  note?: string;
  source: string;
}

export function VoiceCaptureControl() {
  const { state, applyVoicePatch, undoLastVoiceUpdate, requestEpochRef } = useBooking();
  const { announce } = useLiveRegion();
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [errorState, setErrorState] = useState<VoiceErrorState>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [typedText, setTypedText] = useState("");
  const [supported, setSupported] = useState<boolean | null>(null);

  const busyRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  const captureErrorRef = useRef<VoiceErrorState>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureStartVersionRef = useRef(0);
  const latestRef = useRef({ form: state.form, editVersion: state.editVersion });

  useEffect(() => {
    latestRef.current = { form: state.form, editVersion: state.editVersion };
  }, [state.form, state.editVersion]);

  useEffect(() => {
    // Feature detection must run client-side only (no `window` during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getSpeechRecognitionCtor() !== null);
  }, []);

  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    silenceTimerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  // Abort any recording if the component unmounts (e.g. navigation or reset).
  useEffect(() => {
    return () => {
      clearTimers();
      recognitionRef.current?.abort();
    };
  }, [clearTimers]);

  const runExtraction = useCallback(
    async (transcript: string, baseEditVersion: number) => {
      busyRef.current = true;
      setCaptureState("updating");
      announce("Updating your form.");
      const localEpoch = requestEpochRef.current;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

      try {
        const response = await fetch("/api/voice/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            transcript,
            currentFormSnapshot: latestRef.current.form,
            nowISO: new Date().toISOString(),
            formEditVersion: baseEditVersion,
          }),
        });

        if (requestEpochRef.current !== localEpoch) return; // the session was reset meanwhile

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          setErrorState(body?.error?.message?.includes("timed out") ? "ai-timeout" : "invalid-extraction");
          return;
        }

        const result = (await response.json()) as ExtractResponse;
        if (requestEpochRef.current !== localEpoch) return;

        if (!result || typeof result.patch !== "object" || result.patch === null) {
          setErrorState("invalid-extraction");
          return;
        }

        setErrorState(null);
        const note = [result.note, result.clarificationNeeded].filter(Boolean).join(" ") || undefined;
        applyVoicePatch(result.patch, baseEditVersion, transcript, note);
      } catch (err) {
        if (requestEpochRef.current !== localEpoch) return;
        setErrorState(err instanceof DOMException && err.name === "AbortError" ? "ai-timeout" : "invalid-extraction");
      } finally {
        clearTimeout(timeout);
        busyRef.current = false;
        setCaptureState("idle");
      }
    },
    [applyVoicePatch, announce, requestEpochRef],
  );

  const runExtractionRef = useRef(runExtraction);
  useEffect(() => {
    runExtractionRef.current = runExtraction;
  }, [runExtraction]);

  const stopListening = useCallback(() => {
    clearTimers();
    if (recognitionRef.current) {
      setCaptureState("transcribing");
      announce("Finishing up your recording.");
      recognitionRef.current.stop();
    }
  }, [announce, clearTimers]);

  const startListening = useCallback(() => {
    if (busyRef.current) return; // concurrency guard: ignore repeated clicks
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setErrorState("unsupported-browser");
      return;
    }

    busyRef.current = true;
    setErrorState(null);
    setLiveTranscript("");
    finalTextRef.current = "";
    interimTextRef.current = "";
    captureErrorRef.current = null;
    captureStartVersionRef.current = latestRef.current.editVersion;
    const localEpoch = requestEpochRef.current;

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = true; // natural pauses must not end the recording
    recognition.interimResults = true; // show words as they are heard
    recognitionRef.current = recognition;

    const armSilenceTimer = () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(stopListening, SILENCE_AUTO_STOP_MS);
    };

    recognition.onstart = () => {
      setCaptureState("listening");
      announce("Listening. Click Stop when you are finished.");
      maxTimerRef.current = setTimeout(stopListening, MAX_LISTEN_MS);
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTextRef.current += `${result[0].transcript} `;
        } else {
          interim += result[0].transcript;
        }
      }
      interimTextRef.current = interim;
      setLiveTranscript(`${finalTextRef.current}${interim}`.trim());
      armSilenceTimer();
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      if (event.error === "no-speech") captureErrorRef.current = "no-speech-detected";
      else if (event.error === "not-allowed" || event.error === "service-not-allowed") captureErrorRef.current = "permission-denied";
      else if (event.error === "audio-capture") captureErrorRef.current = "recording-failure";
      else captureErrorRef.current = "transcription-failure"; // e.g. "network"
    };

    recognition.onend = () => {
      clearTimers();
      recognitionRef.current = null;
      const transcript = `${finalTextRef.current}${interimTextRef.current}`.replace(/\s+/g, " ").trim();
      setLiveTranscript("");

      if (requestEpochRef.current !== localEpoch) {
        busyRef.current = false;
        setCaptureState("idle");
        return;
      }

      if (transcript) {
        void runExtractionRef.current(transcript, captureStartVersionRef.current);
        return;
      }

      busyRef.current = false;
      setCaptureState("idle");
      setErrorState(captureErrorRef.current ?? "no-speech-detected");
    };

    try {
      recognition.start();
    } catch {
      busyRef.current = false;
      recognitionRef.current = null;
      setErrorState("recording-failure");
    }
  }, [announce, clearTimers, requestEpochRef, stopListening]);

  const handleTypedSubmit = useCallback(() => {
    const text = typedText.trim();
    if (!text || busyRef.current) return;
    setTypedText("");
    setErrorState(null);
    void runExtraction(text, latestRef.current.editVersion);
  }, [typedText, runExtraction]);

  const busy = captureState === "transcribing" || captureState === "updating";

  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "12px",
        padding: "var(--space-md)",
        marginBottom: "var(--space-lg)",
        background: "var(--color-background)",
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: "4px" }}>Fill in the form by voice</p>
      <p style={{ fontSize: "var(--text-sm)", opacity: 0.85, marginBottom: "8px" }}>
        Speak in English. Click Stop when you are done, or pause for a few seconds. You can speak again to change any
        detail, and nothing is submitted until you review it.
      </p>

      {supported && (
        <Button
          type="button"
          onClick={captureState === "listening" ? stopListening : startListening}
          disabled={busy}
          style={{ marginBottom: "8px" }}
        >
          {captureState === "listening" ? "⏹ Stop" : busy ? "Please wait..." : "🎙 Start speaking"}
        </Button>
      )}
      {supported === false && (
        <p role="status" style={{ marginBottom: "8px" }}>
          Voice input is not supported in this browser. Use Chrome or Edge, or the text box below.
        </p>
      )}

      {captureState !== "idle" && (
        <p role="status" style={{ fontSize: "var(--text-sm)" }}>
          {captureState === "listening" && "Listening..."}
          {captureState === "transcribing" && "Transcribing..."}
          {captureState === "updating" && "Updating your form..."}
        </p>
      )}
      {captureState === "listening" && (
        <p aria-live="off" style={{ fontSize: "var(--text-sm)", fontStyle: "italic", marginTop: "4px", minHeight: "1.5em" }}>
          {liveTranscript ? `"${liveTranscript}"` : "Go ahead, I'm listening."}
        </p>
      )}

      {errorState && (
        <p role="alert" style={{ color: "var(--color-error)", fontSize: "var(--text-sm)", marginTop: "8px" }}>
          ⚠ {ERROR_MESSAGES[errorState]}
        </p>
      )}

      <div style={{ marginTop: "var(--space-md)" }}>
        <label htmlFor="typed-nl-input" style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
          {supported ? "Or describe your trip in your own words" : "Describe your trip in your own words"}
        </label>
        <textarea
          id="typed-nl-input"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          rows={2}
          style={{ width: "100%", borderRadius: "8px", border: "2px solid var(--color-border)", padding: "8px", fontSize: "var(--text-base)" }}
          placeholder='e.g. "Pick up my grandmother from Pine Valley Hospital at 4 PM"'
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleTypedSubmit}
          disabled={!typedText.trim() || captureState !== "idle"}
          style={{ marginTop: "8px" }}
        >
          Update form from text
        </Button>
      </div>

      {state.transcript && (
        <p style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-md)", fontStyle: "italic" }}>
          You said: &ldquo;{state.transcript}&rdquo;
        </p>
      )}
      {state.lastUpdateSummary && (
        <p role="status" style={{ fontSize: "var(--text-sm)", marginTop: "4px" }}>
          {state.lastUpdateSummary}
        </p>
      )}
      {state.lastVoicePatch && (
        <Button type="button" variant="secondary" onClick={undoLastVoiceUpdate} style={{ marginTop: "8px" }}>
          Undo last voice update
        </Button>
      )}
    </div>
  );
}
