import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GLOBAL_USER_ID = "global";

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

    // 检查是否存在
    const existing = await prisma.systemCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // 检查所有权
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "无权修改" }, { status: 403 });
    }

    // 检查是否重复（排除自己）
    const duplicate = await prisma.systemCategory.findFirst({
      where: { code, id: { not: id } },
    });
    if (duplicate) {
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

    // 检查是否存在
    const existing = await prisma.systemCategory.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // 检查所有权
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: "无权删除" }, { status: 403 });
    }

    await prisma.systemCategory.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[api/config/categories/:id] DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
