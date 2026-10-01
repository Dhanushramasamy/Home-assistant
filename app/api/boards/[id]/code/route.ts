import { NextResponse } from "next/server";
import { BoardSetupProblem, boardCodeZip } from "@/lib/boardSetup";

// Admin only (proxy.ts). The board's ready-to-upload Arduino folder (.zip).
// It holds Wi-Fi passwords and the board's sign-in, so it's never cached.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const zip = await boardCodeZip(id);
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${id}.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const known = error instanceof BoardSetupProblem;
    return NextResponse.json({ error: (error as Error).message }, { status: known ? 400 : 500 });
  }
}
