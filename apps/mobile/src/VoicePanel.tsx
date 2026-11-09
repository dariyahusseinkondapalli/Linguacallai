import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import {
  ExpoSpeechRecognitionModule as recognition,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import * as Speech from "expo-speech";
import {
  languages,
  type Language,
  type TranslationResult,
} from "@linguacall/shared";
import { audio } from "./audio";
import { isCallMicrophoneActive } from "./capture";
import { colors as c } from "./theme";
export interface VoiceProps {
  endpoint: string;
  token: string;
  source: Language | "auto";
  target: Language;
  onResult?: (original: string, result: TranslationResult) => void;
  onTranscript?: (text: string, language: Language) => Promise<void>;
  externalSpeech?: { id: number; text: string };
}
export function VoicePanel({
  endpoint,
  token,
  source,
  target,
  onResult,
  onTranscript,
  externalSpeech,
}: VoiceProps) {
  const [enhanced, setEnhanced] = useState(false);
  const [state, setState] = useState("idle");
  const [caption, setCaption] = useState("");
  const [translated, setTranslated] = useState("");
  const [error, setError] = useState("");
  const [level, setLevel] = useState(0);
  const [detected, setDetected] = useState("");
  const active = useRef(false);
  const processing = useRef(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abort = useRef<AbortController | null>(null);
  const focused = useIsFocused();
  const callbacks = useRef({ onResult, onTranscript });
  callbacks.current = { onResult, onTranscript };
  const stop = () => {
    active.current = false;
    processing.current = false;
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    abort.current?.abort();
    recognition.abort();
    void Speech.stop();
    audio?.release();
    setState("idle");
    setLevel(0);
    setEnhanced(false);
  };
  const begin = () => {
    if (!active.current || processing.current) return;
    try {
      audio?.enhanceCapture();
      recognition.start({
        lang: languages.find(
          (l) => l.code === (source === "auto" ? "en" : source),
        )!.locale,
        interimResults: true,
        continuous: true,
        recordingOptions: { persist: false },
        volumeChangeEventOptions: { enabled: true, intervalMillis: 150 },
        androidIntentOptions:
          source === "auto"
            ? {
                EXTRA_ENABLE_LANGUAGE_DETECTION: true,
                EXTRA_ENABLE_LANGUAGE_SWITCH: "balanced",
              }
            : {},
      });
      setState("listening");
    } catch (e) {
      stop();
      setError(e instanceof Error ? e.message : "Microphone could not start.");
    }
  };
  const restart = () => {
    if (active.current && !processing.current) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(begin, 700);
    }
  };
  useSpeechRecognitionEvent("volumechange", (e) =>
    setLevel(Math.max(0, Math.min(1, e.value / 10))),
  );
  useSpeechRecognitionEvent("languagedetection", (e) =>
    setDetected(`${e.detectedLanguage} · ${Math.round(e.confidence * 100)}%`),
  );
  useSpeechRecognitionEvent("end", restart);
  useSpeechRecognitionEvent("error", (e) => {
    if (!active.current) return;
    if (e.error === "no-speech") {
      restart();
      return;
    }
    stop();
    setError(
      `${e.message} Select a language manually or check your installed speech service.`,
    );
  });
  useSpeechRecognitionEvent("result", (e) => {
    const text = e.results[0]?.transcript;
    if (!active.current || !text) return;
    setCaption(text);
    if (!e.isFinal || processing.current) return;
    processing.current = true;
    const id = generation.current;
    recognition.stop();
    setState("translating");
    void (async () => {
      try {
        if (callbacks.current.onTranscript) {
          await callbacks.current.onTranscript(
            text,
            source === "auto" ? "en" : source,
          );
          return;
        }
        const controller = new AbortController();
        abort.current = controller;
        const timeout = setTimeout(() => controller.abort(), 20000);
        let result: TranslationResult;
        try {
          const response = await fetch(`${endpoint}/v1/translate`, {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ text, source, target }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Translation failed");
          result = data;
        } finally {
          clearTimeout(timeout);
        }
        if (!active.current || id !== generation.current) return;
        setTranslated(result.text);
        callbacks.current.onResult?.(text, result);
        const voices = await Speech.getAvailableVoicesAsync();
        const voice = voices.find((v) => v.language.split("-")[0] === target);
        if (!active.current || id !== generation.current) return;
        if (!voice)
          throw new Error(
            "No installed voice for the target language. Captions are available; install a matching TTS voice in Android settings.",
          );
        setState("speaking");
        await new Promise<void>((resolve, reject) =>
          Speech.speak(result.text, {
            voice: voice.identifier,
            language: voice.language,
            onDone: resolve,
            onStopped: resolve,
            onError: () => reject(new Error("Speech playback failed.")),
          }),
        );
      } catch (e) {
        if (id === generation.current) {
          stop();
          setError(
            e instanceof Error ? e.message : "Voice translation failed.",
          );
        }
      } finally {
        if (id === generation.current) {
          processing.current = false;
          restart();
        }
      }
    })();
  });
  useEffect(() => {
    stop();
  }, [source, target, focused, endpoint, token]); // Stops capture when tab or language changes.
  useEffect(() => {
    const effects = audio?.addListener("effectsChanged", (data) =>
      setEnhanced(data.effectsActive),
    );
    const sub = AppState.addEventListener("change", (s) => {
      if (s !== "active") stop();
    });
    const route = audio?.addListener("routeChanged", () => {
      if (active.current) {
        stop();
        setError("Audio route changed. Confirm your output and start again.");
      }
    });
    const focus = audio?.addListener("focusLost", () => {
      stop();
      setError("Audio interrupted. Start again when ready.");
    });
    return () => {
      stop();
      sub.remove();
      route?.remove();
      focus?.remove();
      effects?.remove();
    };
  }, []);
  useEffect(() => {
    if (!externalSpeech) return;
    const resume = active.current;
    stop();
    const id = generation.current;
    setTranslated(externalSpeech.text);
    setState("speaking");
    void (async () => {
      try {
        const voice = (await Speech.getAvailableVoicesAsync()).find(
          (v) => v.language.split("-")[0] === target,
        );
        if (id !== generation.current) return;
        if (!voice) throw new Error("No matching TTS voice installed.");
        Speech.speak(externalSpeech.text, {
          voice: voice.identifier,
          language: voice.language,
          onDone: () => {
            if (id === generation.current) {
              setState("idle");
              if (resume) {
                active.current = true;
                begin();
              }
            }
          },
          onError: () => {
            if (id === generation.current) {
              setState("idle");
              setError("Incoming speech playback failed.");
            }
          },
        });
      } catch (e) {
        if (id === generation.current) {
          setState("idle");
          setError(e instanceof Error ? e.message : "Speech unavailable");
        }
      }
    })();
  }, [externalSpeech]);
  const start = async () => {
    if (isCallMicrophoneActive()) { setError("Switch the active call to translated voice turns or end it before starting recognition."); return; }
    const requestId = ++generation.current;
    setError("");
    if (!endpoint || !token) {
      setError("Connect the API in Settings first.");
      return;
    }
    if (!recognition.isRecognitionAvailable()) {
      setError("No speech recognition service is installed.");
      return;
    }
    const permission = await recognition.requestPermissionsAsync();
    if (requestId !== generation.current) return;
    if (!permission.granted) {
      setError(
        "Microphone permission is required. Enable it in Android app settings.",
      );
      return;
    }
    if (audio && !audio.acquireFocus()) {
      setError("Audio is being used by another app.");
      return;
    }
    active.current = true;
    generation.current++;
    begin();
  };
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Nearby live listening</Text>
      <Text style={styles.text}>
        The phone’s speech service may send audio to its provider. No audio
        files are saved. Recognition pauses during translated playback.
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.status}>
        {state.toUpperCase()}
        {detected ? ` · ${detected}` : ""}
      </Text>
      <View accessibilityLabel="Microphone input level" style={styles.meter}>
        <View
          style={{
            height: 6,
            width: `${Math.round(level * 100)}%`,
            backgroundColor: c.blue,
          }}
        />
      </View>
      {caption ? (
        <Text selectable style={styles.text}>
          {caption}
        </Text>
      ) : null}
      {translated ? (
        <Text selectable style={styles.title}>
          {translated}
        </Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => (active.current ? stop() : void start())}
        style={styles.button}
      >
        <Text style={styles.white}>
          {state === "idle" ? "Start listening" : "Stop listening"}
        </Text>
      </Pressable>
      <Text style={styles.text}>
        Microphone noise suppression: {enhanced ? "active" : "not confirmed"}.
        Android must expose this app’s capture session before effects can
        attach. Automatic language switching needs Android 14+ and compatible
        installed models; manual language selection is the fallback.
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: 22,
    gap: 15,
    backgroundColor: "white",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
  },
  title: { fontSize: 20, color: c.text, fontWeight: "600" },
  text: { fontSize: 14, lineHeight: 23, color: c.muted },
  status: { fontSize: 12, fontWeight: "700", color: c.blue },
  meter: {
    height: 6,
    backgroundColor: c.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  button: {
    minHeight: 52,
    backgroundColor: c.blue,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  white: { color: "white", fontWeight: "600" },
  error: { color: "#B42318", lineHeight: 22 },
});
