import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Default indicator config
const defaultIndicators = {
  ma: true,
  maPeriods: [5, 10, 20, 60],
  macd: true,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  kdj: false,
  kdjK: 9,
  kdjD: 3,
  kdjJ: 3,
  boll: false,
  bollPeriod: 20,
  bollStdDev: 2,
  rsi: false,
  rsiPeriod: 14,
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const config = await prisma.chartConfig.findUnique({
    where: { userId: user.id },
  });

  if (!config) {
    return NextResponse.json(defaultIndicators);
  }

  return NextResponse.json(JSON.parse(config.indicators));
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const indicators = await req.json();

  const config = await prisma.chartConfig.upsert({
    where: { userId: user.id },
    update: { indicators: JSON.stringify(indicators) },
    create: {
      userId: user.id,
      indicators: JSON.stringify(indicators),
      theme: "dark",
    },
  });

  return NextResponse.json(JSON.parse(config.indicators));
}
