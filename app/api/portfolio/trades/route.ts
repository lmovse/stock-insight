import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { positionId, type, price, shares, tradedAt } = await req.json();
  if (!positionId || !type || !price || !shares) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const position = await prisma.position.findFirst({
    where: { id: positionId, userId: user.id },
  });
  if (!position) return NextResponse.json({ error: "不存在" }, { status: 404 });

  // Record the trade
  const trade = await prisma.trade.create({
    data: {
      userId: user.id,
      positionId,
      type,
      price,
      shares,
      tradedAt: tradedAt ? new Date(tradedAt) : new Date(),
    },
  });

  // Update position average cost or shares
  if (type === "BUY") {
    const totalCost = position.avgCost * position.shares + price * shares;
    const newShares = position.shares + shares;
    await prisma.position.update({
      where: { id: positionId },
      data: {
        shares: newShares,
        avgCost: totalCost / newShares,
      },
    });
  } else if (type === "SELL") {
    const newShares = position.shares - shares;
    if (newShares < 0) {
      return NextResponse.json({ error: "卖出数量不能超过持仓" }, { status: 400 });
    }
    if (newShares === 0) {
      await prisma.trade.deleteMany({ where: { positionId } });
      await prisma.position.delete({ where: { id: positionId } });
    } else {
      await prisma.position.update({
        where: { id: positionId },
        data: { shares: newShares },
      });
    }
  }

  return NextResponse.json(trade);
}
