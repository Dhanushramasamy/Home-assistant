import { NextResponse } from "next/server";
import { recordBrowserTimerResult, startDeviceTimer } from "@/lib/deviceController";
import { MAX_TIMER_SECONDS } from "@/types";
import { denyDeviceAccess } from "@/lib/auth/requestSession";

/**
 * POST { deviceId, action: "on"|"off", seconds: 1-86400, repeat? }
 *   Creates a timer on the ESP32 (GET /timer) and records it.
 * POST { ..., recordOnly: true, espTimerId }
 *   The browser already created it on the ESP32 directly; only record it.
 */
export async function POST(request: Request) {
  try {
    const { deviceId, action, seconds, repeat, recordOnly, espTimerId } = await request.json();
    const denied = await denyDeviceAccess(request, deviceId);
    if (denied) return denied;

    if (!deviceId || (action !== "on" && action !== "off")) {
      return NextResponse.json({ error: "deviceId and action ('on' or 'off') are required." }, { status: 400 });
    }
    const secs = Number(seconds);
    if (!Number.isInteger(secs) || secs < 1 || secs > MAX_TIMER_SECONDS) {
      return NextResponse.json({ error: `seconds must be a whole number from 1 to ${MAX_TIMER_SECONDS}.` }, { status: 400 });
    }

    if (recordOnly) {
      await recordBrowserTimerResult(deviceId, {
        type: "created",
        espId: Number.isInteger(espTimerId) ? espTimerId : undefined,
        action,
        seconds: secs,
        repeat: repeat === true,
      });
      return NextResponse.json({ success: true });
    }

    const result = await startDeviceTimer(deviceId, action, secs, repeat === true);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Timer request failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
