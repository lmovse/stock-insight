// lib/tushare/types.ts
export interface TushareResponse<T> {
  code: number;
  msg: string;
  data: {
    fields: string[];
    items: T[][];
  };
}

export interface DailyItem {
  ts_code: string;
  trade_date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  vol: number;
  amount: number;
}

export interface StockBasicItem {
  ts_code: string;
  symbol: string;
  name: string;
  area: string;
  industry: string;
  market: string;
  list_date: string;
  delist_date: string;
}

export interface IndexBasicItem {
  ts_code: string;
  name: string;
  fullname: string;
  market: string;
  count: number;
}

export interface IndexDailyItem {
  ts_code: string;
  trade_date: string;
  close: number;
  vol: number;
  amount: number;
}
