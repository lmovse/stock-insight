import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { stockCodes, startDate, endDate, dataConfig } = await req.json();

  if (!stockCodes || !Array.isArray(stockCodes) || stockCodes.length === 0) {
    return NextResponse.json({ error: "请选择股票" }, { status: 400 });
  }
  if (!startDate || !endDate) {
    return NextResponse.json({ error: "请选择日期区间" }, { status: 400 });
  }

  const strategy = await prisma.strategy.findUnique({
    where: { id },
    include: { prompt: true },
  });
  if (!strategy) return NextResponse.json({ error: "策略不存在" }, { status: 404 });

  const run = await prisma.strategyRun.create({
    data: {
      strategyId: id,
      stockCodes: JSON.stringify(stockCodes),
      startDate,
      endDate,
      dataConfig: JSON.stringify(dataConfig ?? { kline: true }),
      status: "pending",
    },
  });

  return NextResponse.json({ taskId: run.id });
}
