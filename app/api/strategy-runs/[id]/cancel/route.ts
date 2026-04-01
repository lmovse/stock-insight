import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Cancel mechanism: uses DB status flag instead of in-memory Set
// to support multi-worker deployments
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const run = await prisma.strategyRun.findUnique({
    where: { id },
  });
  if (!run) return NextResponse.json({ error: "运行不存在" }, { status: 404 });

  // Update status to cancelled in DB - SSE handler polls this
  await prisma.strategyRun.update({
    where: { id },
    data: { status: "cancelled", finishedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
