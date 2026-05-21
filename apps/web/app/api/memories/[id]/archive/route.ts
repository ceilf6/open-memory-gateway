import { NextResponse } from "next/server";
import { withMemoryActions } from "@/src/memory-actions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const data = await withMemoryActions((actions) => actions.archiveMemory(id));
    return NextResponse.json({ data });
  } catch (error) {
    return jsonError(error);
  }
}

function jsonError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  return NextResponse.json({ error: message }, { status: 400 });
}
