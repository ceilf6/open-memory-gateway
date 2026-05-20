import { NextResponse } from "next/server";
import { parseOptionalStatus, withMemoryActions } from "@/src/memory-actions";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const status = parseOptionalStatus(searchParams.get("status"));
    const query = searchParams.get("q")?.trim() ?? "";
    const data = await withMemoryActions((actions) =>
      query ? actions.searchMemories({ query, status }) : actions.listMemories({ status }),
    );

    return NextResponse.json({ data });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const input = await request.json();
    const data = await withMemoryActions((actions) => actions.captureMemory(input));
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

function jsonError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 400 });
}
