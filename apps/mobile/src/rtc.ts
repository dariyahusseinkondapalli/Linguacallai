export interface CallEngine {
  offer(): Promise<void>;
  receive(signal: unknown): Promise<void>;
  mute(value: boolean): void;
  suspend(): Promise<void>;
  resume(): Promise<void>;
  close(): void;
}
export async function createCallEngine(
  _ice: unknown[],
  _send: (signal: unknown) => void,
  _state: (state: string) => void,
): Promise<CallEngine> {
  void _ice;
  void _send;
  void _state;
  throw new Error("Native voice calls require the Android app.");
}
