import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const strategies = await prisma.strategy.findMany({
    include: { prompt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const { name, description, promptId } = await req.json();
  if (!name || !promptId) {
    return NextResponse.json({ error: "名称和提示词不能为空" }, { status: 400 });
  }

  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
  });
  if (!prompt) {
    return NextResponse.json({ error: "提示词不存在" }, { status: 400 });
  }

  const strategy = await prisma.strategy.create({
    data: { name, description, promptId },
    include: { prompt: true },
  });

  return NextResponse.json(strategy);
}
