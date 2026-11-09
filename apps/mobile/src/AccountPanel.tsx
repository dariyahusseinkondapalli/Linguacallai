import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
export function AccountPanel({
  endpoint,
  token,
  onToken,
}: {
  endpoint: string;
  token: string;
  onToken: (token: string) => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const action = async (kind: "register" | "login" | "logout" | "delete") => {
    setBusy(true);
    setStatus("");
    try {
      if (!endpoint) throw new Error("Save your API connection below first.");
      const response = await fetch(
        endpoint + (kind === "delete" ? "/v1/account" : `/v1/auth/${kind}`),
        {
          method: kind === "delete" ? "DELETE" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Enrollment-Token": enrollment,
          },
          body:
            kind === "login" || kind === "register"
              ? JSON.stringify({ name, password })
              : undefined,
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Account request failed");
      if (data.token) onToken(data.token);
      else onToken("");
      setPassword("");
      setEnrollment("");
      setStatus(
        kind === "delete"
          ? "Account deleted."
          : kind === "logout"
            ? "Signed out."
            : "Signed in. You can now create or join sessions.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Account request failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View
      style={{
        padding: 22,
        gap: 14,
        backgroundColor: "white",
        borderRadius: 24,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "600", color: "#14213D" }}>
        Beta account
      </Text>
      <Text>
        Each participant needs a separate account. Registration requires the
        operator’s enrollment token. Passwords require at least 12 characters.
      </Text>
      {[
        ["Account name", name, setName],
        ["Password", password, setPassword],
        ["Enrollment token (registration only)", enrollment, setEnrollment],
      ].map(([label, value, set]) => (
        <TextInput
          key={label as string}
          accessibilityLabel={label as string}
          placeholder={label as string}
          value={value as string}
          onChangeText={set as (v: string) => void}
          secureTextEntry={label !== "Account name"}
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            borderWidth: 1,
            borderColor: "#E6EAF0",
            padding: 14,
            borderRadius: 12,
            minHeight: 52,
          }}
        />
      ))}
      {(["login", "register", "logout", "delete"] as const).map((kind) => (
        <Pressable
          key={kind}
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void action(kind)}
          style={{
            minHeight: 48,
            justifyContent: "center",
            padding: 12,
            backgroundColor: "#EAF2FF",
            borderRadius: 12,
          }}
        >
          <Text style={{ color: "#2563EB" }}>
            {
              {
                login: "Sign in",
                register: "Create beta account",
                logout: "Sign out",
                delete: "Delete server account permanently",
              }[kind]
            }
          </Text>
        </Pressable>
      ))}
      {status ? <Text accessibilityLiveRegion="polite">{status}</Text> : null}
      <Text>
        Deleting your server account ends sessions and revokes sign-in tokens.
        Delete saved local history separately below.
      </Text>
    </View>
  );
}
