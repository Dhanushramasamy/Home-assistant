import { NextResponse } from "next/server";
import { clearAllDevices } from "@/lib/deviceStore";

export async function POST() {
  try {
    const devices = await clearAllDevices();
    return NextResponse.json({
      message: "Cleared all sample data. Ready for real devices.",
      devices,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to clear devices", details: (error as Error).message },
      { status: 500 }
    );
  }
}
