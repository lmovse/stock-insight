import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { stockCodes, startDate, endDate, dataConfig } = await req.json();

  if (!stockCodes || !Array.isArray(stockCodes) || stockCodes.length === 0) {
    return NextResponse.json({ error: "请选择股票" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "请选择日期区间" }, { status: 400 });
  }

  const strategy = await prisma.strategy.findFirst({
    where: { id, userId: user.id },
    include: { prompt: true },
  });
  if (!strategy) return NextResponse.json({ error: "策略不存在" }, { status: 404 });

  const run = await prisma.strategyRun.create({
    data: {
      userId: user.id,
      strategyId: id,
      stockCodes: JSON.stringify(stockCodes),
      startDate,
      endDate,
      dataConfig: dataConfig ?? '{"kline":true}',
      status: "pending",
    },
  });

  return NextResponse.json({ taskId: run.id });
}
