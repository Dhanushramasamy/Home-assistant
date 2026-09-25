import { NextResponse } from "next/server";
import { startDeviceTimer } from "@/lib/deviceController";

const MAX_SECONDS = 24 * 60 * 60;

export async function POST(request: Request) {
  try {
    const { deviceId, action, seconds, repeat } = await request.json();

    if (!deviceId || (action !== "on" && action !== "off")) {
      return NextResponse.json({ error: "deviceId and action ('on' or 'off') are required." }, { status: 400 });
    }
    const secs = Number(seconds);
    if (!Number.isInteger(secs) || secs < 1 || secs > MAX_SECONDS) {
      return NextResponse.json({ error: `seconds must be a whole number from 1 to ${MAX_SECONDS}.` }, { status: 400 });
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
