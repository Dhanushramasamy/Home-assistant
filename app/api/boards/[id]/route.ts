import { NextResponse } from "next/server";
import { BoardSetupProblem, deleteBoard, saveBoardSetup } from "@/lib/boardSetup";
import { BoardSetupInput } from "@/types";

// Admin only (proxy.ts). Save or delete one board (Settings → Boards).

/** PUT {name, relayPins, relayActiveLow, wifi} -> creates or updates the board. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const input = (await request.json()) as BoardSetupInput;
    const result = await saveBoardSetup(id, input);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const known = error instanceof BoardSetupProblem;
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: known ? 400 : 500 });
  }
}

/** DELETE -> removes the board and its sign-in; its switches stay, with no board. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const deleted = await deleteBoard(id);
    return NextResponse.json({ success: deleted }, { status: deleted ? 200 : 404 });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
