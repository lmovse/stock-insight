import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prompt = await prisma.prompt.findUnique({
    where: { id },
  });

  if (!prompt) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json(prompt);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, content } = await req.json();

  const existing = await prisma.prompt.findUnique({
    where: { id },
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
  const { id } = await params;

  const existing = await prisma.prompt.findUnique({
    where: { id },
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
