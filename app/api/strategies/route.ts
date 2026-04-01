import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const strategies = await prisma.strategy.findMany({
    where: { userId: user.id },
    include: { prompt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { name, description, promptId } = await req.json();
  if (!name || !promptId) {
    return NextResponse.json({ error: "名称和提示词不能为空" }, { status: 400 });
  }

  const prompt = await prisma.prompt.findFirst({
    where: { id: promptId, userId: user.id },
  });
  if (!prompt) {
    return NextResponse.json({ error: "提示词不存在" }, { status: 400 });
  }

  const strategy = await prisma.strategy.create({
    data: { userId: user.id, name, description, promptId },
    include: { prompt: true },
  });

  return NextResponse.json(strategy);
}
