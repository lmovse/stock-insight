import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const prompts = await prisma.prompt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(prompts);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { name, content } = await req.json();
  if (!name || !content) {
    return NextResponse.json({ error: "名称和内容不能为空" }, { status: 400 });
  }

  const prompt = await prisma.prompt.create({
    data: { userId: user.id, name, content },
  });

  return NextResponse.json(prompt);
}
