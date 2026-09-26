import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

// Server-only. Passwords are stored as "scrypt$<N>$<salt>$<hash>" (base64).
const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: { N: number }) => Promise<Buffer>;
const N = 16384;
const KEY_LEN = 64;

export function isPasswordHash(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("scrypt$");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LEN, { N });
  return `scrypt$${N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, nStr, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !nStr || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(nStr) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
