import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import request from "supertest";
import { WebSocket } from "ws";
import { Accounts } from "../apps/api/src/auth";
import { Sessions } from "../apps/api/src/sessions";
import { createApp } from "../apps/api/src/app";
const operator = "test-enrollment-only-32-characters-long";
const stores: Accounts[] = [];
const sessions: Sessions[] = [];
const servers: Server[] = [];
const sockets: WebSocket[] = [];
afterEach(() => {
  sockets.splice(0).forEach((s) => s.terminate());
  sessions.splice(0).forEach((s) => s.close());
  servers.splice(0).forEach((s) => s.close());
  stores.splice(0).forEach((s) => s.close());
});
function setup() {
  const accounts = new Accounts(":memory:");
  stores.push(accounts);
  const service = new Sessions();
  sessions.push(service);
  return {
    accounts,
    service,
    app: createApp({ token: operator, accounts, sessions: service }),
  };
}
function inbox(socket: WebSocket) {
  const messages: Record<string, unknown>[] = [];
  socket.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
  return async (type: string) => {
    for (let n = 0; n < 100; n++) {
      const index = messages.findIndex((m) => m.type === type);
      if (index >= 0) return messages.splice(index, 1)[0];
      await new Promise((r) => setTimeout(r, 10));
    }
    throw Error("No " + type);
  };
}
describe("beta account lifecycle", () => {
  it("gates registration and revokes deleted accounts", async () => {
    const { app, accounts } = setup();
    const body = { name: "alice", password: "a-long-test-password" };
    expect(
      (await request(app).post("/v1/auth/register").send(body)).status,
    ).toBe(403);
    const signup = await request(app)
      .post("/v1/auth/register")
      .set("X-Enrollment-Token", operator)
      .send(body);
    expect(signup.status).toBe(201);
    const token = signup.body.token;
    expect(accounts.verify(token)).toBeTruthy();
    expect(
      (
        await request(app)
          .post("/v1/auth/login")
          .send({ ...body, password: "incorrect-password" })
      ).status,
    ).toBe(401);
    const login = await request(app).post("/v1/auth/login").send(body);
    expect(login.status).toBe(200);
    expect(
      (await request(app).delete("/v1/account").auth(token, { type: "bearer" }))
        .status,
    ).toBe(200);
    expect(accounts.verify(login.body.token)).toBeNull();
  });
  it("requires a user identity for sessions and validates preferences", async () => {
    const { app, accounts } = setup();
    expect(
      (
        await request(app)
          .post("/v1/sessions")
          .auth(operator, { type: "bearer" })
          .send({ language: "te", mode: "paired" })
      ).status,
    ).toBe(403);
    const { token } = await accounts.register("alice", "a-long-test-password");
    expect(
      (
        await request(app)
          .post("/v1/sessions")
          .auth(token, { type: "bearer" })
          .send({ language: "invalid", mode: "call" })
      ).status,
    ).toBe(400);
  });
});
describe("session authorization and signaling", () => {
  it("enforces two distinct participants and expires membership on end", () => {
    const { service } = setup();
    const a = service.create("alice", "te", "paired");
    expect(() => service.join(a.code, "alice", "hi")).toThrow("different");
    const b = service.join(a.code, "bob", "mr");
    expect(b.initiator).toBe(false);
    expect(() => service.join(a.code, "charlie", "en")).toThrow();
    service.end(a.sessionId);
    expect(() => service.join(a.code, "charlie", "en")).toThrow();
  });
  it("relays captions only to the authenticated peer and closes both on ending", async () => {
    const { app, service } = setup();
    const server = createServer(app);
    servers.push(server);
    service.attach(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const port = (server.address() as { port: number }).port;
    const a = service.create("alice", "te", "call");
    const b = service.join(a.code, "bob", "mr");
    const connect = async (member: typeof a) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/v1/signal`);
      sockets.push(socket);
      const next = inbox(socket);
      await new Promise<void>((resolve) => socket.on("open", resolve));
      socket.send(
        JSON.stringify({
          type: "auth",
          sessionId: member.sessionId,
          memberToken: member.memberToken,
        }),
      );
      await next("ready");
      return { socket, next };
    };
    const clientA = await connect(a);
    const clientB = await connect(b);
    await clientA.next("peer-ready");
    clientA.socket.send(
      JSON.stringify({ type: "caption", text: "Hello", language: "en" }),
    );
    expect((await clientB.next("caption")).text).toBe("Hello");
    clientA.socket.terminate();
    await clientB.next("peer-away");
    const reconnected = await connect(a);
    await clientB.next("peer-ready");
    reconnected.socket.send(JSON.stringify({type:"caption",text:"Reconnected",language:"en"}));
    expect((await clientB.next("caption")).text).toBe("Reconnected");
    reconnected.socket.send(JSON.stringify({ type: "end" }));
    await clientB.next("ended");
    expect(() => service.join(a.code, "third", "hi")).toThrow();
  });
  it("rejects a forged membership token", async () => {
    const { app, service } = setup();
    const server = createServer(app);
    servers.push(server);
    service.attach(server);
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const a = service.create("alice", "te", "paired");
    const port = (server.address() as { port: number }).port;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/v1/signal`);
    sockets.push(socket);
    await new Promise<void>((resolve) => socket.on("open", resolve));
    const close = new Promise<number>((resolve) => socket.on("close", resolve));
    socket.send(
      JSON.stringify({
        type: "auth",
        sessionId: a.sessionId,
        memberToken: "forged",
      }),
    );
    expect(await close).toBe(1008);
  });
});
