import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

export async function GET() {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;

  const prompts = await prisma.prompt.findMany({
    where: {
      OR: [
        { userId: GLOBAL_USER_ID },
        { userId: currentUserId },
      ]
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(prompts);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { name, content } = await req.json();
  if (!name || !content) {
    return NextResponse.json({ error: "名称和内容不能为空" }, { status: 400 });
  }

  const prompt = await prisma.prompt.create({
    data: {
      userId: user.id,
      name,
      content,
    },
  });

  return NextResponse.json(prompt);
}
