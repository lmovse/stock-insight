export interface StockInfo {
  code: string;       // "600519"
  name: string;       // "贵州茅台"
  market: "sh" | "sz" | "bj";
}

export interface KLineData {
  date: number;       // yyyymmdd format (e.g., 20260331)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount?: number;
}

export interface IndicatorConfig {
  ma: boolean;
  maPeriods: number[];
  macd: boolean;
  kdj: boolean;
  boll: boolean;
  rsi: boolean;
  rsiPeriod: number;
}
