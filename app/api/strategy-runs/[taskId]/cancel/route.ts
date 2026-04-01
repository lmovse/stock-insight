import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// In-memory cancel flags (keyed by run id)
// In production, use Redis or DB flag
const cancelFlags = new Set<string>();

export function setCancelFlag(taskId: string) {
  cancelFlags.add(taskId);
}

export function isCancelled(taskId: string): boolean {
  return cancelFlags.has(taskId);
}

export function clearCancelFlag(taskId: string) {
  cancelFlags.delete(taskId);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { taskId } = await params;

  const run = await prisma.strategyRun.findFirst({
    where: { id: taskId, userId: user.id },
  });
  if (!run) return NextResponse.json({ error: "运行不存在" }, { status: 404 });

  setCancelFlag(taskId);

  if (run.status === "running") {
    await prisma.strategyRun.update({
      where: { id: taskId },
      data: { status: "cancelled", finishedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
