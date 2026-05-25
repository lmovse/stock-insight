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
    orderBy: { createdAt: "desc" },
  });

  // Manual join with StockBasic to get stock names
  const stockCodes = configs.map((c) => c.stockCode);
  const stockBasics = await prisma.stockBasic.findMany({
    where: { stockCode: { in: stockCodes } },
  });
  const stockBasicMap = new Map(stockBasics.map((s) => [s.stockCode, s]));

  const result = configs.map((config) => ({
    ...config,
    stockBasic: stockBasicMap.get(config.stockCode) || null,
  }));

  return NextResponse.json(result);
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

  // upsert: create if not exists (does not update existing records)
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
