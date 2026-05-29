import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;
  const { id } = await params;

  const prompt = await prisma.prompt.findUnique({
    where: { id },
  });

  if (!prompt) return NextResponse.json({ error: "不存在" }, { status: 404 });

  if (prompt.userId !== GLOBAL_USER_ID && prompt.userId !== currentUserId) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  return NextResponse.json(prompt);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;
  const { name, content } = await req.json();

  const existing = await prisma.prompt.findUnique({
    where: { id },
  });
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  if (existing.userId !== user.id) {
    return NextResponse.json({ error: "无权修改" }, { status: 403 });
  }

  const prompt = await prisma.prompt.update({
    where: { id },
    data: { name, content },
  });

  return NextResponse.json(prompt);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.prompt.findUnique({
    where: { id },
    include: { strategies: true },
  });
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  if (existing.userId !== user.id) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }

  if (existing.strategies.length > 0) {
    return NextResponse.json(
      { error: "该提示词被策略引用，无法删除" },
      { status: 409 }
    );
  }

  await prisma.prompt.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
