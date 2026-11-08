import { z } from "zod";
import type {
  TranslationProvider,
  TranslationRequest,
  TranslationResult,
} from "@linguacall/shared";
const catalogSchema = z.array(
  z.object({ code: z.string(), targets: z.array(z.string()) }),
);
export class ProviderError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class LibreTranslateProvider implements TranslationProvider {
  readonly name = "LibreTranslate";
  constructor(
    private endpoint: string,
    private apiKey?: string,
  ) {
    const url = new URL(endpoint);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
    )
      throw new Error("Provider requires HTTPS outside loopback");
  }
  private async request(
    path: string,
    signal: AbortSignal,
    body?: unknown,
  ): Promise<unknown> {
    const response = await fetch(
      `${this.endpoint.replace(/\/$/, "")}/${path}`,
      {
        signal,
        method: body ? "POST" : "GET",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    if (!response.ok)
      throw new ProviderError(
        502,
        "Translation provider is unavailable. Try again later.",
      );
    return response.json();
  }
  async languages(signal: AbortSignal) {
    return catalogSchema.parse(await this.request("languages", signal));
  }
  async translate(
    input: TranslationRequest,
    signal: AbortSignal,
  ): Promise<TranslationResult> {
    const started = performance.now();
    let source: string = input.source;
    let confidence: number | undefined;
    if (source === "auto") {
      const detected = z
        .array(
          z.object({
            language: z.string(),
            confidence: z.number().min(0).max(100),
          }),
        )
        .min(1)
        .parse(
          await this.request("detect", signal, {
            q: input.text,
            api_key: this.apiKey,
          }),
        );
      const best = detected.sort((a, b) => b.confidence - a.confidence)[0];
      if (best.confidence < 50)
        throw new ProviderError(
          422,
          "Language is unclear. Select the spoken language manually.",
        );
      source = best.language;
      confidence = best.confidence / 100;
    }
    const catalog = await this.languages(signal);
    if (
      !catalog.some(
        (l) =>
          l.code === source &&
          (source === input.target || l.targets.includes(input.target)),
      )
    )
      throw new ProviderError(
        422,
        "This language pair is unavailable on the configured provider.",
      );
    if (source === input.target)
      return {
        text: input.text,
        source,
        confidence,
        provider: this.name,
        elapsedMs: performance.now() - started,
      };
    const result = z
      .object({ translatedText: z.string().min(1) })
      .parse(
        await this.request("translate", signal, {
          q: input.text,
          source,
          target: input.target,
          format: "text",
          api_key: this.apiKey,
        }),
      );
    return {
      text: result.translatedText,
      source,
      confidence,
      provider: this.name,
      elapsedMs: Math.round(performance.now() - started),
    };
  }
}
