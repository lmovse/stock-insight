import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stockCode = searchParams.get("stockCode");
  if (!stockCode) {
    return NextResponse.json({ error: "缺少 stockCode" }, { status: 400 });
  }

  const drawings = await prisma.drawingLine.findMany({
    where: { userId: user.id, stockCode },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(drawings);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { stockCode, type, data, color } = await req.json();
  if (!stockCode || !type || !data) {
    return NextResponse.json({ error: "参数不完整" }, { status: 400 });
  }

  const validTypes = ["TREND", "FIBONACCI", "HORIZONTAL", "TEXT"];
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "无效的画线类型" }, { status: 400 });
  }

  const drawing = await prisma.drawingLine.create({
    data: {
      userId: user.id,
      stockCode,
      type,
      data: JSON.stringify(data),
      color: color || "#E53935",
    },
  });

  return NextResponse.json({ ...drawing, data: JSON.parse(drawing.data) });
}
