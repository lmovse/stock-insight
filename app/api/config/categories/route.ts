import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/config/categories - 获取所有分类
export async function GET() {
  try {
    const categories = await prisma.systemCategory.findMany({
      orderBy: { order: "asc" },
    });
    return NextResponse.json(categories);
  } catch (e) {
    console.error("[api/config/categories] GET error:", e);
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

// POST /api/config/categories - 创建分类
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "code and name required" }, { status: 400 });
    }

    // 检查 code 是否已存在
    const existing = await prisma.systemCategory.findUnique({
      where: { code },
    });
    if (existing) {
      return NextResponse.json({ error: "Code already exists" }, { status: 400 });
    }

    // 获取最大 order
    const maxOrder = await prisma.systemCategory.aggregate({
      _max: { order: true },
    });

    const category = await prisma.systemCategory.create({
      data: {
        code,
        name,
        order: (maxOrder._max.order || 0) + 1,
      },
    });

    return NextResponse.json(category);
  } catch (e) {
    console.error("[api/config/categories] POST error:", e);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
