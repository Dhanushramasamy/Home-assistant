import { NextResponse } from "next/server";
import { updateDevice, deleteDevice, getDeviceById } from "@/lib/deviceStore";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const device = await getDeviceById(id);
    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    return NextResponse.json(device);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch device", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = await updateDevice(id, body);
    if (!updated) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update device", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteDevice(id);
    if (!deleted) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete device", details: (error as Error).message },
      { status: 500 }
    );
  }
}
