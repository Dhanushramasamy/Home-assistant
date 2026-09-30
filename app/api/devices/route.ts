import { NextResponse } from "next/server";
import { getDevices, addDevice } from "@/lib/deviceStore";
import { allowedDeviceIds } from "@/lib/accessStore";
import { sessionFrom } from "@/lib/auth/requestSession";
import { reportedPower } from "@/lib/boardStore";
import { powerForRelay } from "@/lib/timerParse";
import { Device } from "@/types";

/** Cloud devices: power and online state come from their board's last report. */
async function withBoardState(devices: Device[]): Promise<Device[]> {
  const boardIds = [...new Set(devices.map((d) => d.boardId).filter((b): b is string => !!b))];
  if (boardIds.length === 0) return devices;
  const boards = await reportedPower(boardIds);
  return devices.map((d) => {
    const board = d.boardId ? boards.get(d.boardId) : undefined;
    if (!board) return d;
    const power = board.online && board.report ? powerForRelay(board.report, d.relay || 1) : undefined;
    return { ...d, ...(power ? { powerState: power } : {}), connectionState: board.online ? "connected" : "offline" };
  });
}

/** GET -> the devices this user may see (admins: all). */
export async function GET(request: Request) {
  try {
    const session = sessionFrom(request);
    if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const devices = await withBoardState(await getDevices());
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
      ...(body.boardId ? { boardId: String(body.boardId).trim() } : {}),
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
