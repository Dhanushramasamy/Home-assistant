import { NextResponse } from "next/server";
import { loginUser } from "@/lib/userStore";
import { SESSION_COOKIE, createSessionToken, sessionCookieOptions, sessionConfigured } from "@/lib/auth/session";

/** POST { username, password } -> sets the signed session cookie. */
export async function POST(request: Request) {
  if (!sessionConfigured()) {
    return NextResponse.json(
      { success: false, message: "Sign-in isn't configured on the server (SESSION_SECRET missing)." },
      { status: 500 }
    );
  }
  try {
    const { username, password } = await request.json();
    const result = await loginUser(String(username ?? ""), String(password ?? ""));
    if (!result.success) {
      return NextResponse.json({ success: false, message: result.message }, { status: 401 });
    }
    const res = NextResponse.json({ success: true, username: result.username, role: result.role });
    res.cookies.set(SESSION_COOKIE, createSessionToken(result.username, result.role), sessionCookieOptions);
    return res;
  } catch {
    return NextResponse.json({ success: false, message: "Sign-in failed. Please try again." }, { status: 500 });
  }
}
