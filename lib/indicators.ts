import type { KLineData } from "./types";

export function calcMA(data: KLineData[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
    return parseFloat((sum / period).toFixed(2));
  });
}

export function calcMACD(
  data: KLineData[],
  fast: number = 12,
  slow: number = 26,
  signal: number = 9
) {
  const ema = (arr: number[], period: number): number[] => {
    const k = 2 / (period + 1);
    const result: number[] = [];
    let prev = arr[0];
    for (const v of arr) {
      prev = v * k + prev * (1 - k);
      result.push(prev);
    }
    return result;
  };

  const closes = data.map((d) => d.close);
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const dif = emaFast.map((f, i) => parseFloat((f - emaSlow[i]).toFixed(4)));
  const dea = ema(dif, signal);
  const macd = dif.map((d, i) => parseFloat(((d - dea[i]) * 2).toFixed(4)));

  return { dif, dea, macd };
}

export function calcKDJ(
  data: KLineData[],
  period: number = 9,
  kPeriod: number = 3,
  dPeriod: number = 3
) {
  const rsv: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { rsv.push(50); continue; }
    const window = data.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map((d) => d.high));
    const low = Math.min(...window.map((d) => d.low));
    const close = data[i].close;
    rsv.push(high === low ? 50 : ((close - low) / (high - low)) * 100);
  }

  const k: number[] = [];
  const d: number[] = [];
  let prevK = 50, prevD = 50;
  for (const r of rsv) {
    prevK = (2 / kPeriod) * r + (1 - 2 / kPeriod) * prevK;
    prevD = (2 / dPeriod) * prevK + (1 - 2 / dPeriod) * prevD;
    k.push(parseFloat(prevK.toFixed(2)));
    d.push(parseFloat(prevD.toFixed(2)));
  }
  const j = k.map((ki, i) => parseFloat((3 * ki - 2 * d[i]).toFixed(2)));

  return { k, d, j };
}

export function calcBOLL(
  data: KLineData[],
  period: number = 20,
  multiplier: number = 2
) {
  const ma = calcMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); continue; }
    const window = data.slice(i - period + 1, i + 1);
    const mean = ma[i]!;
    const std = Math.sqrt(
      window.reduce((acc, d) => acc + Math.pow(d.close - mean, 2), 0) / period
    );
    upper.push(parseFloat((mean + multiplier * std).toFixed(2)));
    lower.push(parseFloat((mean - multiplier * std).toFixed(2)));
  }

  return { middle: ma, upper, lower };
}

export function calcRSI(data: KLineData[], period: number = 14): (number | null)[] {
  if (data.length < period + 1) return data.map(() => null);
  const result: (number | null)[] = Array(period).fill(null);
  let avgGain = 0, avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i].close - data[i - 1].close;
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  result.push(avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2)));

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push(avgLoss === 0 ? 100 : parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2)));
  }

  return result;
}
