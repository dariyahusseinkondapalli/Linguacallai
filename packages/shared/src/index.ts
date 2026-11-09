import { z } from "zod";
export const languages = [
  { code: "te", name: "Telugu", native: "తెలుగు", locale: "te-IN" },
  { code: "hi", name: "Hindi", native: "हिन्दी", locale: "hi-IN" },
  { code: "en", name: "English", native: "English", locale: "en-IN" },
  { code: "mr", name: "Marathi", native: "मराठी", locale: "mr-IN" },
] as const;
export const languageSchema = z.enum(["te", "hi", "en", "mr"]);
export type Language = z.infer<typeof languageSchema>;
export const translationSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  source: z.union([languageSchema, z.literal("auto")]),
  target: languageSchema,
});
export type TranslationRequest = z.infer<typeof translationSchema>;
export interface TranslationResult {
  text: string;
  source: string;
  confidence?: number;
  provider: string;
  elapsedMs: number;
}
export interface Capability {
  code: string;
  targets: string[];
}
export interface TranslationProvider {
  readonly name: string;
  languages(signal: AbortSignal): Promise<Capability[]>;
  translate(
    input: TranslationRequest,
    signal: AbortSignal,
  ): Promise<TranslationResult>;
}
export interface HistoryEntry {
  id: string;
  original: string;
  result: string;
  source: string;
  target: Language;
  createdAt: string;
}
export function saveEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry,
  consent: boolean,
): HistoryEntry[] {
  return consent ? [entry, ...entries].slice(0, 100) : [];
}
