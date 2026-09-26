import { NextResponse, type NextRequest } from "next/server";
import { changePassword } from "@/lib/userStore";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/** POST { currentPassword, newPassword } changes the signed-in user's own password. */
export async function POST(request: NextRequest) {
  const session = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, message: "Please sign in again." }, { status: 401 });
  try {
    const { currentPassword, newPassword } = await request.json();
    const result = await changePassword(session.username, String(currentPassword ?? ""), String(newPassword ?? ""));
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, message: "Could not change the password." }, { status: 500 });
  }
}
