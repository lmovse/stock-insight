import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await prisma.strategyRun.findUnique({
    where: { id },
    include: {
      strategy: { include: { prompt: true } },
      results: { orderBy: { executedAt: "asc" } },
    },
  });

  if (!run) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json(run);
}
