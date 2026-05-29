import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

export async function GET() {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;

  const strategies = await prisma.strategy.findMany({
    where: {
      OR: [
        { userId: GLOBAL_USER_ID },
        { userId: currentUserId },
      ]
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { name, description, criteria, promptId } = await req.json();
  if (!name || !promptId) {
    return NextResponse.json({ error: "名称和提示词不能为空" }, { status: 400 });
  }

  // Check prompt exists
  const prompt = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!prompt) {
    return NextResponse.json({ error: "提示词不存在" }, { status: 400 });
  }

  const strategy = await prisma.strategy.create({
    data: {
      userId: user.id,
      name,
      description,
      criteria,
      promptId,
    },
  });

  return NextResponse.json(strategy);
}
