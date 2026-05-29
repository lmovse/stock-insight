import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GLOBAL_USER_ID = "global";

// GET /api/config/categories - 获取所有分类
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const currentUserId = user.id;
    const categories = await prisma.systemCategory.findMany({
      where: {
        OR: [
          { userId: GLOBAL_USER_ID },
          { userId: currentUserId },
        ]
      },
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
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const body = await req.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "code and name required" }, { status: 400 });
    }

    // 检查 code 是否已存在（同一用户下）
    const currentUserId = user.id;
    const existing = await prisma.systemCategory.findFirst({
      where: {
        code,
        OR: [
          { userId: GLOBAL_USER_ID },
          { userId: currentUserId },
        ]
      },
    });
    if (existing) {
      return NextResponse.json({ error: "Code already exists" }, { status: 400 });
    }

    // 获取最大 order
    const maxOrder = await prisma.systemCategory.aggregate({
      where: {
        OR: [
          { userId: GLOBAL_USER_ID },
          { userId: currentUserId },
        ]
      },
      _max: { order: true },
    });

    const category = await prisma.systemCategory.create({
      data: {
        userId: user.id,
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
