import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const strategyId = searchParams.get("strategyId");
  const limit = parseInt(searchParams.get("limit") ?? "20");
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (strategyId) where.strategyId = strategyId;

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
