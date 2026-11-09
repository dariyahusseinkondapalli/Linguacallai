import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  NavigationContainer,
  type NavigationProp,
  useNavigation,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  languages,
  saveEntry,
  type Language,
  type HistoryEntry,
  type TranslationResult,
  type Capability,
} from "@linguacall/shared";
import { colors as c } from "./theme";
import { VoicePanel } from "./VoicePanel";
import { CallPanel } from "./CallPanel";
import { AccountPanel } from "./AccountPanel";
import { AudioPanel } from "./AudioPanel";

type Routes = {
  Home: undefined;
  Translate: undefined;
  Calls: undefined;
  History: undefined;
  Settings: undefined;
};
type Prefs = {
  onboarded: boolean;
  language: Language;
  history: boolean;
  endpoint: string;
};
const defaults: Prefs = {
  onboarded: false,
  language: "te",
  history: false,
  endpoint: "",
};
type State = {
  prefs: Prefs;
  update: (p: Partial<Prefs>) => void;
  entries: HistoryEntry[];
  setEntries: (e: HistoryEntry[]) => void;
  token: string;
  setToken: (t: string) => void;
  storageError: string;
};
const Context = createContext<State>(null!);
const useApp = () => useContext(Context);
const Tab = createBottomTabNavigator<Routes>();
const icons = {
  Home: "home-outline",
  Translate: "language-outline",
  Calls: "call-outline",
  History: "time-outline",
  Settings: "options-outline",
} as const;
function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: c.blue }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Page({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const { storageError } = useApp();
  return (
    <SafeAreaView style={s.safe} edges={["top", "left", "right"]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
      >
        <Text style={s.eyebrow}>LINGUACALL AI</Text>
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
        <Text style={s.subtitle}>{subtitle}</Text>
        {storageError ? (
          <Text accessibilityRole="alert" style={s.error}>
            {storageError}
          </Text>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
function LanguagePicker({
  value,
  onChange,
  auto = false,
}: {
  value: string;
  onChange: (v: Language | "auto") => void;
  auto?: boolean;
}) {
  return (
    <View style={s.wrap}>
      {(auto
        ? [{ code: "auto", name: "Detect", native: "Automatic" }, ...languages]
        : languages
      ).map((l) => (
        <Pressable
          key={l.code}
          accessibilityRole="button"
          accessibilityState={{ selected: value === l.code }}
          onPress={() => onChange(l.code as Language | "auto")}
          style={[s.language, value === l.code && s.selected]}
        >
          <Text style={[s.languageName, value === l.code && { color: c.blue }]}>
            {l.native}
          </Text>
          <Text style={s.small}>{l.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}
function Home() {
  const navigation = useNavigation<NavigationProp<Routes>>();
  const { prefs } = useApp();
  return (
    <Page
      title={"Every voice.\nA little closer."}
      subtitle="Break Language Barriers. Connect Every Voice."
    >
      <View style={s.hero}>
        <View style={s.mark}>
          <Ionicons name="language" size={40} color={c.blue} />
        </View>
        <Text style={s.heading}>A conversation starts here.</Text>
        <Text style={s.body}>Write in one language. Understand in yours.</Text>
        <Button
          label="Translate text"
          onPress={() => navigation.navigate("Translate")}
        />
      </View>
      <View style={s.row}>
        <Text style={s.heading}>Your space</Text>
        <Text style={s.badge}>EARLY DEVELOPMENT</Text>
      </View>
      <Card>
        <Text style={s.label}>PREFERRED LANGUAGE</Text>
        <Text style={s.heading}>
          {languages.find((l) => l.code === prefs.language)?.native}
        </Text>
        <Text style={s.body}>
          Change your listening and translation preference anytime.
        </Text>
        <Button
          secondary
          label="Language & preferences"
          onPress={() => navigation.navigate("Settings")}
        />
      </Card>
      <Card>
        <Ionicons name="headset-outline" size={28} color={c.violet} />
        <Text style={s.heading}>Built toward hands-free conversation</Text>
        <Text style={s.body}>
          Start nearby listening in Translate, or create a two-person session in
          Calls. Check connected audio devices in Settings.
        </Text>
        <Button
          secondary
          label="Explore calling status"
          onPress={() => navigation.navigate("Calls")}
        />
      </Card>
    </Page>
  );
}
function Translate() {
  const { prefs, entries, setEntries, token } = useApp();
  const [source, setSource] = useState<Language | "auto">("auto");
  const [target, setTarget] = useState<Language>(prefs.language);
  const [text, setText] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const latest = useRef({ prefs, entries });
  latest.current = { prefs, entries };
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    setTarget(prefs.language);
  }, [prefs.language]);
  const clear = () => {
    generation.current++;
    controller.current?.abort();
    setBusy(false);
    setResult(null);
    setError("");
  };
  const translate = async () => {
    clear();
    if (!prefs.endpoint || !token) {
      setError("Connect your development API in Settings first.");
      return;
    }
    const id = ++generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    const timer = setTimeout(() => abort.abort(), 20_000);
    try {
      const response = await fetch(`${prefs.endpoint}/v1/translate`, {
        method: "POST",
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text, source, target }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Translation failed");
      if (id !== generation.current) return;
      setResult(data);
      setEntries(
        saveEntry(
          latest.current.entries,
          {
            id: String(Date.now()),
            original: text,
            result: data.text,
            source: data.source,
            target,
            createdAt: new Date().toISOString(),
          },
          latest.current.prefs.history,
        ),
      );
    } catch (e) {
      if (id === generation.current)
        setError(
          e instanceof Error && e.name === "AbortError"
            ? "Request timed out. Check your connection and try again."
            : e instanceof Error
              ? e.message
              : "Unable to connect.",
        );
    } finally {
      clearTimeout(timer);
      if (id === generation.current) setBusy(false);
    }
  };
  return (
    <Page
      title="Say it your way."
      subtitle="Text translation and nearby live listening"
    >
      <VoicePanel
        endpoint={prefs.endpoint}
        token={token}
        source={source}
        target={target}
        onResult={(original, result) =>
          setEntries(
            saveEntry(
              latest.current.entries,
              {
                id: String(Date.now()),
                original,
                result: result.text,
                source: result.source,
                target,
                createdAt: new Date().toISOString(),
              },
              latest.current.prefs.history,
            ),
          )
        }
      />
      <Card>
        <Text style={s.label}>FROM</Text>
        <LanguagePicker
          auto
          value={source}
          onChange={(v) => {
            clear();
            setSource(v);
          }}
        />
        <Button
          secondary
          label="Swap languages"
          disabled={source === "auto"}
          onPress={() => {
            if (source !== "auto") {
              clear();
              setTarget(source);
              setSource(target);
            }
          }}
        />
        <Text style={s.label}>TO</Text>
        <LanguagePicker
          value={target}
          onChange={(v) => {
            clear();
            setTarget(v as Language);
          }}
        />
      </Card>
      <Card>
        <Text style={s.heading}>What would you like to say?</Text>
        <TextInput
          accessibilityLabel="Text to translate"
          multiline
          maxLength={2000}
          placeholder="Type a message…"
          value={text}
          onChangeText={(v) => {
            clear();
            setText(v);
          }}
          style={s.message}
        />
        <Text style={s.small}>
          {text.length}/2000 ·{" "}
          {prefs.history ? "History saving is on" : "History saving is off"}
        </Text>
        <Text style={s.small}>
          When you tap Translate, this text is sent through your API to its
          configured translation provider.
        </Text>
        {busy ? (
          <>
            <ActivityIndicator
              accessibilityLabel="Translating"
              color={c.blue}
            />
            <Button secondary label="Cancel translation" onPress={clear} />
          </>
        ) : (
          <Button
            label="Translate"
            disabled={!text.trim()}
            onPress={() => void translate()}
          />
        )}
      </Card>
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
      {result ? (
        <Card>
          <Text style={s.label}>TRANSLATION</Text>
          <Text selectable style={s.translation}>
            {result.text}
          </Text>
          <Text style={s.small}>
            {result.provider} · {result.elapsedMs} ms · source: {result.source}
            {result.confidence === undefined
              ? ""
              : ` · confidence ${Math.round(result.confidence * 100)}%`}
          </Text>
        </Card>
      ) : null}
    </Page>
  );
}
function Calls() {
  const { prefs, token } = useApp();
  return (
    <Page
      title="Connect every voice."
      subtitle="Paired translation and internet voice calls"
    >
      <CallPanel
        endpoint={prefs.endpoint}
        token={token}
        language={prefs.language}
      />
    </Page>
  );
}
function History() {
  const { entries, setEntries, prefs } = useApp();
  const [query, setQuery] = useState("");
  return (
    <Page
      title="Words worth keeping."
      subtitle="Your saved translations, under your control."
    >
      <TextInput
        accessibilityLabel="Search saved translations"
        placeholder="Search translations"
        value={query}
        onChangeText={setQuery}
        style={s.input}
      />
      {!prefs.history ? (
        <Card>
          <Text style={s.heading}>Private by default</Text>
          <Text style={s.body}>
            History is off. Enable it in Settings to save future translations on
            this device.
          </Text>
        </Card>
      ) : null}
      {!entries.length ? (
        <Text style={s.body}>No saved translations yet.</Text>
      ) : (
        <Button
          secondary
          label="Delete all saved translations"
          onPress={() => setEntries([])}
        />
      )}
      {entries
        .filter((e) =>
          `${e.original} ${e.result}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .map((e) => (
          <Card key={e.id}>
            <Text style={s.small}>
              {new Date(e.createdAt).toLocaleString()} · {e.source} → {e.target}
            </Text>
            <Text style={s.body}>{e.original}</Text>
            <Text selectable style={s.heading}>
              {e.result}
            </Text>
            <Button
              secondary
              label="Delete translation"
              onPress={() => setEntries(entries.filter((x) => x.id !== e.id))}
            />
          </Card>
        ))}
    </Page>
  );
}
function Settings() {
  const { prefs, update, token, setToken, setEntries } = useApp();
  const [url, setUrl] = useState(prefs.endpoint);
  const [key, setKey] = useState(token);
  const [status, setStatus] = useState("");
  const [checking, setChecking] = useState(false);
  const connect = async () => {
    setStatus("");
    let endpoint: string;
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" &&
        !(
          parsed.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
        )
      )
        throw new Error(
          "Use HTTPS, or localhost with adb reverse for development.",
        );
      if (parsed.username || parsed.password || parsed.search || parsed.hash)
        throw new Error(
          "Use a base URL without credentials, query or fragment.",
        );
      endpoint = parsed.toString().replace(/\/$/, "");
      if (key.length < 32)
        throw new Error("Enter the API token provided by your operator.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Invalid API URL");
      return;
    }
    setChecking(true);
    try {
      const response = await fetch(`${endpoint}/v1/capabilities`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Connection failed");
      update({ endpoint });
      setToken(key);
      setStatus(
        data.provider
          ? `Connected to ${data.provider}. Available source languages: ${(data.languages as Capability[]).map((l) => l.code).join(", ") || "none"}.`
          : "API connected. No translation provider configured.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setChecking(false);
    }
  };
  return (
    <Page
      title="Make it yours."
      subtitle="Language, privacy and connection preferences."
    >
      <AccountPanel
        endpoint={prefs.endpoint}
        token={token}
        onToken={setToken}
      />
      <AudioPanel />
      <Card>
        <Text style={s.heading}>Preferred language</Text>
        <LanguagePicker
          value={prefs.language}
          onChange={(v) => update({ language: v as Language })}
        />
      </Card>
      <Card>
        <View style={s.row}>
          <Text style={s.heading}>Save translation history</Text>
          <Switch
            accessibilityLabel="Save translation history on this device"
            value={prefs.history}
            onValueChange={(history) => {
              update({ history });
              if (!history) setEntries([]);
            }}
          />
        </View>
        <Text style={s.body}>
          Off by default. Turning this off deletes saved translations. Saved
          text uses app storage, not encrypted secure storage.
        </Text>
        <Button
          secondary
          label="Delete local data & disconnect"
          onPress={() => {
            update(defaults);
            setEntries([]);
            setToken("");
          }}
        />
      </Card>
      <Card>
        <Text style={s.heading}>Development API</Text>
        <Text style={s.body}>
          Use your own API endpoint. On Android, the token is held in secure
          storage. Web preview keeps it only in memory.
        </Text>
        <TextInput
          accessibilityLabel="API base URL"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="https://your-api.example"
          value={url}
          onChangeText={setUrl}
          style={s.input}
        />
        <TextInput
          accessibilityLabel="API access token"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="API access token"
          value={key}
          onChangeText={setKey}
          style={s.input}
        />
        <Button
          label={checking ? "Checking…" : "Save & test connection"}
          disabled={checking}
          onPress={() => void connect()}
        />
        {status ? (
          <Text accessibilityLiveRegion="polite" style={s.body}>
            {status}
          </Text>
        ) : null}
      </Card>
      <Card>
        <Text style={s.heading}>Audio & account availability</Text>
        <Text style={s.body}>
          Speech recognition uses your installed speech service. Audio effects
          and language coverage vary by device. Create a beta account for paired
          sessions and internet calls.
        </Text>
      </Card>
    </Page>
  );
}
export default function App() {
  const [prefs, setPrefs] = useState(defaults);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [token, setTokenState] = useState("");
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    void (async () => {
      try {
        const stored = await AsyncStorage.getItem("linguacall.preferences");
        const parsed = stored ? JSON.parse(stored) : {};
        const loaded = { ...defaults, ...parsed };
        if (!languages.some((l) => l.code === loaded.language))
          loaded.language = "te";
        setPrefs(loaded);
        if (loaded.history) {
          const history = await AsyncStorage.getItem("linguacall.history");
          if (history) setEntries(JSON.parse(history));
        }
        if (Platform.OS !== "web")
          setTokenState(
            (await SecureStore.getItemAsync("linguacall.token")) ?? "",
          );
      } catch {
        setStorageError(
          "Stored preferences could not be loaded. Defaults are active.",
        );
      } finally {
        setReady(true);
      }
    })();
  }, []);
  useEffect(() => {
    if (!ready) return;
    writeQueue.current = writeQueue.current
      .then(async () => {
        await AsyncStorage.setItem(
          "linguacall.preferences",
          JSON.stringify(prefs),
        );
        if (prefs.history)
          await AsyncStorage.setItem(
            "linguacall.history",
            JSON.stringify(entries),
          );
        else await AsyncStorage.removeItem("linguacall.history");
      })
      .catch(() =>
        setStorageError("Changes could not be saved on this device."),
      );
  }, [prefs, entries, ready]);
  const setToken = (value: string) => {
    setTokenState(value);
    if (Platform.OS !== "web") {
      writeQueue.current = writeQueue.current
        .then(async () => {
          if (value) await SecureStore.setItemAsync("linguacall.token", value);
          else await SecureStore.deleteItemAsync("linguacall.token");
        })
        .catch(() =>
          setStorageError("The API token could not be saved securely."),
        );
    }
  };
  const update = (p: Partial<Prefs>) => setPrefs((old) => ({ ...old, ...p }));
  if (!ready)
    return (
      <SafeAreaProvider>
        <View style={s.loading}>
          <Text style={s.title}>LinguaCall AI</Text>
          <ActivityIndicator color={c.blue} />
        </View>
      </SafeAreaProvider>
    );
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Context.Provider
        value={{
          prefs,
          update,
          entries,
          setEntries,
          token,
          setToken,
          storageError,
        }}
      >
        {!prefs.onboarded ? (
          <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.page}>
              <Text style={s.eyebrow}>WELCOME TO LINGUACALL</Text>
              <View style={s.mark}>
                <Ionicons name="language" size={44} color={c.blue} />
              </View>
              <Text style={s.title}>
                {"Your language.\nA world of connection."}
              </Text>
              <Text style={s.subtitle}>
                Choose the language you feel at home in.
              </Text>
              <LanguagePicker
                value={prefs.language}
                onChange={(v) => update({ language: v as Language })}
              />
              <Card>
                <Text style={s.heading}>You decide what stays.</Text>
                <Text style={s.body}>
                  History is off by default. Text goes to your configured
                  provider only when you translate. Listening starts only when
                  you tap Start listening. The speech service may process audio
                  in the cloud; no audio files are saved.
                </Text>
              </Card>
              <Button
                label="Get started"
                onPress={() => update({ onboarded: true })}
              />
            </ScrollView>
          </SafeAreaView>
        ) : (
          <NavigationContainer
            linking={{
              prefixes: ["linguacall://"],
              config: {
                screens: {
                  Home: "home",
                  Translate: "translate",
                  Calls: "calls",
                  History: "history",
                  Settings: "settings",
                },
              },
            }}
          >
            <Tab.Navigator
              screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: c.blue,
                tabBarInactiveTintColor: c.muted,
                tabBarStyle: {
                  height: 78,
                  paddingTop: 8,
                  paddingBottom: 14,
                  borderTopColor: c.border,
                },
                tabBarLabelStyle: { fontSize: 11 },
                tabBarIcon: ({ color, size }) => (
                  <Ionicons
                    name={icons[route.name]}
                    color={color}
                    size={size}
                  />
                ),
              })}
            >
              <Tab.Screen name="Home" component={Home} />
              <Tab.Screen name="Translate" component={Translate} />
              <Tab.Screen name="Calls" component={Calls} />
              <Tab.Screen name="History" component={History} />
              <Tab.Screen name="Settings" component={Settings} />
            </Tab.Navigator>
          </NavigationContainer>
        )}
      </Context.Provider>
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.surface },
  page: {
    padding: 24,
    paddingBottom: 48,
    gap: 22,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: c.blue,
    marginTop: 12,
  },
  title: {
    fontSize: 38,
    lineHeight: 46,
    fontWeight: "700",
    letterSpacing: -1.3,
    color: c.text,
  },
  subtitle: { fontSize: 16, lineHeight: 25, color: c.muted },
  card: {
    padding: 22,
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
  },
  hero: { padding: 26, gap: 20, borderRadius: 28, backgroundColor: c.softBlue },
  mark: {
    width: 80,
    height: 80,
    borderRadius: 25,
    backgroundColor: c.softBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: 20,
    lineHeight: 29,
    fontWeight: "600",
    color: c.text,
    flexShrink: 1,
  },
  body: { fontSize: 15, lineHeight: 25, color: c.muted },
  small: { fontSize: 12, lineHeight: 19, color: c.muted },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: c.muted,
  },
  button: {
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: c.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: c.softBlue },
  buttonText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  badge: { fontSize: 9, fontWeight: "700", color: c.muted, letterSpacing: 1 },
  wrap: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  language: {
    minWidth: 95,
    minHeight: 64,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.background,
  },
  selected: { backgroundColor: c.softBlue, borderColor: c.blue },
  languageName: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: "600",
    color: c.text,
  },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: 15,
    fontSize: 16,
    color: c.text,
    backgroundColor: c.background,
    minHeight: 52,
  },
  message: {
    minHeight: 140,
    textAlignVertical: "top",
    fontSize: 18,
    lineHeight: 29,
    color: c.text,
    padding: 12,
    backgroundColor: c.surface,
    borderRadius: 14,
  },
  translation: { fontSize: 24, lineHeight: 38, color: c.text },
  error: { color: "#B42318", fontSize: 14, lineHeight: 22 },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    backgroundColor: c.background,
  },
});
