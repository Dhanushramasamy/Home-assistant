import { NextResponse } from "next/server";
import { allowedDeviceIds } from "@/lib/accessStore";
import { sessionFrom } from "@/lib/auth/requestSession";
import { BoardSetupError, getBoardState, listBoards, pushBoardCommand, waitForBoardAck } from "@/lib/boardStore";
import type { Session } from "@/lib/auth/session";
import { supabase } from "@/lib/supabaseClient";
import { getDevices } from "@/lib/deviceStore";
import { DEFAULT_SERVO_SPEED_DPS } from "@/types";

type ServoBoard = Awaited<ReturnType<typeof listBoards>>[number];
type ReadableBoards = { session: Session; boards: ServoBoard[] } | { response: NextResponse };

async function readableBoards(request: Request): Promise<ReadableBoards> {
  const session = sessionFrom(request);
  if (!session) return { response: NextResponse.json({ error: "Not signed in." }, { status: 401 }) };

  const boards = (await listBoards()).filter((board) => board.servoPin !== null);
  if (session.role === "admin") return { session, boards };

  const allowed = await allowedDeviceIds(session.username, session.role);
  if (allowed === "all") return { session, boards };
  const { data, error } = await supabase.from("switches").select("id, board_id").not("board_id", "is", null);
  if (error) throw new Error(error.message);
  const boardIds = new Set((data ?? []).filter((row) => allowed.has(row.id)).map((row) => row.board_id as string));
  return { session, boards: boards.filter((board) => boardIds.has(board.boardId)) };
}

/** Servo-capable boards the signed-in user can control. */
export async function GET(request: Request) {
  try {
    const result = await readableBoards(request);
    if ("response" in result) return result.response;
    const boards = await Promise.all(result.boards.map(async (board) => {
      const state = await getBoardState(board.boardId);
      const servo = state?.report?.servo as { ready?: unknown; angle?: unknown; targetAngle?: unknown; speedDps?: unknown; moving?: unknown } | undefined;
      return {
        boardId: board.boardId,
        name: board.name || board.boardId,
        pin: board.servoPin,
        online: state?.online ?? false,
        ready: servo?.ready === true,
        lastSeen: state?.lastSeen ?? null,
        angle: typeof servo?.angle === "number" ? servo.angle : 90,
        targetAngle: typeof servo?.targetAngle === "number" ? servo.targetAngle : undefined,
        speedDps: typeof servo?.speedDps === "number" ? servo.speedDps : undefined,
        moving: servo?.moving === true,
      };
    }));
    return NextResponse.json({ boards });
  } catch (error) {
    const setup = error instanceof BoardSetupError;
    return NextResponse.json({ boards: [], error: (error as Error).message }, { status: setup ? 503 : 500 });
  }
}

/** Queue a servo angle and wait for the ESP32 to confirm it. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const boardId = typeof body.boardId === "string" ? body.boardId : "";
    const angle = body.angle;
    const configuredDevice = (await getDevices()).find((device) => device.type === "servo" && device.boardId === boardId);
    const speed = body.speed === undefined ? configuredDevice?.servoSpeedDps ?? DEFAULT_SERVO_SPEED_DPS : body.speed;
    if (!boardId || !Number.isInteger(angle) || angle < 0 || angle > 180) {
      return NextResponse.json({ error: "Choose a board and an angle from 0 to 180." }, { status: 400 });
    }
    if (!Number.isInteger(speed) || speed < 1 || speed > 180) return NextResponse.json({ error: "Speed must be a whole number from 1 to 180 degrees per second." }, { status: 400 });

    const visible = await readableBoards(request);
    if ("response" in visible) return visible.response;
    const board = visible.boards.find((item) => item.boardId === boardId);
    if (!board) return NextResponse.json({ error: "You don't have access to this servo board." }, { status: 403 });

    const current = await getBoardState(boardId);
    if (!current) return NextResponse.json({ error: "Board not found." }, { status: 404 });
    if (!current.online) return NextResponse.json({ error: "The ESP32 is offline." }, { status: 409 });
    const servo = current.report?.servo as { ready?: unknown } | undefined;
    if (servo?.ready !== true) return NextResponse.json({ error: "Servo firmware isn't ready. Download and upload this board's latest code." }, { status: 409 });

    const seq = await pushBoardCommand(boardId, { op: "servo", angle, speed });
    if (seq === null) return NextResponse.json({ error: "Board not found." }, { status: 404 });
    const { ack, state } = await waitForBoardAck(boardId, seq, 9_000);
    if (!ack) {
      const report = state?.report;
      const servoReport = report?.servo as { ready?: unknown; angle?: unknown } | undefined;
      const diagnostics = {
        boardId,
        seq,
        online: state?.online ?? false,
        cloudState: typeof report?.cloud === "string" ? report.cloud : "unknown",
        servoReady: servoReport?.ready === true,
        reportedAngle: typeof servoReport?.angle === "number" ? servoReport.angle : null,
        lastSeen: state?.lastSeen ?? null,
        reportedAcks: Array.isArray(report?.acks) ? report.acks : [],
      };
      console.warn("[servo] ESP32 did not acknowledge angle command", diagnostics);
      return NextResponse.json({
        error: "The ESP32 hasn't confirmed the servo position yet.",
        diagnostics,
      }, { status: 504 });
    }
    if (!ack.ok) return NextResponse.json({ error: ack.error === "invalid" ? "Servo control isn't enabled in this board's firmware." : "The ESP32 couldn't move the servo." }, { status: 422 });

    return NextResponse.json({
      ok: true,
      angle: ack.id ?? angle,
      targetAngle: ack.id ?? angle,
      speedDps: speed,
      reportedAngle: (state?.report?.servo as { angle?: number } | undefined)?.angle ?? ack.id ?? angle,
    });
  } catch (error) {
    const setup = error instanceof BoardSetupError;
    return NextResponse.json({ error: (error as Error).message }, { status: setup ? 503 : 500 });
  }
}
