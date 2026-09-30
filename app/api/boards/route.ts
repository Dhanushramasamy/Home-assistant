import { NextResponse } from "next/server";
import { BoardSetupError, listBoards } from "@/lib/boardStore";

/** GET -> every cloud board with its network, IP and last check-in (admins only, see proxy.ts). */
export async function GET() {
  try {
    return NextResponse.json({ boards: await listBoards() });
  } catch (error) {
    const setup = error instanceof BoardSetupError;
    return NextResponse.json(
      { boards: [], error: (error as Error).message, setupNeeded: setup },
      { status: setup ? 200 : 500 }
    );
  }
}
