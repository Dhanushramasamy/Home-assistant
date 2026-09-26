import { NextResponse } from "next/server";
import { testDeviceReachability } from "@/lib/deviceController";
import { denyDeviceAccess } from "@/lib/auth/requestSession";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { deviceId } = body;
    const denied = await denyDeviceAccess(request, deviceId);
    if (denied) return denied;

    if (!deviceId) {
      return NextResponse.json(
        { error: "deviceId is required" },
        { status: 400 }
      );
    }

    const result = await testDeviceReachability(deviceId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Connection test failed",
        message: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
