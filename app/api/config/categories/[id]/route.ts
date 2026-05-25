import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT /api/config/categories/:id
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { code, name } = body;

    if (!code || !name) {
      return NextResponse.json({ error: "code and name required" }, { status: 400 });
    }

    // 检查是否重复（排除自己）
    const existing = await prisma.systemCategory.findFirst({
      where: { code, id: { not: id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Code already exists" }, { status: 400 });
    }

    const category = await prisma.systemCategory.update({
      where: { id },
      data: { code, name },
    });

    return NextResponse.json(category);
  } catch (e) {
    console.error("[api/config/categories/:id] PUT error:", e);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

// DELETE /api/config/categories/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    const { id } = await params;

    await prisma.systemCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[api/config/categories/:id] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
