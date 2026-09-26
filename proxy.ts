import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Guards every API route with the signed session cookie.
 * - /api/auth/login, /logout, /me are open (they handle sign-in themselves).
 * - Everything else needs a signed-in user.
 * - Changing devices, network settings, resets and users needs an admin.
 */
const OPEN = ["/api/auth/login", "/api/auth/logout", "/api/auth/me"];

function needsAdmin(pathname: string, method: string): boolean {
  if (pathname === "/api/users" || pathname.startsWith("/api/users/")) return true;
  if (pathname === "/api/devices/reset" || pathname === "/api/devices/clear") return true;
  if (pathname === "/api/network" && method !== "GET") return true;
  if (pathname === "/api/devices" && method === "POST") return true; // add device
  if (/^\/api\/devices\/[^/]+$/.test(pathname) && ["PUT", "PATCH", "DELETE"].includes(method)) {
    return !["/api/devices/control", "/api/devices/test", "/api/devices/status", "/api/devices/timer"].includes(pathname);
  }
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (OPEN.includes(pathname) || request.method === "OPTIONS") return NextResponse.next();

  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (needsAdmin(pathname, request.method) && session.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
