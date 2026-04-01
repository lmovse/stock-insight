import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Cancel mechanism: uses DB status flag instead of in-memory Set
// to support multi-worker deployments
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const run = await prisma.strategyRun.findFirst({
    where: { id, userId: user.id },
  });
  if (!run) return NextResponse.json({ error: "运行不存在" }, { status: 404 });

  // Update status to cancelled in DB - SSE handler polls this
  await prisma.strategyRun.update({
    where: { id },
    data: { status: "cancelled", finishedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
