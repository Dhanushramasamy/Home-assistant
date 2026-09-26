import { NextResponse, type NextRequest } from "next/server";
import { applyDeviceReport, getDeviceStatus } from "@/lib/deviceController";
import { parseTimers } from "@/lib/timerParse";
import { denyDeviceAccess } from "@/lib/auth/requestSession";

/** GET ?deviceId= reads /status from the ESP32 and syncs the app to it. */
export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required." }, { status: 400 });
  }
  const denied = await denyDeviceAccess(request, deviceId);
  if (denied) return denied;
  try {
    const result = await getDeviceStatus(deviceId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Status request failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST { deviceId, report } — the browser read /status from the ESP32 directly
 * (server couldn't reach it) and reports it so the DB is synced the same way.
 */
export async function POST(request: Request) {
  try {
    const { deviceId, report } = await request.json();
    const denied = await denyDeviceAccess(request, deviceId);
    if (denied) return denied;
    if (!deviceId || !report || typeof report !== "object") {
      return NextResponse.json({ error: "deviceId and report are required." }, { status: 400 });
    }
    const result = await applyDeviceReport(deviceId, {
      timers: parseTimers(report) ?? [],
      raw: report,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Status sync failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
