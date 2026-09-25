import { NextResponse } from "next/server";
import { cancelDeviceTimer } from "@/lib/deviceController";

export async function POST(request: Request) {
  try {
    const { deviceId } = await request.json();
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId is required." }, { status: 400 });
    }
    const result = await cancelDeviceTimer(deviceId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Timer cancel failed", message: (error as Error).message },
      { status: 500 }
    );
  }
}
