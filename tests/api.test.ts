import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../apps/api/src/app";
import { LibreTranslateProvider } from "../apps/api/src/provider";
import {
  saveEntry,
  translationSchema,
  type TranslationProvider,
} from "../packages/shared/src";
const token = "test-only-token-with-at-least-32-characters";
const fixture: TranslationProvider = {
  name: "TEST FIXTURE ONLY",
  languages: async () => [{ code: "en", targets: ["hi"] }],
  translate: async (input) => ({
    text: "fixture",
    source: input.source,
    provider: "TEST FIXTURE ONLY",
    elapsedMs: 1,
  }),
};
describe("API authorization and lifecycle", () => {
  it("allows health checks and protects translation", async () => {
    const app = createApp({ token });
    expect((await request(app).get("/health")).status).toBe(200);
    expect(
      (
        await request(app)
          .post("/v1/translate")
          .send({ text: "hi", source: "en", target: "hi" })
      ).status,
    ).toBe(401);
  });
  it("rejects weak server credentials", () =>
    expect(() => createApp({ token: "weak" })).toThrow());
  it("never substitutes mock translation when unconfigured", async () => {
    expect(
      (
        await request(createApp({ token }))
          .post("/v1/translate")
          .auth(token, { type: "bearer" })
          .send({ text: "hello", source: "en", target: "te" })
      ).status,
    ).toBe(503);
  });
  it("validates input and reserves the request allowance", async () => {
    const app = createApp({ token, provider: fixture, requestLimit: 1 });
    const post = (text: string) =>
      request(app)
        .post("/v1/translate")
        .auth(token, { type: "bearer" })
        .send({ text, source: "en", target: "hi" });
    expect((await post(" ")).status).toBe(400);
    expect((await post("hello")).status).toBe(200);
    expect((await post("again")).status).toBe(429);
  });
  it("hides upstream errors and secrets", async () => {
    const app = createApp({
      token,
      provider: {
        ...fixture,
        translate: async () => {
          throw new Error("secret credential");
        },
      },
    });
    const result = await request(app)
      .post("/v1/translate")
      .auth(token, { type: "bearer" })
      .send({ text: "hello", source: "en", target: "hi" });
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.body)).not.toContain("secret");
  });
});
describe("provider contract", () => {
  it("rejects remote plaintext transport", () =>
    expect(() => new LibreTranslateProvider("http://example.com")).toThrow());
  it("translates only advertised pairs using provider responses", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ code: "en", targets: ["hi"] }])),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ translatedText: "नमस्ते" })),
      );
    try {
      const result = await new LibreTranslateProvider(
        "https://example.com",
      ).translate(
        { text: "Hello", source: "en", target: "hi" },
        new AbortController().signal,
      );
      expect(result.text).toBe("नमस्ते");
      expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {
      fetcher.mockRestore();
    }
  });
  it("rejects unsupported language pairs before translation", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ code: "en", targets: ["hi"] }])),
      );
    try {
      await expect(
        new LibreTranslateProvider("https://example.com").translate(
          { text: "Hello", source: "en", target: "te" },
          new AbortController().signal,
        ),
      ).rejects.toThrow("unavailable");
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally {
      fetcher.mockRestore();
    }
  });
  it("requires manual selection when detection is uncertain", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ language: "en", confidence: 20 }])),
      );
    try {
      await expect(
        new LibreTranslateProvider("https://example.com").translate(
          { text: "x", source: "auto", target: "hi" },
          new AbortController().signal,
        ),
      ).rejects.toThrow("manually");
    } finally {
      fetcher.mockRestore();
    }
  });
});
it("enforces privacy defaults and bounds history", () => {
  const entry = {
    id: "1",
    original: "x",
    result: "y",
    source: "en",
    target: "te" as const,
    createdAt: "2026-11-08",
  };
  expect(saveEntry([entry], entry, false)).toEqual([]);
  expect(saveEntry(Array(100).fill(entry), entry, true)).toHaveLength(100);
  expect(
    translationSchema.safeParse({
      text: "x".repeat(2001),
      source: "en",
      target: "te",
    }).success,
  ).toBe(false);
});
