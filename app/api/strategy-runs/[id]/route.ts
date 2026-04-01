import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const run = await prisma.strategyRun.findFirst({
    where: { id, userId: user.id },
    include: {
      strategy: { include: { prompt: true } },
      results: { orderBy: { executedAt: "asc" } },
    },
  });

  if (!run) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json(run);
}
