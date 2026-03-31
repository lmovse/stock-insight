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
  const { data, color } = await req.json();

  const drawing = await prisma.drawingLine.findFirst({
    where: { id, userId: user.id },
  });
  if (!drawing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  const updated = await prisma.drawingLine.update({
    where: { id },
    data: {
      ...(data && { data: JSON.stringify(data) }),
      ...(color && { color }),
    },
  });

  return NextResponse.json({ ...updated, data: JSON.parse(updated.data) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const drawing = await prisma.drawingLine.findFirst({
    where: { id, userId: user.id },
  });
  if (!drawing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  await prisma.drawingLine.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
