import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const GLOBAL_USER_ID = "global";

function codeToTsCode(code: string): string {
  if (code.includes(".")) return code;
  const c = code.startsWith("0") || code.startsWith("3") ? "SZ" : code.startsWith("4") || code.startsWith("8") ? "BJ" : "SH";
  return `${code}.${c}`;
}

// GET /api/config/stocks?purpose=FIFTEEN_MIN
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const currentUserId = user?.id || GLOBAL_USER_ID;
  const purpose = req.nextUrl.searchParams.get("purpose");

  if (!purpose) {
    return NextResponse.json({ error: "purpose required" }, { status: 400 });
  }

  const configs = await prisma.stockConfig.findMany({
    where: {
      purpose,
      OR: [
        { userId: GLOBAL_USER_ID },
        { userId: currentUserId },
      ]
    },
    orderBy: { createdAt: "desc" },
  });

    // Manual join with StockBasic to get stock names
    // StockConfig.stockCode corresponds to StockBasic.tsCode (e.g., "600000.SH")
    const stockCodes = configs.map((c) => c.stockCode);
    const stockBasics = await prisma.stockBasic.findMany({
      where: { tsCode: { in: stockCodes } },
    });
    const stockBasicMap = new Map(stockBasics.map((s) => [s.tsCode, s]));

    const result = configs.map((config) => ({
    ...config,
    stockBasic: stockBasicMap.get(config.stockCode) || null,
  }));

  return NextResponse.json(result);
}

// POST /api/config/stocks
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json();
  const { stockCodes, purpose } = body;

  if (!stockCodes || !Array.isArray(stockCodes) || !purpose) {
    return NextResponse.json({ error: "stockCodes and purpose required" }, { status: 400 });
  }

  const codes = stockCodes.filter((c: string) => c.trim());
  if (codes.length === 0) {
    return NextResponse.json({ error: "no valid codes" }, { status: 400 });
  }

  const userId = user.id;

  await Promise.all(
    codes.map((code: string) => {
      const tsCode = codeToTsCode(code.trim());
      return prisma.stockConfig.upsert({
        where: {
          userId_stockCode_purpose: {
            userId,
            stockCode: tsCode,
            purpose,
          }
        },
        update: {},
        create: { userId, stockCode: tsCode, purpose, enabled: true },
      });
    })
  );

  return NextResponse.json({ success: true, count: codes.length });
}
