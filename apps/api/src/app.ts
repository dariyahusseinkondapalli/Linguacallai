import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { timingSafeEqual } from "node:crypto";
import {
  translationSchema,
  type TranslationProvider,
} from "@linguacall/shared";
import { z } from "zod";
import { languageSchema } from "@linguacall/shared";
import type { Accounts } from "./auth.js";
import type { Sessions } from "./sessions.js";
import { ProviderError } from "./provider.js";
export function createApp(options: {
  token: string;
  provider?: TranslationProvider;
  requestLimit?: number;
  accounts?: Accounts;
  sessions?: Sessions;
  iceServers?: {
    urls: string | string[];
    username?: string;
    credential?: string;
  }[];
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
  const credentials = z.object({
    name: z
      .string()
      .min(3)
      .max(64)
      .regex(/^[a-zA-Z0-9_.-]+$/),
    password: z.string().min(12).max(128),
  });
  const authLimit = rateLimit({ windowMs: 15 * 60_000, limit: 10 });
  app.post("/v1/auth/login", authLimit, async (req, res) => {
    const input = credentials.safeParse(req.body);
    if (!input.success || !options.accounts) {
      res
        .status(400)
        .json({ error: "Account service unavailable or invalid credentials." });
      return;
    }
    const result = await options.accounts.login(
      input.data.name,
      input.data.password,
    );
    res
      .status(result ? 200 : 401)
      .json(result ?? { error: "Invalid account name or password." });
  });
  app.post("/v1/auth/register", authLimit, async (req, res) => {
    const input = credentials.safeParse(req.body);
    const enrollment = Buffer.from(
      req.headers["x-enrollment-token"]?.toString() ?? "",
    );
    const expected = Buffer.from(options.token);
    if (
      !input.success ||
      !options.accounts ||
      enrollment.length !== expected.length ||
      !timingSafeEqual(enrollment, expected)
    ) {
      res
        .status(403)
        .json({
          error:
            "Valid beta enrollment token and credentials required (password: 12+ characters).",
        });
      return;
    }
    try {
      res
        .status(201)
        .json(
          await options.accounts.register(input.data.name, input.data.password),
        );
    } catch {
      res
        .status(409)
        .json({
          error: "Account could not be created. Try another account name.",
        });
    }
  });
  app.use((req, res, next) => {
    const supplied = Buffer.from(
      req.headers.authorization?.replace(/^Bearer /, "") ?? "",
    );
    const user = options.accounts?.verify(supplied.toString());
    if (user) {
      res.locals.user = user;
      next();
      return;
    }
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
  app.delete("/v1/account", (req, res) => {
    if (!res.locals.user) {
      res.status(403).json({ error: "Sign in to an account first." });
      return;
    }
    options.sessions?.endUser(res.locals.user);
    options.accounts?.delete(res.locals.user);
    res.json({ deleted: true });
  });
  app.post("/v1/auth/logout", (req, res) => {
    if (res.locals.user) options.sessions?.endUser(res.locals.user);
    options.accounts?.revoke(
      req.headers.authorization?.replace(/^Bearer /, "") ?? "",
    );
    res.json({ signedOut: true });
  });
  app.get("/v1/ice", (_req, res) => {
    if (!res.locals.user) {
      res.status(403).json({ error: "Account sign-in required." });
      return;
    }
    res.json({ iceServers: options.iceServers ?? [] });
  });
  app.post("/v1/sessions", (req, res) => {
    if (!res.locals.user || !options.sessions) {
      res
        .status(403)
        .json({ error: "Sign in to an account to start a session." });
      return;
    }
    const input = z
      .object({ language: languageSchema, mode: z.enum(["paired", "call"]) })
      .safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: "Invalid session options." });
      return;
    }
    try {
      res
        .status(201)
        .json(
          options.sessions.create(
            res.locals.user,
            input.data.language,
            input.data.mode,
          ),
        );
    } catch (e) {
      res
        .status(409)
        .json({ error: e instanceof Error ? e.message : "Session failed" });
    }
  });
  app.post("/v1/sessions/join", authLimit, (req, res) => {
    if (!res.locals.user || !options.sessions) {
      res.status(403).json({ error: "Sign in to an account to join." });
      return;
    }
    const input = z
      .object({ code: z.string().min(12).max(12), language: languageSchema })
      .safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: "Invalid invite code." });
      return;
    }
    try {
      res.json(
        options.sessions.join(
          input.data.code,
          res.locals.user,
          input.data.language,
        ),
      );
    } catch (e) {
      res
        .status(409)
        .json({ error: e instanceof Error ? e.message : "Join failed" });
    }
  });
  let used = 0;
  app.get("/v1/capabilities", async (_req, res, next) => {
    try {
      res.json({
        provider: options.provider?.name ?? null,
        languages: options.provider
          ? await options.provider.languages(AbortSignal.timeout(10_000))
          : [],
        voice: "device",
        calls: !!options.sessions,
      });
    } catch (error) {
      next(error);
    }
  });
  app.post("/v1/translate", async (req, res, next) => {
    const input = translationSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({
        error: "Enter 1–2000 characters and a supported language code.",
      });
      return;
    }
    if (!options.provider) {
      res.status(503).json({ error: "No translation provider configured." });
      return;
    }
    if (used >= (options.requestLimit ?? 50)) {
      res.status(429).json({
        error: "Development request allowance exhausted. Contact the operator.",
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
      res.status(status).json({
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
