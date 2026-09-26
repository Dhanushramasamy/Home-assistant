import { NextResponse } from "next/server";
import { getDevices, addDevice } from "@/lib/deviceStore";
import { allowedDeviceIds } from "@/lib/accessStore";
import { sessionFrom } from "@/lib/auth/requestSession";

/** GET -> the devices this user may see (admins: all). */
export async function GET(request: Request) {
  try {
    const session = sessionFrom(request);
    if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const devices = await getDevices();
    const allowed = await allowedDeviceIds(session.username, session.role);
    return NextResponse.json(allowed === "all" ? devices : devices.filter((d) => allowed.has(d.id)));
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch devices", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.name || !body.room || !body.ip) {
      return NextResponse.json(
        { error: "Device Name, Room, and IP address are required." },
        { status: 400 }
      );
    }

    const newDevice = await addDevice({
      name: body.name,
      room: body.room,
      type: body.type || "light",
      mode: body.mode || "direct",
      ip: body.ip,
      relay: Number(body.relay) || 1,
      powerState: body.powerState || "off",
      connectionState: body.connectionState || "connected",
    });

    return NextResponse.json(newDevice, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create device", details: (error as Error).message },
      { status: 500 }
    );
  }
}
