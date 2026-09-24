import { NextResponse } from "next/server";
import { getNetworkConfig, saveNetworkConfig } from "@/lib/networkStore";

export async function GET() {
  try {
    const config = await getNetworkConfig();
    return NextResponse.json(config);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch network config", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const updated = await saveNetworkConfig(body);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update network config", details: (error as Error).message },
      { status: 500 }
    );
  }
}
