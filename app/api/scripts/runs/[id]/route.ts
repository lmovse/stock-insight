import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await prisma.scriptRun.findUnique({ where: { id } });
  if (!run) {
    return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  }
  return NextResponse.json(run);
}
