import { prisma } from "@/lib/prisma";
import type { StockInfo, KLineData } from "./types";

function codeToTsCode(code: string): string {
  const c = code.startsWith("0") || code.startsWith("3") ? "SZ" : code.startsWith("4") || code.startsWith("8") ? "BJ" : "SH";
  return `${code}.${c}`;
}

function tsCodeToCode(tsCode: string): { code: string; market: "sh" | "sz" | "bj" } {
  const [symbol, suffix] = tsCode.split(".");
  const market = suffix === "SH" ? "sh" : suffix === "SZ" ? "sz" : "bj";
  return { code: symbol, market };
}

export async function searchStocks(query: string): Promise<StockInfo[]> {
  const stocks = await prisma.stockBasic.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { symbol: { contains: query } },
      ],
    },
    take: 20,
    orderBy: { name: "asc" },
  });
  return stocks.map((s) => {
    const { code, market } = tsCodeToCode(s.tsCode);
    return { code, name: s.name, market };
  });
}

export async function getKLineData(
  code: string,
  period: string = "daily",
  count: number = 300
): Promise<KLineData[]> {
  const tsCode = codeToTsCode(code);
  const candles = await prisma.dailyCandle.findMany({
    where: { tsCode },
    orderBy: { tradeDate: "asc" },
    take: count,
  });
  return candles.map((c) => ({
    date: parseInt(c.tradeDate),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.vol,
    amount: c.amount ?? undefined,
  }));
}

export async function getStockInfo(code: string): Promise<StockInfo> {
  const tsCode = codeToTsCode(code);
  const stock = await prisma.stockBasic.findUnique({ where: { tsCode } });
  if (!stock) throw new Error(`Stock ${code} not found`);
  const { market } = tsCodeToCode(stock.tsCode);
  return { code, name: stock.name, market };
}
