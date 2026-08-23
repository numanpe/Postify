"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic } from "lucide-react";

// The Web Speech API's SpeechRecognition isn't in TypeScript's DOM lib
// yet — minimal ambient shape for exactly what's used here, not a full
// spec surface.
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// Support never changes mid-session, so this is a real, correct use of
// useSyncExternalStore purely for its no-hydration-mismatch guarantee:
// the server snapshot is always false (SSR has no `window`), and the
// client snapshot is read directly during render — no effect, no
// setState-after-mount flash, no mismatch warning.
const noopSubscribe = () => () => {};
function getSupportedSnapshot(): boolean {
  return !!getSpeechRecognitionCtor();
}
function getServerSnapshot(): boolean {
  return false;
}

// Real, free, zero-key voice input — the browser's own built-in speech
// recognition, no server round-trip and no BYOK provider involved (see
// the module's own doc note: Chrome's implementation does send audio to
// Google's servers under the hood to do the actual recognition, but
// that's the browser's business, not a call this app makes or a key
// this app needs). Support is genuinely uneven — full in Chrome/Edge/
// Opera, supported since Safari 14.1 (macOS)/14.5 (iOS) with the
// webkit-prefixed constructor, off by default in Firefox — so this
// renders nothing at all when unsupported (checked client-side only;
// SSR always renders null first) rather than showing a button that
// would silently do nothing when tapped.
export function VoiceInputButton({
  lang,
  onResult,
  startLabel,
  listeningLabel,
  errorMessages,
  className,
}: {
  lang: string;
  onResult: (text: string) => void;
  startLabel: string;
  listeningLabel: string;
  errorMessages: {
    notAllowed: string;
    noSpeech: string;
    network: string;
    generic: string;
  };
  className?: string;
}) {
  const supported = useSyncExternalStore(noopSubscribe, getSupportedSnapshot, getServerSnapshot);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Stop any in-flight recognition if the component unmounts mid-listen
  // (e.g. navigating away) rather than leaving the mic hot. No setState
  // here — just an external-system cleanup, the legitimate use of an
  // effect this rule is actually meant to allow.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (!supported) return null;

  function mapError(code: string): string {
    if (code === "not-allowed" || code === "service-not-allowed") return errorMessages.notAllowed;
    if (code === "no-speech") return errorMessages.noSpeech;
    if (code === "network") return errorMessages.network;
    return errorMessages.generic;
  }

  function start() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      // Live-fills as speech comes in (interim results included) — the
      // real, settled text lands once the API marks the last result
      // final, but the field never sits blank while the user is mid-
      // sentence. Never submits anything on its own; the caller just
      // receives text to put in a normal, still-editable field.
      let transcript = "";
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      onResult(transcript.trim());
    };
    recognition.onerror = (event) => {
      setError(mapError(event.error));
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      // start() throws if called while already listening (a rapid
      // double-tap) — not a real failure, just ignore it.
      setListening(false);
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return (
    <span className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-label={listening ? listeningLabel : startLabel}
        aria-pressed={listening}
        title={listening ? listeningLabel : startLabel}
        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border ${
          listening
            ? "animate-pulse border-primary text-primary dark:border-primary-dark dark:text-primary-dark"
            : "border-paper-border text-ink-soft hover:text-ink dark:border-night-border dark:text-ink-soft-dark dark:hover:text-ink-dark"
        }`}
      >
        <Mic size={18} aria-hidden="true" />
      </button>
      {error && (
        <span
          role="alert"
          className="absolute start-0 top-full z-10 mt-1 w-56 rounded-md border border-red-200 bg-paper p-2 text-xs text-red-600 shadow-sm dark:border-red-900 dark:bg-night-card dark:text-red-400"
        >
          {error}
        </span>
      )}
    </span>
  );
}
