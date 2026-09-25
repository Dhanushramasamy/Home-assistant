import { NextResponse } from "next/server";
import { cancelDeviceTimer, recordBrowserTimerResult } from "@/lib/deviceController";

/**
 * POST { deviceId, timerId } cancels one timer by its ESP32 id (GET /timer/cancel?id=).
 * POST { ..., recordOnly: true } only records a cancel the browser already did.
 */
export async function POST(request: Request) {
  try {
    const { deviceId, timerId, recordOnly } = await request.json();
    if (!deviceId || !Number.isInteger(timerId)) {
      return NextResponse.json({ error: "deviceId and an integer timerId are required." }, { status: 400 });
    }
    if (recordOnly) {
      await recordBrowserTimerResult(deviceId, { type: "cancelled", espId: timerId });
      return NextResponse.json({ success: true });
    }
    const result = await cancelDeviceTimer(deviceId, timerId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Timer cancel failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
