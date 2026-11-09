import { requireOptionalNativeModule } from "expo-modules-core";
import { PermissionsAndroid, Platform } from "react-native";
export interface AudioSnapshot {
  outputs: { id: number; name: string; type: number }[];
  selected: number | null;
  canSelect: boolean;
  noiseSuppressionAvailable: boolean;
  echoCancellationAvailable: boolean;
  effectsActive: boolean;
}
export const audio = requireOptionalNativeModule<{
  snapshot(): AudioSnapshot;
  selectOutput(id: number): boolean;
  acquireFocus(): boolean;
  beginCall(): void;
  enhanceCapture(): void;
  release(): void;
  addListener(
    event: string,
    listener: (data: AudioSnapshot) => void,
  ): { remove(): void };
}>("LinguaAudio");
export async function bluetoothPermission() {
  if (Platform.OS === "android" && Number(Platform.Version) >= 31)
    return (
      (await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      )) === "granted"
    );
  return true;
}
