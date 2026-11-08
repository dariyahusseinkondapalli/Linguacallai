import { createApp } from "./app.js";
import { LibreTranslateProvider } from "./provider.js";
const token = process.env.API_TOKEN ?? "";
const endpoint = process.env.LIBRETRANSLATE_URL;
const limit = Number(process.env.REQUEST_LIMIT ?? 50);
if (!Number.isSafeInteger(limit) || limit < 1)
  throw new Error("REQUEST_LIMIT must be a positive integer");
createApp({
  token,
  requestLimit: limit,
  provider: endpoint
    ? new LibreTranslateProvider(endpoint, process.env.LIBRETRANSLATE_API_KEY)
    : undefined,
}).listen(
  Number(process.env.PORT ?? 3000),
  process.env.HOST ?? "127.0.0.1",
  () => console.log("LinguaCall API listening"),
);
