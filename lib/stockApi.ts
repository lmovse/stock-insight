import { prisma } from "@/lib/prisma";
import type { StockInfo, KLineData } from "./types";
import type { StockBasic } from "@prisma/client";

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
  // Only import pinyin when needed (search with Chinese characters)
  let queryPinyin: string | undefined;
  if (/[\u4e00-\u9fa5]/.test(query)) {
    const { toPinyin } = await import("./pinyin");
    queryPinyin = toPinyin(query);
  }
  const pinyinCondition = queryPinyin ? [{ pinyin: { contains: queryPinyin } }] : [];

  const stocks = await prisma.stockBasic.findMany({
    where: {
      OR: [
        { name: { contains: query } },
        { symbol: { contains: query } },
        ...pinyinCondition,
      ],
    },
    take: 20,
    orderBy: { name: "asc" },
  });
  return stocks.map((s: StockBasic) => {
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
  // Fetch most recent records first (desc), then reverse to get chronological order for chart
  const candles = await prisma.dailyCandle.findMany({
    where: { tsCode },
    orderBy: { tradeDate: "desc" },
    take: period === "daily" ? count : count * 7,
  });

  if (period === "daily") {
    return candles.reverse().map((c) => ({
      date: parseInt(c.tradeDate),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.vol,
      amount: c.amount ?? undefined,
    }));
  }

  // Aggregate daily into weekly or monthly
  const grouped = new Map<string, typeof candles>();

  candles.forEach((c) => {
    const y = c.tradeDate.slice(0, 4);
    const m = c.tradeDate.slice(4, 6);
    const d = parseInt(c.tradeDate.slice(6, 8));

    let key: string;
    if (period === "weekly") {
      const date = new Date(parseInt(y), parseInt(m) - 1, d);
      const day = date.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const monday = new Date(date);
      monday.setDate(d + diffToMon);
      const wy = String(monday.getFullYear());
      const wm = String(monday.getMonth() + 1).padStart(2, "0");
      const wd = String(monday.getDate()).padStart(2, "0");
      key = `${wy}${wm}${wd}`;
    } else {
      key = `${y}${m}01`;
    }

    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  });

  const result: KLineData[] = [];
  grouped.forEach((bars, key) => {
    // Sort bars chronologically (ascending by tradeDate) regardless of candle fetch order
    bars.sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
    result.push({
      date: parseInt(key),
      open: bars[0].open,
      high: Math.max(...bars.map((b) => b.high)),
      low: Math.min(...bars.map((b) => b.low)),
      close: bars[bars.length - 1].close,
      volume: bars.reduce((sum, b) => sum + b.vol, 0),
      amount: bars.reduce((sum, b) => sum + (b.amount ?? 0), 0) || undefined,
    });
  });

  // candles is desc (newest first), grouped Map iterates in insertion order (newest first)
  // so result is newest-first — reverse to chronological (oldest first) to match daily
  result.reverse();

  return result.slice(-count);
}

export async function getStockInfo(code: string): Promise<StockInfo> {
  const tsCode = codeToTsCode(code);
  const stock = await prisma.stockBasic.findUnique({ where: { tsCode } });
  if (!stock) throw new Error(`Stock ${code} not found`);
  const { market } = tsCodeToCode(stock.tsCode);
  return { code, name: stock.name, market };
}
