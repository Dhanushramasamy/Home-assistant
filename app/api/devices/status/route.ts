import { NextResponse, type NextRequest } from "next/server";
import { getDeviceStatus } from "@/lib/deviceController";

export async function GET(request: NextRequest) {
  const deviceId = request.nextUrl.searchParams.get("deviceId");
  if (!deviceId) {
    return NextResponse.json({ error: "deviceId is required." }, { status: 400 });
  }
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
