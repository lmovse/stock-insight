import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;
  const { shares, avgCost } = await req.json();

  const position = await prisma.position.findFirst({
    where: { id, userId: user.id },
  });
  if (!position) return NextResponse.json({ error: "不存在" }, { status: 404 });

  const updated = await prisma.position.update({
    where: { id },
    data: { shares, avgCost },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const position = await prisma.position.findFirst({
    where: { id, userId: user.id },
  });
  if (!position) return NextResponse.json({ error: "不存在" }, { status: 404 });

  await prisma.trade.deleteMany({ where: { positionId: id } });
  await prisma.position.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
