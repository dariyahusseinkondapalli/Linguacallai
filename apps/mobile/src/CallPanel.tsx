import React, { useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import QRCode from "react-native-qrcode-svg";
import * as Speech from "expo-speech";
import type { Language } from "@linguacall/shared";
import { createCallEngine, type CallEngine } from "./rtc";
import { VoicePanel } from "./VoicePanel";
import { audio } from "./audio";
import { colors as c } from "./theme";
type Membership = {
  sessionId: string;
  memberToken: string;
  memberId: string;
  code: string;
  mode: "paired" | "call";
  initiator: boolean;
  expires: number;
};
export function CallPanel({
  endpoint,
  token,
  language,
}: {
  endpoint: string;
  token: string;
  language: Language;
}) {
  const route = useRoute();
  const [code, setCode] = useState(
    (route.params as { code?: string } | undefined)?.code ?? "",
  );
  const [session, setSession] = useState<Membership | null>(null);
  const [status, setStatus] = useState("Not connected");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [captions, setCaptions] = useState<
    { id: number; text: string; translation?: string }[]
  >([]);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [voiceTurns, setVoiceTurns] = useState(false);
  const [incomingSpeech, setIncomingSpeech] = useState<
    { id: number; text: string } | undefined
  >();
  const ws = useRef<WebSocket | null>(null);
  const engine = useRef<Promise<CallEngine> | null>(null);
  const current = useRef<Membership | null>(null);
  const reconnect = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const requests = useRef(new Set<AbortController>());
  const latest = useRef({ language, endpoint, token, muted });
  latest.current = { language, endpoint, token, muted };
  const attempts = useRef(0);
  const send = (data: unknown) => {
    if (ws.current?.readyState !== WebSocket.OPEN)
      throw new Error("Session is reconnecting. Please wait.");
    ws.current.send(JSON.stringify(data));
  };
  const stop = () => {
    current.current = null;
    generation.current++;
    if (reconnect.current) clearTimeout(reconnect.current);
    if (ws.current?.readyState === WebSocket.OPEN)
      ws.current.send(JSON.stringify({ type: "end" }));
    ws.current?.close();
    ws.current = null;
    void engine.current?.then((e) => e.close()).catch(() => {});
    engine.current = null;
    for (const controller of requests.current) controller.abort();
    requests.current.clear();
    void Speech.stop();
    audio?.release();
    setSession(null);
    setStatus("Session ended");
    setMuted(false);
    setVoiceTurns(false);
    setIncomingSpeech(undefined);
    setSeconds(0);
  };
  const request = async (path: string, body?: unknown) => {
    const controller = new AbortController();
    requests.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${latest.current.endpoint}${path}`, {
        method: body ? "POST" : "GET",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${latest.current.token}`,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Request failed");
      return data;
    } finally {
      clearTimeout(timer);
      requests.current.delete(controller);
    }
  };
  const connect = (member: Membership) => {
    const id = generation.current;
    const socket = new WebSocket(
      endpoint.replace(/^http/, "ws") + "/v1/signal",
    );
    ws.current = socket;
    socket.onopen = () => {
      if (current.current !== member) {
        socket.close();
        return;
      }
      socket.send(
        JSON.stringify({
          type: "auth",
          sessionId: member.sessionId,
          memberToken: member.memberToken,
        }),
      );
    };
    socket.onmessage = (event) => {
      if (id !== generation.current || current.current !== member) return;
      void (async () => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ready") {
            attempts.current = 0;
            setStatus("Waiting for the other participant");
          }
          if (data.type === "peer-ready") {
            setStatus("Participant connected");
            if (member.mode === "call") {
              const previous = engine.current;
              engine.current = (async () => {
                if (previous)
                  await previous.then((e) => e.close()).catch(() => {});
                const config = await request("/v1/ice");
                const rtc = await createCallEngine(
                  config.iceServers,
                  (signal) => send({ type: "signal", signal }),
                  (state) => {
                    if (id === generation.current)
                      setStatus(
                        state === "failed"
                          ? "Call failed. End and rejoin; verify TURN configuration."
                          : `Call ${state}`,
                      );
                  },
                );
                if (id !== generation.current) {
                  rtc.close();
                  throw new Error("Call cancelled");
                }
                rtc.mute(latest.current.muted);
                return rtc;
              })();
              if (member.initiator) await (await engine.current).offer();
              else await engine.current;
            }
          }
          if (data.type === "signal") {
            if (engine.current)
              await (await engine.current).receive(data.signal);
          }
          if (data.type === "peer-away") {
            setVoiceTurns(false); setMuted(true);
            void engine.current?.then(e => e.mute(true)).catch(() => {});
            setStatus("Participant disconnected · microphone muted · waiting up to 30 seconds");
          }
          if (data.type === "ended") stop();
          if (data.type === "error") setError(data.message);
          if (data.type === "caption") {
            const captionId = Date.now() + Math.random();
            setCaptions((old) =>
              [...old, { id: captionId, text: data.text }].slice(-30),
            );
            const translated = await request("/v1/translate", {
              text: data.text,
              source: data.language,
              target: latest.current.language,
            });
            if (id !== generation.current) return;
            setCaptions((old) =>
              old.map((caption) =>
                caption.id === captionId
                  ? { ...caption, translation: translated.text }
                  : caption,
              ),
            );
            setIncomingSpeech({ id: captionId, text: translated.text });
          }
        } catch (e) {
          if (id === generation.current)
            setError(e instanceof Error ? e.message : "Session error");
        }
      })();
    };
    socket.onerror = () => setStatus("Connection interrupted");
    socket.onclose = () => {
      if (current.current !== member) return;
      if (++attempts.current > 5) {
        stop();
        setError("Unable to reconnect. Start a new session.");
        return;
      }
      setStatus("Reconnecting…");
      reconnect.current = setTimeout(
        () => connect(member),
        Math.min(5000, attempts.current * 1000),
      );
    };
  };
  const begin = async (mode: "paired" | "call" | "join") => {
    setBusy(true);
    setError("");
    const id = ++generation.current;
    try {
      if (!endpoint || !token)
        throw new Error("Connect the API and sign in in Settings first.");
      const member = await request(
        mode === "join" ? "/v1/sessions/join" : "/v1/sessions",
        mode === "join" ? { code: code.trim(), language } : { mode, language },
      );
      if (id !== generation.current) return;
      current.current = member;
      setSession(member);
      setCaptions([]);
      connect(member);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create session");
    } finally {
      setBusy(false);
    }
  };
  const submit = async (text: string, source: Language) => {
    send({ type: "caption", text, language: source });
    setCaptions((old) =>
      [...old, { id: Date.now(), text: `You: ${text}` }].slice(-30),
    );
    setMessage("");
  };
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" && current.current) stop();
    });
    const route = audio?.addListener("routeChanged", () => {
      if (current.current) {
        stop();
        setError(
          "Audio route changed. Session stopped to prevent unexpected playback.",
        );
      }
    });
    const focus = audio?.addListener("focusLost", stop);
    return () => {
      stop();
      sub.remove();
      route?.remove();
      focus?.remove();
    };
  }, []);
  useEffect(() => {
    if (current.current) {
      try {
        send({ type: "language", language });
      } catch {
        /* Reconnection retains preference on next message. */
      }
    }
  }, [language]);
  useEffect(() => {
    stop();
  }, [endpoint, token]);
  useEffect(() => {
    if (!session) return;
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [session]);
  const play = async (text: string) => {
    try {
      const voice = (await Speech.getAvailableVoicesAsync()).find(
        (v) => v.language.split("-")[0] === language,
      );
      if (!voice)
        throw new Error("Install a TTS voice for your preferred language.");
      await Speech.stop();
      Speech.speak(text, { voice: voice.identifier, language: voice.language });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Playback failed");
    }
  };
  const Button = ({
    label,
    onPress,
    disabled = false,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={[s.button, disabled && { opacity: 0.4 }]}
    >
      <Text style={s.white}>{label}</Text>
    </Pressable>
  );
  const invite = session ? `linguacall://calls?code=${session.code}` : "";
  return (
    <View style={s.card}>
      <Text style={s.title}>Two people. Their own languages.</Text>
      <Text accessibilityLiveRegion="polite" style={s.text}>
        {status}
        {session
          ? ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
          : ""}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
      {!session ? (
        <>
          <Text style={s.text}>
            Sign in to a separate account on each phone. Both devices must use
            the same API. Internet calls need operator-configured STUN/TURN for
            reliable connectivity.
          </Text>
          <Button
            label="Create paired translation session"
            disabled={busy}
            onPress={() => void begin("paired")}
          />
          <Button
            label="Start internet voice call"
            disabled={busy}
            onPress={() => void begin("call")}
          />
          <TextInput
            accessibilityLabel="Session invite code"
            autoCapitalize="none"
            autoCorrect={false}
            value={code}
            onChangeText={setCode}
            placeholder="12-character invite code"
            style={s.input}
          />
          <Button
            label="Join session"
            disabled={busy || code.trim().length !== 12}
            onPress={() => void begin("join")}
          />
        </>
      ) : (
        <>
          <Text style={s.title}>Invite: {session.code}</Text>
          <QRCode value={invite} size={170} />
          <Text style={s.text}>
            Scan with the other phone’s camera, or share the code. Invite is
            single-use and expires with the session.
          </Text>
          <Button
            label="Share invite"
            onPress={() =>
              void Share.share({
                message: `Join my LinguaCall session: ${invite}\nCode: ${session.code}\nUse the same API configured on both phones.`,
              })
            }
          />
          {session.mode === "call" ? (
            <>
              <Button
                label={muted ? "Unmute microphone" : "Mute microphone"}
                onPress={() => {
                  const value = !muted;
                  setMuted(value);
                  void engine.current
                    ?.then((e) => e.mute(value))
                    .catch(() => {});
                }}
              />
              <Text style={s.text}>
                WebRTC requests noise suppression and echo cancellation;
                effectiveness is device-dependent. Use translated voice turns to
                temporarily release the call microphone for speech recognition.
                Return to the voice call to send original audio again.
              </Text>
              <Button
                label={
                  voiceTurns
                    ? "Return to voice call"
                    : "Use translated voice turns"
                }
                onPress={() => {
                  void (async () => {
                    try {
                      if (!engine.current)
                        throw new Error(
                          "Wait for the participant to connect first.",
                        );
                      const rtc = await engine.current;
                      if (voiceTurns) {
                        setVoiceTurns(false);
                        await new Promise((resolve) =>
                          setTimeout(resolve, 300),
                        );
                        await rtc.resume();
                      } else {
                        await rtc.suspend();
                        setVoiceTurns(true);
                      }
                    } catch (e) {
                      setError(
                        e instanceof Error
                          ? e.message
                          : "Microphone switch failed",
                      );
                    }
                  })();
                }}
              />
              {voiceTurns ? (
                <VoicePanel
                  endpoint={endpoint}
                  token={token}
                  source={language}
                  target={language}
                  onTranscript={submit}
                  externalSpeech={incomingSpeech}
                />
              ) : null}
            </>
          ) : (
            <VoicePanel
              endpoint={endpoint}
              token={token}
              source={language}
              target={language}
              onTranscript={submit}
              externalSpeech={incomingSpeech}
            />
          )}
          <TextInput
            accessibilityLabel="Message to participant"
            multiline
            maxLength={2000}
            style={s.input}
            value={message}
            onChangeText={setMessage}
            placeholder="Send a phrase for translation"
          />
          <Button
            label="Send phrase"
            disabled={!message.trim()}
            onPress={() =>
              void submit(message, language).catch((e) => setError(e.message))
            }
          />
          {captions.map((caption) => (
            <View key={caption.id} style={s.caption}>
              <Text selectable style={s.text}>
                {caption.text}
              </Text>
              {caption.translation ? (
                <>
                  <Text selectable style={s.title}>
                    {caption.translation}
                  </Text>
                  <Button
                    label="Play translation"
                    onPress={() => void play(caption.translation!)}
                  />
                </>
              ) : null}
            </View>
          ))}
          <Button label="End session" onPress={stop} />
        </>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 22,
    gap: 16,
    backgroundColor: "white",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
  },
  title: { fontSize: 19, lineHeight: 28, color: c.text, fontWeight: "600" },
  text: { fontSize: 14, lineHeight: 23, color: c.muted },
  button: {
    minHeight: 52,
    padding: 12,
    backgroundColor: c.blue,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  white: { color: "white", fontWeight: "600" },
  input: {
    minHeight: 52,
    padding: 14,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 16,
    color: c.text,
  },
  caption: {
    gap: 12,
    padding: 14,
    backgroundColor: c.surface,
    borderRadius: 12,
  },
  error: { color: "#B42318", lineHeight: 22 },
});
