import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

// PATCH /api/config/stocks/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { enabled } = body;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled required" }, { status: 400 });
  }

  const existing = await prisma.stockConfig.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Stock config not found" }, { status: 404 });
  }

  // Only owner can modify (userId must match, null means system-level which is not modifiable)
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: "无权修改" }, { status: 403 });
  }

  await prisma.stockConfig.update({
    where: { id },
    data: { enabled },
  });

  return NextResponse.json({ success: true });
}
