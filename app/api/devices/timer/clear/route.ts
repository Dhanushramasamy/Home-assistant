import { NextResponse } from "next/server";
import { clearDeviceTimers, recordBrowserTimerResult } from "@/lib/deviceController";

/**
 * POST { deviceId } cancels every timer on this device's relay (each by id).
 * POST { deviceId, recordOnly: true } only records a clear the browser already did.
 */
export async function POST(request: Request) {
  try {
    const { deviceId, recordOnly } = await request.json();
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required." }, { status: 400 });
    }
    if (recordOnly) {
      await recordBrowserTimerResult(deviceId, { type: "cleared" });
      return NextResponse.json({ success: true });
    }
    const result = await clearDeviceTimers(deviceId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Clear timers failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
