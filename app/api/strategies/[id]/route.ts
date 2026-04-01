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
  const strategy = await prisma.strategy.findFirst({
    where: { id, userId: user.id },
    include: { prompt: true },
  });

  if (!strategy) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json(strategy);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { name, description, promptId } = await req.json();

  const existing = await prisma.strategy.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  if (promptId && promptId !== existing.promptId) {
    const prompt = await prisma.prompt.findFirst({
      where: { id: promptId, userId: user.id },
    });
    if (!prompt) {
      return NextResponse.json({ error: "提示词不存在" }, { status: 400 });
    }
  }

  const strategy = await prisma.strategy.update({
    where: { id },
    data: { name, description, promptId },
    include: { prompt: true },
  });

  return NextResponse.json(strategy);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.strategy.findFirst({
    where: { id, userId: user.id },
    include: { runs: true },
  });
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  await prisma.strategy.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
