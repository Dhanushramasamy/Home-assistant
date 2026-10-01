import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// Server-only. Encrypts the board secrets kept in the database (Wi-Fi
// passwords, each board's sign-in password) with AES-256-GCM. The key comes
// from BOARD_SECRET_KEY, or SESSION_SECRET if that isn't set. Changing it
// makes saved secrets unreadable: re-enter the Wi-Fi passwords and download
// the board's code again.

function key(): Buffer {
  const base = process.env.BOARD_SECRET_KEY || process.env.SESSION_SECRET;
  if (!base) throw new Error("SESSION_SECRET (or BOARD_SECRET_KEY) is not set on the server.");
  return createHash("sha256").update(`home-control board secrets v1:${base}`).digest();
}

/** "v1:" + base64(iv | tag | ciphertext) */
export function seal(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64")}`;
}

/** The plain text, or null if it can't be opened (wrong key or damaged). */
export function open(sealed: string | null | undefined): string | null {
  if (!sealed || !sealed.startsWith("v1:")) return null;
  try {
    const raw = Buffer.from(sealed.slice(3), "base64");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
