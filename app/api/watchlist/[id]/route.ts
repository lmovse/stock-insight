import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id } = await params;

  const item = await prisma.watchlistItem.findFirst({
    where: { id, userId: user.id },
  });
  if (!item) return NextResponse.json({ error: "不存在" }, { status: 404 });

  await prisma.watchlistItem.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
