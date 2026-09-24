import { NextResponse } from "next/server";
import { resetDevicesToDefault } from "@/lib/deviceStore";
import { resetNetworkConfigToDefault } from "@/lib/networkStore";

export async function POST() {
  try {
    const devices = await resetDevicesToDefault();
    const network = await resetNetworkConfigToDefault();
    return NextResponse.json({
      message: "Successfully reset devices and network settings to default sample data.",
      devices,
      network,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reset sample data", details: (error as Error).message },
      { status: 500 }
    );
  }
}
