import { NextResponse } from "next/server";
import { updateDevice, deleteDevice, getDeviceById } from "@/lib/deviceStore";
import { denyDeviceAccess } from "@/lib/auth/requestSession";
import { executeDeviceControl } from "@/lib/deviceController";
import { DEFAULT_SERVO_OFF_ANGLE, DEFAULT_SERVO_ON_ANGLE, DEFAULT_SERVO_SPEED_DPS } from "@/types";

/** Device records use a separate path from /api/devices/test and /status. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const denied = await denyDeviceAccess(request, id);
    if (denied) return denied;
    const device = await getDeviceById(id);
    if (!device) return NextResponse.json({ error: "Device not found." }, { status: 404 });
    return NextResponse.json(device);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch device.", details: (error as Error).message }, { status: 500 });
  }
}

/** Admin only through proxy.ts. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const current = await getDeviceById(id);
    if (!current) return NextResponse.json({ error: "Device not found." }, { status: 404 });
    const nextType = body.type ?? current.type;
    if (nextType === "servo" || body.servoOnAngle !== undefined || body.servoOffAngle !== undefined || body.servoSpeedDps !== undefined) {
      const angle = Number(body.servoOnAngle ?? current.servoOnAngle ?? DEFAULT_SERVO_ON_ANGLE);
      const offAngle = Number(body.servoOffAngle ?? current.servoOffAngle ?? DEFAULT_SERVO_OFF_ANGLE);
      const speed = Number(body.servoSpeedDps ?? current.servoSpeedDps ?? DEFAULT_SERVO_SPEED_DPS);
      if (!Number.isInteger(angle) || angle < 0 || angle > 180 || !Number.isInteger(offAngle) || offAngle < 0 || offAngle > 180 || angle === offAngle || !Number.isInteger(speed) || speed < 1 || speed > 180) {
        return NextResponse.json({ error: "Use different whole-number angles from 0 to 180° for ON and OFF, and a speed from 1 to 180°/sec." }, { status: 400 });
      }
    }
    const updated = await updateDevice(id, body);
    if (!updated) return NextResponse.json({ error: "Device not found." }, { status: 404 });
    const servoSettingsChanged = updated.type === "servo" && (
      current.type !== "servo"
      || updated.servoOnAngle !== (current.servoOnAngle ?? DEFAULT_SERVO_ON_ANGLE)
      || updated.servoOffAngle !== (current.servoOffAngle ?? DEFAULT_SERVO_OFF_ANGLE)
      || updated.servoSpeedDps !== (current.servoSpeedDps ?? DEFAULT_SERVO_SPEED_DPS)
    );
    if (!servoSettingsChanged) return NextResponse.json(updated);

    // A changed target/speed can make the old reported position unknown under
    // the new settings. Move to the configured OFF angle to establish state.
    const servoMove = await executeDeviceControl(id, "off");
    return NextResponse.json({ ...updated, servoMove });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update device.", details: (error as Error).message }, { status: 500 });
  }
}

/** Admin only through proxy.ts. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteDevice(id);
    if (!deleted) return NextResponse.json({ error: "Device not found." }, { status: 404 });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete device.", details: (error as Error).message }, { status: 500 });
  }
}
