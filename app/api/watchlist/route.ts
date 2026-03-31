import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const items = await prisma.watchlistItem.findMany({
    where: { userId: user.id },
    include: { group: true },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { stockCode, groupId } = await req.json();
  if (!stockCode) {
    return NextResponse.json({ error: "股票代码不能为空" }, { status: 400 });
  }

  // Check if already in watchlist
  const existing = await prisma.watchlistItem.findFirst({
    where: { userId: user.id, stockCode },
  });
  if (existing) {
    return NextResponse.json({ error: "该股票已在自选股中" }, { status: 409 });
  }

  const item = await prisma.watchlistItem.create({
    data: { userId: user.id, stockCode, groupId },
  });

  return NextResponse.json(item);
}
