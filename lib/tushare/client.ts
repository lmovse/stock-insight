// lib/tushare/client.ts
import axios from 'axios';
import type { TushareResponse } from './types';

const BASE_URL = 'https://api.tushare.pro';
const REQUEST_INTERVAL = 1200; // ms between requests (50/min limit)

let lastRequestTime = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < REQUEST_INTERVAL) {
    await sleep(REQUEST_INTERVAL - elapsed);
  }
  lastRequestTime = Date.now();
}

export function parseTradeDate(s: string): string {
  // tushare returns "20260331", tradeDate in DB is stored as yyyymmdd string
  return s; // passthrough
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 30000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      if (i === retries - 1) throw err;
      const isRateLimit = err instanceof TushareError && (err.code === 429 || err.code === 40203);
      const waitMs = isRateLimit ? 60000 : delayMs;
      console.warn(`[sync] Attempt ${i + 1} failed, retrying in ${waitMs}ms...`, err instanceof Error ? err.message : err);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  throw new Error('unreachable');
}

export class TushareError extends Error {
  constructor(
    message: string,
    public code: number,
    public requestParams?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TushareError';
  }
}

export async function tushareGet<T>(
  apiName: string,
  params: Record<string, string | number | undefined>,
  fields: string
): Promise<T[][]> {
  const token = process.env.TUSHARE_TOKEN;
  if (!token) throw new Error('TUSHARE_TOKEN not set in environment');

  await throttle();

  try {
    const response = await axios.post<TushareResponse<T>>(BASE_URL, {
      api_name: apiName,
      token,
      params: Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined)
      ),
      fields,
    });

    const { code, msg, data } = response.data;

    if (code !== 0) {
      throw new TushareError(msg, code, params);
    }

    return data.items;
  } catch (err: unknown) {
    if (err instanceof TushareError) throw err;
    const message = err instanceof Error ? err.message : 'Unknown error';
    throw new TushareError(message, -1, params);
  }
}

// Helper: convert field array + items array to objects
// items is string[][] from the tushare API response
// fields maps index to field name; items may have fewer columns than requested
export function rowsToObjects<T extends Record<string, string | number>>(
  fields: string[],
  items: string[][]
): T[] {
  if (!items || items.length === 0) return [];
  return items
    .filter(item => item != null && Array.isArray(item))
    .map(item =>
      Object.fromEntries(fields.map((f, i) => [f, item[i] ?? null]))
    ) as T[];
}
