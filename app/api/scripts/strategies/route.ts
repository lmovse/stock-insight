import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const strategies = await prisma.scriptStrategy.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const { name, description, scriptPath, params } = await req.json();
  if (!name || !scriptPath) {
    return NextResponse.json({ error: "名称和脚本路径不能为空" }, { status: 400 });
  }

  const strategy = await prisma.scriptStrategy.create({
    data: { name, description, scriptPath, params },
  });

  return NextResponse.json(strategy);
}
