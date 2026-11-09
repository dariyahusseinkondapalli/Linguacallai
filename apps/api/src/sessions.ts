import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { languageSchema, type Language } from "@linguacall/shared";
const incoming = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("signal"),
    signal: z.union([
      z.object({
        type: z.enum(["offer", "answer"]),
        sdp: z.string().max(16000),
      }),
      z.object({
        candidate: z.string().max(4000),
        sdpMid: z.string().nullable(),
        sdpMLineIndex: z.number().int().nullable(),
      }),
    ]),
  }),
  z.object({
    type: z.literal("caption"),
    text: z.string().trim().min(1).max(2000),
    language: languageSchema,
  }),
  z.object({ type: z.literal("language"), language: languageSchema }),
  z.object({ type: z.literal("end") }),
]);
type Member = {
  id: string;
  user: string;
  token: string;
  language: Language;
  socket?: WebSocket;
  disconnect?: ReturnType<typeof setTimeout>;
};
type Session = {
  id: string;
  code: string;
  mode: "paired" | "call";
  members: Member[];
  expires: number;
};
const same = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const send = (socket: WebSocket | undefined, data: unknown) => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(data));
};
export class Sessions {
  private sessions = new Map<string, Session>();
  private sweeper = setInterval(() => {
    for (const s of this.sessions.values())
      if (s.expires < Date.now()) this.end(s.id);
  }, 30_000);
  constructor() {
    this.sweeper.unref();
  }
  create(user: string, language: Language, mode: "paired" | "call") {
    if (
      [...this.sessions.values()].some((s) =>
        s.members.some((m) => m.user === user),
      )
    )
      throw new Error("End your existing session first.");
    if (this.sessions.size >= 100) throw new Error("Session capacity reached.");
    const s: Session = {
      id: randomBytes(16).toString("hex"),
      code: randomBytes(9).toString("base64url"),
      mode,
      members: [],
      expires: Date.now() + 3600_000,
    };
    this.sessions.set(s.id, s);
    return this.add(s, user, language);
  }
  join(code: string, user: string, language: Language) {
    const s = [...this.sessions.values()].find(
      (s) => same(s.code, code) && s.expires > Date.now(),
    );
    if (!s || s.members.length >= 2)
      throw new Error("Invite expired, invalid or already used.");
    if (s.members.some((m) => m.user === user))
      throw new Error("Use a different account on the second phone.");
    if (
      [...this.sessions.values()].some((s) =>
        s.members.some((m) => m.user === user),
      )
    )
      throw new Error("End your existing session first.");
    return this.add(s, user, language);
  }
  private add(s: Session, user: string, language: Language) {
    const m: Member = {
      id: randomBytes(12).toString("hex"),
      user,
      language,
      token: randomBytes(32).toString("base64url"),
    };
    s.members.push(m);
    return {
      sessionId: s.id,
      memberId: m.id,
      memberToken: m.token,
      code: s.code,
      mode: s.mode,
      expires: s.expires,
      initiator: s.members.length === 1,
    };
  }
  end(id: string) {
    const s = this.sessions.get(id);
    if (!s) return;
    this.sessions.delete(id);
    for (const m of s.members) {
      clearTimeout(m.disconnect);
      send(m.socket, { type: "ended" });
      m.socket?.close(1000, "Session ended");
    }
  }
  endUser(user: string) {
    for (const s of this.sessions.values())
      if (s.members.some((m) => m.user === user)) this.end(s.id);
  }
  close() {
    clearInterval(this.sweeper);
    for (const id of this.sessions.keys()) this.end(id);
  }
  attach(server: Server) {
    const wss = new WebSocketServer({
      server,
      path: "/v1/signal",
      maxPayload: 20000,
    });
    wss.on("connection", (socket) => {
      let member: Member | undefined;
      let session: Session | undefined;
      let window = Date.now();
      let count = 0;
      let alive = true;
      const authTimeout = setTimeout(
        () => socket.close(1008, "Authentication required"),
        5000,
      );
      const heartbeat = setInterval(() => {
        if (!alive) {
          socket.terminate();
          return;
        }
        alive = false;
        socket.ping();
      }, 15000);
      socket.on("pong", () => {
        alive = true;
      });
      socket.on("message", (raw) => {
        try {
          if (Date.now() - window > 1000) {
            window = Date.now();
            count = 0;
          }
          if (++count > 30) {
            socket.close(1008, "Rate limit");
            return;
          }
          const data = JSON.parse(raw.toString());
          if (!member) {
            const auth = z
              .object({
                type: z.literal("auth"),
                sessionId: z.string(),
                memberToken: z.string().max(100),
              })
              .parse(data);
            session = this.sessions.get(auth.sessionId);
            member = session?.members.find((m) =>
              same(m.token, auth.memberToken),
            );
            if (!session || !member || session.expires < Date.now()) {
              socket.close(1008, "Invalid membership");
              return;
            }
            clearTimeout(authTimeout);
            clearTimeout(member.disconnect);
            member.socket?.close(1000, "Replaced");
            member.socket = socket;
            send(socket, { type: "ready", memberId: member.id });
            const peer = session.members.find((m) => m !== member);
            if (peer?.socket?.readyState === WebSocket.OPEN) {
              send(socket, { type: "peer-ready", language: peer.language });
              send(peer.socket, {
                type: "peer-ready",
                language: member.language,
              });
            }
            return;
          }
          if (!session || !this.sessions.has(session.id)) return;
          const message = incoming.parse(data);
          if (message.type === "end") {
            this.end(session.id);
            return;
          }
          if (message.type === "language") member.language = message.language;
          const peer = session.members.find((m) => m !== member);
          send(peer?.socket, { ...message, speaker: member.id });
        } catch {
          send(socket, { type: "error", message: "Invalid signaling message" });
        }
      });
      socket.on("error", () => {});
      socket.on("close", () => {
        clearTimeout(authTimeout);
        clearInterval(heartbeat);
        if (member?.socket === socket && session) {
          member.socket = undefined;
          send(session.members.find((m) => m !== member)?.socket, {
            type: "peer-away",
          });
          const id = session.id;
          member.disconnect = setTimeout(() => this.end(id), 30000);
        }
      });
    });
    return wss;
  }
}
