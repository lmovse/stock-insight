import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/config/stocks?purpose=FIFTEEN_MIN
export async function GET(req: NextRequest) {
  const purpose = req.nextUrl.searchParams.get("purpose");
  if (!purpose) {
    return NextResponse.json({ error: "purpose required" }, { status: 400 });
  }

  const configs = await prisma.stockConfig.findMany({
    where: { purpose },
    include: { stockBasic: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(configs);
}

// POST /api/config/stocks
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { stockCodes, purpose } = body;

  if (!stockCodes || !Array.isArray(stockCodes) || !purpose) {
    return NextResponse.json({ error: "stockCodes and purpose required" }, { status: 400 });
  }

  // 过滤空值
  const codes = stockCodes.filter((c: string) => c.trim());
  if (codes.length === 0) {
    return NextResponse.json({ error: "no valid codes" }, { status: 400 });
  }

  // upsert 批量创建或更新
  await Promise.all(
    codes.map((code: string) =>
      prisma.stockConfig.upsert({
        where: { stockCode_purpose: { stockCode: code.trim(), purpose } },
        update: {},
        create: { stockCode: code.trim(), purpose, enabled: true },
      })
    )
  );

  return NextResponse.json({ success: true, count: codes.length });
}
