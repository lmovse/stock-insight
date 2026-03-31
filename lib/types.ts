export interface StockInfo {
  code: string;       // "600519"
  name: string;       // "贵州茅台"
  market: string;     // "sh" | "sz" | "bj"
}

export interface KLineData {
  time: number;       // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
