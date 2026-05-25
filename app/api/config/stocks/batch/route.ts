import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/config/stocks/batch - batch update enabled
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { ids, enabled } = body;

  if (!ids || !Array.isArray(ids) || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "ids and enabled required" }, { status: 400 });
  }

  await prisma.stockConfig.updateMany({
    where: { id: { in: ids } },
    data: { enabled },
  });

  return NextResponse.json({ success: true, count: ids.length });
}

// DELETE /api/config/stocks/batch - batch delete
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { ids } = body;

  if (!ids || !Array.isArray(ids)) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  await prisma.stockConfig.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ success: true, count: ids.length });
}
