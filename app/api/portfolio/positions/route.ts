import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const positions = await prisma.position.findMany({
    where: { userId: user.id },
    include: { trades: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(positions);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { stockCode, shares, price, tradedAt } = await req.json();
  if (!stockCode || !shares || !price) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const position = await prisma.position.create({
    data: {
      userId: user.id,
      stockCode,
      shares,
      avgCost: price,
    },
  });

  // Record the BUY trade
  await prisma.trade.create({
    data: {
      userId: user.id,
      positionId: position.id,
      type: "BUY",
      price,
      shares,
      tradedAt: tradedAt ? new Date(tradedAt) : new Date(),
    },
  });

  return NextResponse.json(position);
}
