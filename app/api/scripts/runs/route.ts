import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const strategyId = searchParams.get("strategyId");
  const limit = parseInt(searchParams.get("limit") || "20");

  const runs = await prisma.scriptRun.findMany({
    where: strategyId ? { scriptStrategyId: strategyId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(runs);
}
