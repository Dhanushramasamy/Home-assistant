import { NextResponse } from "next/server";
import { getNetworkConfig } from "@/lib/networkStore";
import { getDevices } from "@/lib/deviceStore";

export async function GET() {
  try {
    const config = await getNetworkConfig();
    const devices = await getDevices();

    return NextResponse.json({
      status: "online",
      gatewayModel: "Raspberry Pi 5 Model B",
      ip: config.gatewayIp || "192.168.1.100",
      port: config.gatewayPort || 5000,
      activeMode: config.mode,
      registeredDevicesCount: devices.length,
      uptime: "99.98%",
      cpuLoad: "1.2%",
      memoryUsage: "412MB / 8GB",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: "offline", error: (error as Error).message },
      { status: 500 }
    );
  }
}
