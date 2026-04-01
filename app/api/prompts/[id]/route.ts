import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const prompt = await prisma.prompt.findFirst({
    where: { id, userId: user.id },
  });

  if (!prompt) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json(prompt);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { name, content } = await req.json();

  const existing = await prisma.prompt.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  const prompt = await prisma.prompt.update({
    where: { id },
    data: { name, content },
  });

  return NextResponse.json(prompt);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.prompt.findFirst({
    where: { id, userId: user.id },
    include: { strategies: true },
  });
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  if (existing.strategies.length > 0) {
    return NextResponse.json(
      { error: "该提示词被策略引用，无法删除" },
      { status: 409 }
    );
  }

  await prisma.prompt.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
