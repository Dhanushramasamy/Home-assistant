import { NextResponse } from "next/server";
import { executeDeviceControl } from "@/lib/deviceController";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId, action } = body;

    if (!deviceId || !action) {
      return NextResponse.json(
        { error: "Both deviceId and action ('on', 'off', 'toggle') are required." },
        { status: 400 }
      );
    }

    if (!["on", "off", "toggle"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'on', 'off', or 'toggle'." },
        { status: 400 }
      );
    }

    const result = await executeDeviceControl(deviceId, action);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Device control request failed",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
