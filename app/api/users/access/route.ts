import { NextResponse } from "next/server";
import { setUserDevices } from "@/lib/accessStore";

/** PUT { username, deviceIds: string[] } sets which devices a user may use. Admin-only (proxy.ts). */
export async function PUT(request: Request) {
  try {
    const { username, deviceIds } = await request.json();
    if (typeof username !== "string" || !username.trim() || !Array.isArray(deviceIds)) {
      return NextResponse.json({ success: false, message: "username and deviceIds are required." }, { status: 400 });
    }
    const result = await setUserDevices(username, deviceIds.filter((d): d is string => typeof d === "string"));
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch {
    return NextResponse.json({ success: false, message: "Could not save access." }, { status: 500 });
  }
}
