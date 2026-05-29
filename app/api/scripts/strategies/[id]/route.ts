import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const strategy = await prisma.scriptStrategy.findUnique({
    where: { id },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 10 } },
  });
  if (!strategy) {
    return NextResponse.json({ error: "策略不存在" }, { status: 404 });
  }
  return NextResponse.json(strategy);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, description, scriptPath, params: scriptParams } = await req.json();

  let strategy;
  try {
    strategy = await prisma.scriptStrategy.update({
      where: { id },
      data: { name, description, scriptPath, params: scriptParams },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "策略不存在" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json(strategy);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await prisma.scriptStrategy.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "策略不存在" }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
