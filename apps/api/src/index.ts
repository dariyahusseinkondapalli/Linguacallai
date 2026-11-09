import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Accounts } from "./auth.js";
import { Sessions } from "./sessions.js";
import { createApp } from "./app.js";
import { LibreTranslateProvider } from "./provider.js";
const token = process.env.API_TOKEN ?? "";
const endpoint = process.env.LIBRETRANSLATE_URL;
const limit = Number(process.env.REQUEST_LIMIT ?? 50);
if (!Number.isSafeInteger(limit) || limit < 1)
  throw new Error("REQUEST_LIMIT must be a positive integer");
const database = process.env.DATABASE_PATH ?? "./data/linguacall.sqlite";
mkdirSync(dirname(database), { recursive: true });
const accounts = new Accounts(database);
const sessions = new Sessions();
const iceServers = process.env.ICE_SERVERS_JSON
  ? JSON.parse(process.env.ICE_SERVERS_JSON)
  : [];
const server = createServer(
  createApp({
    accounts,
    sessions,
    iceServers,
    token,
    requestLimit: limit,
    provider: endpoint
      ? new LibreTranslateProvider(endpoint, process.env.LIBRETRANSLATE_API_KEY)
      : undefined,
  }),
);
sessions.attach(server);
server.listen(
  Number(process.env.PORT ?? 3000),
  process.env.HOST ?? "127.0.0.1",
  () => console.log("LinguaCall API listening"),
);

process.on("SIGTERM", () => {
  sessions.close();
  accounts.close();
  server.close();
});
