import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function codeToTsCode(code: string): string {
  const c = code.startsWith("0") || code.startsWith("3") ? "SZ" : code.startsWith("4") || code.startsWith("8") ? "BJ" : "SH";
  return `${code}.${c}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const items = await prisma.watchlistItem.findMany({
    where: { userId: user.id },
    include: { group: true },
    orderBy: { addedAt: "desc" },
  });

  // Get stock info and latest candle for each item
  const result = await Promise.all(
    items.map(async (item) => {
      const tsCode = codeToTsCode(item.stockCode);
      const stock = await prisma.stockBasic.findUnique({ where: { tsCode } });
      const latestCandle = await prisma.dailyCandle.findFirst({
        where: { tsCode },
        orderBy: { tradeDate: "desc" },
      });

      return {
        id: item.id,
        stockCode: item.stockCode,
        stockName: stock?.name || "未知",
        groupId: item.groupId,
        groupName: item.group?.name,
        addedAt: item.addedAt,
        latestCandle: latestCandle
          ? {
              tradeDate: latestCandle.tradeDate,
              open: latestCandle.open,
              high: latestCandle.high,
              low: latestCandle.low,
              close: latestCandle.close,
              vol: latestCandle.vol,
            }
          : null,
      };
    })
  );

  return NextResponse.json(result);
}
