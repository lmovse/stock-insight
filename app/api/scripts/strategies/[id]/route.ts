import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;
  const { id } = await params;

  const strategy = await prisma.scriptStrategy.findUnique({
    where: { id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  if (!strategy) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  if (strategy.userId !== GLOBAL_USER_ID && strategy.userId !== currentUserId) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  return NextResponse.json(strategy);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.scriptStrategy.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  if (existing.userId !== GLOBAL_USER_ID && existing.userId !== user.id) {
    return NextResponse.json({ error: "无权修改" }, { status: 403 });
  }

  const { name, description, scriptPath, params: scriptParams } = await req.json();
  const strategy = await prisma.scriptStrategy.update({
    where: { id },
    data: { name, description, scriptPath, params: scriptParams },
  });
  return NextResponse.json(strategy);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.scriptStrategy.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }

  if (existing.userId !== GLOBAL_USER_ID && existing.userId !== user.id) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }

  await prisma.scriptStrategy.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
