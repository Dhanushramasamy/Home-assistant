import { NextResponse } from "next/server";
import { getDevices, addDevice } from "@/lib/deviceStore";
import { allowedDeviceIds } from "@/lib/accessStore";
import { sessionFrom } from "@/lib/auth/requestSession";
import { listBoards } from "@/lib/boardStore";

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
    const session = sessionFrom(request);
    if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (session.role !== "admin") return NextResponse.json({ error: "Only an admin can add devices." }, { status: 403 });
    const body = await request.json();
    
    // A cloud board needs no IP (it gets one from the Wi-Fi); otherwise the IP is how it's reached.
    if (!body.name || !body.room || (!body.ip && !body.boardId)) {
      return NextResponse.json(
        { error: "Name, room, and a board (or IP address) are required." },
        { status: 400 }
      );
    }

    const type = ["light", "fan", "plug", "other", "servo"].includes(body.type) ? body.type : "light";
    const servoOnAngle = Number(body.servoOnAngle ?? 90);
    const servoOffAngle = Number(body.servoOffAngle ?? 180);
    const servoSpeedDps = Number(body.servoSpeedDps ?? 20);
    if (type === "servo" && (!Number.isInteger(servoOnAngle) || servoOnAngle < 0 || servoOnAngle > 180 || !Number.isInteger(servoOffAngle) || servoOffAngle < 0 || servoOffAngle > 180 || servoOnAngle === servoOffAngle || !Number.isInteger(servoSpeedDps) || servoSpeedDps < 1 || servoSpeedDps > 180)) {
      return NextResponse.json({ error: "Use different whole-number angles from 0 to 180° for ON and OFF, and a speed from 1 to 180°/sec." }, { status: 400 });
    }
    const boardId = typeof body.boardId === "string" ? body.boardId.trim().toLowerCase() : "";
    if (type === "servo") {
      if (!boardId) return NextResponse.json({ error: "Servo devices need a cloud board." }, { status: 400 });
      const board = (await listBoards()).find((item) => item.boardId === boardId);
      if (!board || typeof board.servoPin !== "number") return NextResponse.json({ error: "Choose a board with servo support enabled in Settings → Boards." }, { status: 400 });
    }

    const newDevice = await addDevice({
      name: body.name,
      room: body.room,
      type,
      mode: body.mode || "direct",
      ip: body.ip,
      relay: Number(body.relay) || 1,
      ...(boardId ? { boardId } : {}),
      ...(type === "servo" ? { servoOnAngle, servoOffAngle, servoSpeedDps } : {}),
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
