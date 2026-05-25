import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/config/stocks/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const { enabled } = body;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled required" }, { status: 400 });
  }

  await prisma.stockConfig.update({
    where: { id },
    data: { enabled },
  });

  return NextResponse.json({ success: true });
}
