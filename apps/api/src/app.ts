import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { timingSafeEqual } from "node:crypto";
import {
  translationSchema,
  type TranslationProvider,
} from "@linguacall/shared";
import { ProviderError } from "./provider.js";
export function createApp(options: {
  token: string;
  provider?: TranslationProvider;
  requestLimit?: number;
}) {
  if (options.token.length < 32)
    throw new Error("API_TOKEN must contain at least 32 characters");
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "16kb" }));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 30,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use((req, res, next) => {
    const supplied = Buffer.from(
      req.headers.authorization?.replace(/^Bearer /, "") ?? "",
    );
    const expected = Buffer.from(options.token);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    next();
  });
  let used = 0;
  app.get("/v1/capabilities", async (_req, res, next) => {
    try {
      res.json({
        provider: options.provider?.name ?? null,
        languages: options.provider
          ? await options.provider.languages(AbortSignal.timeout(10_000))
          : [],
        voice: false,
        calls: false,
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/v1/translate", async (req, res, next) => {
    const input = translationSchema.safeParse(req.body);
    if (!input.success) {
      res
        .status(400)
        .json({
          error: "Enter 1–2000 characters and a supported language code.",
        });
      return;
    }
    if (!options.provider) {
      res.status(503).json({ error: "No translation provider configured." });
      return;
    }
    if (used >= (options.requestLimit ?? 50)) {
      res
        .status(429)
        .json({
          error:
            "Development request allowance exhausted. Contact the operator.",
        });
      return;
    }
    used++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const cancel = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on("close", cancel);
    try {
      res.json(await options.provider.translate(input.data, controller.signal));
    } catch (error) {
      next(error);
    } finally {
      clearTimeout(timer);
      res.off("close", cancel);
    }
  });
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      void _next;
      const status =
        error instanceof ProviderError
          ? error.status
          : error instanceof SyntaxError
            ? 400
            : 502;
      res
        .status(status)
        .json({
          error:
            error instanceof ProviderError
              ? error.message
              : status === 400
                ? "Invalid JSON"
                : "Provider request failed or timed out. Please try again.",
        });
    },
  );
  return app;
}
