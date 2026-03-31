import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const groups = await prisma.watchlistGroup.findMany({
    where: { userId: user.id },
    include: { items: true },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "分组名称不能为空" }, { status: 400 });

  const maxOrder = await prisma.watchlistGroup.aggregate({
    where: { userId: user.id },
    _max: { order: true },
  });

  const group = await prisma.watchlistGroup.create({
    data: { userId: user.id, name, order: (maxOrder._max.order ?? 0) + 1 },
  });

  return NextResponse.json(group);
}
