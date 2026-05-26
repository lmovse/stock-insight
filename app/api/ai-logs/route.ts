import { NextRequest, NextResponse } from "next/server";
import { getAILogs, getAILogsByRunId } from "@/lib/aiLog";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const runId = searchParams.get("runId");

  if (runId) {
    return NextResponse.json(getAILogsByRunId(runId));
  }
  return NextResponse.json(getAILogs());
}
