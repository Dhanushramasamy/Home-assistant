import { createHmac, timingSafeEqual } from "crypto";

// Server-only. A session is a signed, httpOnly cookie: base64url(payload).signature
// The browser can't read or forge it, so the role in it can be trusted.

export const SESSION_COOKIE = "hc_session";
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days

export interface Session {
  username: string;
  role: "admin" | "user";
  exp: number; // unix seconds
}

function secret(): string | null {
  const s = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return s && s.length >= 16 ? s : null;
}

export function sessionConfigured(): boolean {
  return secret() !== null;
}

function sign(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

export function createSessionToken(username: string, role: "admin" | "user"): string {
  const key = secret();
  if (!key) throw new Error("SESSION_SECRET is not set on the server.");
  const payload: Session = { username, role, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, key)}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  const key = secret();
  if (!key || !token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data, key));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as Session;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    if (payload.role !== "admin" && payload.role !== "user") return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};
