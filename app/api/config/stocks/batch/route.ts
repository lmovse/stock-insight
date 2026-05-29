import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { ids, enabled } = body;

  if (!ids || !Array.isArray(ids) || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "ids and enabled required" }, { status: 400 });
  }

  // Only update configs belonging to the user
  const result = await prisma.stockConfig.updateMany({
    where: {
      id: { in: ids },
      userId: user.id,  // Only user's own configs
    },
    data: { enabled },
  });

  return NextResponse.json({ success: true, count: result.count });
}

// DELETE /api/config/stocks/batch - batch delete
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids)) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  // Only delete configs belonging to the user
  const result = await prisma.stockConfig.deleteMany({
    where: {
      id: { in: ids },
      userId: user.id,  // Only user's own configs
    },
  });

  return NextResponse.json({ success: true, count: result.count });
}
