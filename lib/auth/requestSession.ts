import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, type Session } from "./session";
import { canUseDevice } from "../accessStore";

// Server-only helpers for route handlers. proxy.ts already rejects requests
// without a session; these read who the user is and check device access.

export function sessionFrom(request: Request): Session | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return verifySessionToken(match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : undefined);
}

/** Returns a 401/403 response if the signed-in user may not use this device, else null. */
export async function denyDeviceAccess(request: Request, deviceId: unknown): Promise<NextResponse | null> {
  const session = sessionFrom(request);
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (typeof deviceId !== "string" || !deviceId) return null; // route validates the id itself
  if (await canUseDevice(session.username, session.role, deviceId)) return null;
  return NextResponse.json({ error: "You don't have access to this device." }, { status: 403 });
}
