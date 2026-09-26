import { NextResponse } from "next/server";
import { createUserAccount } from "@/lib/userStore";

/** POST { username, password, role } creates a user. Admin-only (enforced in proxy.ts). */
export async function POST(request: Request) {
  try {
    const { username, password, role } = await request.json();
    const result = await createUserAccount(String(username ?? ""), String(password ?? ""), role === "admin" ? "admin" : "user");
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch {
    return NextResponse.json({ success: false, message: "Could not create the user." }, { status: 500 });
  }
}
