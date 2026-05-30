import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const strategyId = searchParams.get("strategyId");
  const stockCode = searchParams.get("stockCode");
  const strategyName = searchParams.get("strategyName");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = {
    strategy: {
      OR: [
        { userId: GLOBAL_USER_ID },
        { userId: currentUserId },
      ],
    },
  };
  if (status) where.status = status;
  if (strategyId) where.strategyId = strategyId;

  // Search by stock code (stored as JSON string in stockCodes field)
  if (stockCode) {
    where.stockCodes = { contains: stockCode };
  }

  // Search by strategy name (must preserve user isolation)
  if (strategyName) {
    where.strategy = {
      OR: [
        { userId: GLOBAL_USER_ID },
        { userId: currentUserId },
      ],
      name: { contains: strategyName },
    };
  }

  const [runs, total] = await Promise.all([
    prisma.strategyRun.findMany({
      where,
      include: { strategy: { include: { prompt: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.strategyRun.count({ where }),
  ]);

  return NextResponse.json({ runs, total });
}
