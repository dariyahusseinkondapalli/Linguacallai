import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  scrypt as derive,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(derive);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export class Accounts {
  private db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(
      `PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL); CREATE TABLE IF NOT EXISTS tokens(hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);`,
    );
  }
  async register(name: string, password: string) {
    const salt = randomBytes(16).toString("hex");
    const key = (await scrypt(password, salt, 64)) as Buffer;
    const id = randomBytes(16).toString("hex");
    this.db
      .prepare("INSERT INTO users VALUES(?,?,?,?)")
      .run(id, name.toLowerCase(), salt, key.toString("hex"));
    return this.issue(id);
  }
  async login(name: string, password: string) {
    const user = this.db
      .prepare("SELECT * FROM users WHERE name=?")
      .get(name.toLowerCase()) as
      { id: string; salt: string; password: string } | undefined;
    const candidate = (await scrypt(
      password,
      user?.salt ?? "unknown-user-timing-padding",
      64,
    )) as Buffer;
    if (!user || !timingSafeEqual(candidate, Buffer.from(user.password, "hex")))
      return null;
    return this.issue(user.id);
  }
  private issue(id: string) {
    const token = randomBytes(32).toString("base64url");
    this.db.prepare("DELETE FROM tokens WHERE expires < ?").run(Date.now());
    this.db
      .prepare("INSERT INTO tokens VALUES(?,?,?)")
      .run(hash(token), id, Date.now() + 7 * 86400_000);
    return { token, userId: id, expiresIn: 604800 };
  }
  verify(token: string): string | null {
    const row = this.db
      .prepare("SELECT user_id FROM tokens WHERE hash=? AND expires>?")
      .get(hash(token), Date.now()) as { user_id: string } | undefined;
    return row?.user_id ?? null;
  }
  revoke(token: string) {
    this.db.prepare("DELETE FROM tokens WHERE hash=?").run(hash(token));
  }
  delete(id: string) {
    this.db.prepare("DELETE FROM users WHERE id=?").run(id);
  }
  close() {
    this.db.close();
  }
}
