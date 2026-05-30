import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;

  const { id } = await params;
  const run = await prisma.strategyRun.findUnique({
    where: { id },
    include: {
      strategy: { include: { prompt: true } },
      results: { orderBy: { stockCode: "asc" } },
    },
  });

  if (!run) return NextResponse.json({ error: "不存在" }, { status: 404 });

  // 用户隔离检查
  if (run.strategy.userId !== GLOBAL_USER_ID && run.strategy.userId !== currentUserId) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  return NextResponse.json(run);
}
