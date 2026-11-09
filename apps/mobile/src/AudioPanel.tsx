import React, { useEffect, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { audio, bluetoothPermission, type AudioSnapshot } from "./audio";
export function AudioPanel() {
  const [snapshot, setSnapshot] = useState<AudioSnapshot | null>(null);
  const [error, setError] = useState("");
  const refresh = async () => {
    try {
      if (!audio)
        throw new Error(
          "Native audio route controls are available in the Android build.",
        );
      if (!(await bluetoothPermission()))
        throw new Error(
          "Bluetooth permission was denied. Use Android settings to choose your device.",
        );
      setSnapshot(audio.snapshot());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audio devices unavailable");
    }
  };
  useEffect(() => {
    const sub = audio?.addListener("routeChanged", () => void refresh());
    return () => sub?.remove();
  }, []);
  return (
    <View
      style={{
        padding: 22,
        gap: 14,
        backgroundColor: "white",
        borderRadius: 24,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "600" }}>Audio output</Text>
      <Text>
        The operating system chooses the speech-service microphone. Prefer the
        phone mic for nearby speakers. Communication-device selection can change
        both input and output.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void refresh()}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text style={{ color: "#2563EB" }}>Check connected devices</Text>
      </Pressable>
      {snapshot?.outputs.map((device) => (
        <Pressable
          key={device.id}
          accessibilityRole="button"
          disabled={!snapshot.canSelect}
          onPress={() => {
            try {
              if (!audio?.selectOutput(device.id))
                throw new Error("Android could not select this route.");
              setSnapshot(audio.snapshot());
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Route selection failed",
              );
            }
          }}
          style={{ minHeight: 48, justifyContent: "center" }}
        >
          <Text>
            {snapshot.selected === device.id ? "✓ " : ""}
            {device.name} · type {device.type}
          </Text>
        </Pressable>
      ))}
      {snapshot ? (
        <Text>
          Hardware noise suppression available:{" "}
          {snapshot.noiseSuppressionAvailable ? "yes" : "no"}. Hardware echo
          cancellation available:{" "}
          {snapshot.echoCancellationAvailable ? "yes" : "no"}. Speech-service
          effects active: unverified. WebRTC requests its own processing during
          calls.
        </Text>
      ) : null}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => void Linking.openSettings()}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Text style={{ color: "#2563EB" }}>Open Android app permissions</Text>
      </Pressable>
    </View>
  );
}
