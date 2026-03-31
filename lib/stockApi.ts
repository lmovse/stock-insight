// Note: akshare is a Python library and not available on npm.
// This implementation uses mock data for demonstration.
// For production, integrate with a Chinese stock data API via
// a Python microservice or use an npm package like freeq.

import type { StockInfo, KLineData } from "./types";

// Mock stock data for demonstration
const MOCK_STOCKS: StockInfo[] = [
  { code: "600519", name: "贵州茅台", market: "sh" },
  { code: "000858", name: "五粮液", market: "sz" },
  { code: "600036", name: "招商银行", market: "sh" },
  { code: "601318", name: "中国平安", market: "sh" },
  { code: "000333", name: "美的集团", market: "sz" },
  { code: "002594", name: "比亚迪", market: "sz" },
  { code: "600276", name: "恒瑞医药", market: "sh" },
  { code: "000001", name: "平安银行", market: "sz" },
  { code: "600030", name: "中信证券", market: "sh" },
  { code: "601888", name: "中国中免", market: "sh" },
];

function generateMockKLine(basePrice: number, days: number): KLineData[] {
  const data: KLineData[] = [];
  let price = basePrice;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    const change = (Math.random() - 0.5) * price * 0.05;
    const open = price;
    price = Math.max(price + change, price * 0.9);
    const close = price;
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    const volume = Math.floor(Math.random() * 100000000) + 10000000;

    data.push({
      date,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    });
  }

  return data;
}

export async function searchStocks(query: string): Promise<StockInfo[]> {
  const q = query.toUpperCase();
  return MOCK_STOCKS
    .filter((s) => s.code.includes(q) || s.name.includes(query))
    .slice(0, 20);
}

export async function getKLineData(
  code: string,
  period: string = "daily",
  count: number = 300
): Promise<KLineData[]> {
  // Generate mock K-line data based on stock code
  const basePrice = code.endsWith("519") ? 1800 :
                     code.endsWith("858") ? 150 :
                     code.endsWith("36") ? 35 :
                     code.endsWith("318") ? 45 :
                     code.endsWith("333") ? 60 :
                     code.endsWith("594") ? 250 :
                     code.endsWith("276") ? 2800 :
                     code.endsWith("001") ? 12 :
                     code.endsWith("030") ? 22 :
                     code.endsWith("888") ? 70 : 100;

  return generateMockKLine(basePrice, count);
}

export async function getStockInfo(code: string): Promise<StockInfo> {
  const stock = MOCK_STOCKS.find((s) => s.code === code);
  if (!stock) throw new Error(`Stock ${code} not found`);
  return stock;
}
