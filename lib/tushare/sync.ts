// lib/tushare/sync.ts
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { tushareGet, rowsToObjects, TushareError, parseTradeDate, withRetry } from './client.js';
import type { DailyItem, StockBasicItem, IndexBasicItem, IndexDailyItem } from './types.js';
import { toPinyin } from '@/lib/stockApi';

const prisma = new PrismaClient();

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function todayStr(): string {
  return formatDate(new Date());
}

async function getLastSyncDate(jobName: string): Promise<string | null> {
  const log = await prisma.syncLog.findFirst({
    where: { jobName, status: 'success' },
    orderBy: { finishedAt: 'desc' },
  });
  if (!log?.finishedAt) return null;
  return formatDate(new Date(log.finishedAt));
}

async function upsertSyncLog(
  jobName: string,
  status: string,
  total = 0,
  inserted = 0,
  updated = 0,
  errorMsg?: string
) {
  return prisma.syncLog.upsert({
    where: { jobName },
    create: {
      jobName,
      status,
      total,
      inserted,
      updated,
      errorMsg,
      finishedAt: status !== 'running' ? new Date() : undefined,
    },
    update: {
      status,
      total,
      inserted,
      updated,
      errorMsg,
      finishedAt: status !== 'running' ? new Date() : undefined,
    },
  });
}

// ─── sync_mairui_stock_list ────────────────────────────────────────────────
// mairui.club provides a free stock list API (no auth required, 1 req/sec)
// Used to populate StockBasic names when tushare stock_basic is rate-limited
const MAIRUI_TOKEN = process.env.MAIRUI_TOKEN || 'LICENCE-66D8-9F96-0C7F0FBCD073';

export async function syncMairuiStockList() {
  await upsertSyncLog('sync_mairui_stock_list', 'running');
  try {
    const response = await axios.get(
      `https://api.mairui.club/hslt/list/${MAIRUI_TOKEN}`,
      { timeout: 30000 }
    );
    const stocks: { dm: string; mc: string; jys: string }[] = response.data;
    if (!Array.isArray(stocks)) throw new Error('mairui returned non-array: ' + JSON.stringify(response.data));

    let inserted = 0;
    for (const s of stocks) {
      const [symbol, suffix] = s.dm.split('.');
      await prisma.stockBasic.upsert({
        where: { tsCode: s.dm },
        create: {
          tsCode: s.dm,
          symbol,
          name: s.mc.trim(),
          pinyin: toPinyin(s.mc.trim()),
          market: suffix,
          area: null,
          industry: null,
          listDate: null,
          delistDate: null,
        },
        update: {
          name: s.mc.trim(),
          pinyin: toPinyin(s.mc.trim()),
          market: suffix,
        },
      });
      inserted++;
    }

    await upsertSyncLog('sync_mairui_stock_list', 'success', stocks.length, inserted, 0);
    console.log(`[sync] mairui_stock_list done: ${inserted} stocks`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog('sync_mairui_stock_list', 'failed', 0, 0, 0, msg);
    console.error('[sync] mairui_stock_list failed:', err);
  }
}

// ─── sync_stock_basics ───────────────────────────────────────────────────────
export async function syncStockBasics() {
  await upsertSyncLog('sync_stock_basics', 'running');

  try {
    const items = await withRetry(() =>
      tushareGet<StockBasicItem>('stock_basic', {
        exchange: '',
        list_status: 'L',
        fields: 'ts_code,symbol,name,area,industry,market,list_date,delist_date',
      }, 'ts_code,symbol,name,area,industry,market,list_date,delist_date')
    );

    const records = rowsToObjects(
      ['ts_code','symbol','name','area','industry','market','list_date','delist_date'],
      items as unknown as string[][]
    ) as { ts_code: string; symbol: string; name: string; area: string; industry: string; market: string; list_date: string; delist_date: string }[];

    let inserted = 0;
    for (const r of records) {
      await prisma.stockBasic.upsert({
        where: { tsCode: r.ts_code },
        create: {
          tsCode: r.ts_code,
          symbol: r.symbol,
          name: r.name,
          pinyin: toPinyin(r.name),
          area: r.area || null,
          industry: r.industry || null,
          market: r.market,
          listDate: r.list_date ? parseTradeDate(r.list_date) : null,
          delistDate: r.delist_date ? parseTradeDate(r.delist_date) : null,
        },
        update: {
          symbol: r.symbol,
          name: r.name,
          pinyin: toPinyin(r.name),
          area: r.area || null,
          industry: r.industry || null,
        },
      });
      inserted++;
    }

    await upsertSyncLog('sync_stock_basics', 'success', records.length, inserted, 0);
    console.log(`[sync] stock_basics done: ${inserted} records`);
  } catch (err) {
    // Rate limit (40203): 每小时1次，跳过等待下次调度
    if (err instanceof TushareError && err.code === 40203) {
      console.warn('[sync] stock_basics rate limited (1 call/hour), skipping this run');
      await upsertSyncLog('sync_stock_basics', 'failed', 0, 0, 0, 'Rate limited: ' + err.message);
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog('sync_stock_basics', 'failed', 0, 0, 0, msg);
    console.error(`[sync] stock_basics failed:`, err);
  }
}

// ─── sync_all_stock_history ─────────────────────────────────────────────────
// 遍历所有股票，拉取每只股票的全部历史日线（无日期范围，tushare返回23年）
// 断点续传：每100只股票保存一次checkpoint到SyncLog
export async function syncAllStockHistory() {
  const jobName = 'sync_all_stock_history';
  await upsertSyncLog(jobName, 'running');

  try {
    const stocks = await prisma.stockBasic.findMany({ select: { tsCode: true } });
    console.log(`[sync] syncing full history for ${stocks.length} stocks`);

    // 读取checkpoint：找到上次中断的位置
    const checkpointLog = await prisma.syncLog.findFirst({
      where: { jobName, status: 'running' },
      orderBy: { startedAt: 'desc' },
    });
    let startIdx = 0;
    if (checkpointLog?.errorMsg) {
      const saved = parseInt(checkpointLog.errorMsg);
      if (!isNaN(saved)) {
        startIdx = saved;
        console.log(`[sync] resuming from checkpoint: stock ${startIdx}`);
      }
    }

    let totalInserted = 0;
    let failedStocks: string[] = [];

    for (let i = startIdx; i < stocks.length; i++) {
      const { tsCode } = stocks[i];
      try {
        const items = await withRetry(() =>
          tushareGet<DailyItem>('daily', {
            ts_code: tsCode,
          }, 'ts_code,trade_date,open,high,low,close,vol,amount')
        );

        const records = rowsToObjects(
          ['ts_code','trade_date','open','high','low','close','vol','amount'],
          items as unknown as string[][]
        ) as { ts_code: string; trade_date: string; open: string; high: string; low: string; close: string; vol: string; amount: string }[];

        for (const r of records) {
          await prisma.dailyCandle.upsert({
            where: {
              tsCode_tradeDate: {
                tsCode: r.ts_code,
                tradeDate: parseTradeDate(r.trade_date),
              },
            },
            create: {
              tsCode: r.ts_code,
              tradeDate: parseTradeDate(r.trade_date),
              open: Number(r.open),
              high: Number(r.high),
              low: Number(r.low),
              close: Number(r.close),
              vol: Number(r.vol),
              amount: r.amount ? Number(r.amount) : null,
            },
            update: {
              open: Number(r.open),
              high: Number(r.high),
              low: Number(r.low),
              close: Number(r.close),
              vol: Number(r.vol),
              amount: r.amount ? Number(r.amount) : null,
            },
          });
          totalInserted++;
        }
      } catch (err) {
        failedStocks.push(tsCode);
        console.warn(`[sync] failed for ${tsCode}:`, err instanceof Error ? err.message : err);
      }

      // 每100只股票保存checkpoint
      if ((i + 1) % 100 === 0 || i === stocks.length - 1) {
        console.log(`[sync] progress: ${i + 1}/${stocks.length} stocks, ${totalInserted} records written`);
        // 保存当前进度到errorMsg字段（复用）
        await upsertSyncLog(jobName, 'running', stocks.length, totalInserted, 0, String(i + 1));
      }
    }

    await upsertSyncLog(jobName, 'success', stocks.length, totalInserted, 0);
    console.log(`[sync] all_stock_history done: ${totalInserted} records, ${failedStocks.length} failed`);
    if (failedStocks.length > 0) {
      console.log('[sync] failed stocks:', failedStocks.slice(0, 10).join(', '));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog(jobName, 'failed', 0, 0, 0, msg);
    console.error('[sync] all_stock_history failed:', err);
  }
}

// ─── sync_daily_candles ──────────────────────────────────────────────────────
export async function syncDailyCandles(targetDate?: string) {
  await upsertSyncLog('sync_daily_candles', 'running');

  try {
    const date = targetDate || todayStr();
    const stocks = await prisma.stockBasic.findMany({ select: { tsCode: true } });
    console.log(`[sync] syncing daily candles: ${stocks.length} stocks in DB, date: ${date}`);

    let totalInserted = 0;

    // Always try batch call first
    try {
      const items = await withRetry(() =>
        tushareGet<DailyItem>('daily', {
          trade_date: date,
        }, 'ts_code,trade_date,open,high,low,close,vol,amount')
      );

      const records = rowsToObjects(
        ['ts_code','trade_date','open','high','low','close','vol','amount'],
        items as unknown as string[][]
      ) as { ts_code: string; trade_date: string; open: string; high: string; low: string; close: string; vol: string; amount: string }[];

      console.log(`[sync] batch daily returned ${records.length} records for ${date}`);
      for (const r of records) {
        await prisma.dailyCandle.upsert({
          where: {
            tsCode_tradeDate: {
              tsCode: r.ts_code,
              tradeDate: parseTradeDate(r.trade_date),
            },
          },
          create: {
            tsCode: r.ts_code,
            tradeDate: parseTradeDate(r.trade_date),
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            vol: Number(r.vol),
            amount: r.amount ? Number(r.amount) : null,
          },
          update: {
            open: Number(r.open),
            high: Number(r.high),
            low: Number(r.low),
            close: Number(r.close),
            vol: Number(r.vol),
            amount: r.amount ? Number(r.amount) : null,
          },
        });
        totalInserted++;
      }
      console.log(`[sync] batch insert done: ${totalInserted} records`);
    } catch (err) {
      console.warn('[sync] batch daily call failed:', err instanceof Error ? err.message : err);
    }

    await upsertSyncLog('sync_daily_candles', 'success', stocks.length, totalInserted, 0);
    console.log(`[sync] daily_candles done: ${totalInserted} records`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog('sync_daily_candles', 'failed', 0, 0, 0, msg);
    console.error(`[sync] daily_candles failed:`, err);
  }
}

// ─── sync_index_basics ───────────────────────────────────────────────────────
export async function syncIndexBasics() {
  await upsertSyncLog('sync_index_basics', 'running');

  try {
    const items = await withRetry(() =>
      tushareGet<IndexBasicItem>('index_basic', {
        market: '',
      }, 'ts_code,name,fullname,market')
    );

    const records = rowsToObjects(
      ['ts_code','name','fullname','market'],
      items as unknown as string[][]
    ) as { ts_code: string; name: string; fullname: string; market: string }[];

    let inserted = 0;
    for (const r of records) {
      await prisma.indexBasic.upsert({
        where: { tsCode: r.ts_code },
        create: {
          tsCode: r.ts_code,
          name: r.name,
          fullname: r.fullname || null,
          market: r.market,
          count: null,
        },
        update: {
          name: r.name,
          fullname: r.fullname || null,
          market: r.market,
        },
      });
      inserted++;
    }

    await upsertSyncLog('sync_index_basics', 'success', records.length, inserted, 0);
    console.log(`[sync] index_basics done: ${inserted} records`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog('sync_index_basics', 'failed', 0, 0, 0, msg);
    console.error(`[sync] index_basics failed:`, err);
  }
}

// ─── sync_index_daily ───────────────────────────────────────────────────────
export async function syncIndexDaily(date?: string) {
  await upsertSyncLog('sync_index_daily', 'running');

  try {
    const targetDate = date || (await getLastSyncDate('sync_index_daily')) || todayStr();

    const items = await withRetry(() =>
      tushareGet<IndexDailyItem>('index_daily', {
        trade_date: targetDate,
      }, 'ts_code,trade_date,close,vol,amount')
    );

    const records = rowsToObjects(
      ['ts_code','trade_date','close','vol','amount'],
      items as unknown as string[][]
    ) as { ts_code: string; trade_date: string; close: string; vol: string; amount: string }[];

    let inserted = 0;
    for (const r of records) {
      await prisma.indexDaily.upsert({
        where: {
          tsCode_tradeDate: {
            tsCode: r.ts_code,
            tradeDate: parseTradeDate(r.trade_date),
          },
        },
        create: {
          tsCode: r.ts_code,
          tradeDate: parseTradeDate(r.trade_date),
          close: Number(r.close),
          vol: r.vol ? Number(r.vol) : null,
          amount: r.amount ? Number(r.amount) : null,
        },
        update: {
          close: Number(r.close),
          vol: r.vol ? Number(r.vol) : null,
          amount: r.amount ? Number(r.amount) : null,
        },
      });
      inserted++;
    }

    await upsertSyncLog('sync_index_daily', 'success', records.length, inserted, 0);
    console.log(`[sync] index_daily done: ${inserted} records for ${targetDate}`);
  } catch (err) {
    if (err instanceof TushareError && err.code === 40203) {
      console.warn('[sync] index_daily no permission, skipping');
      await upsertSyncLog('sync_index_daily', 'failed', 0, 0, 0, 'No permission: ' + err.message);
      return;
    }
    const msg = err instanceof Error ? err.message : String(err);
    await upsertSyncLog('sync_index_daily', 'failed', 0, 0, 0, msg);
    console.error(`[sync] index_daily failed:`, err);
  }
}

// ─── runFullSync ────────────────────────────────────────────────────────────
export async function runFullSync() {
  console.log('[sync] === starting full sync ===');
  await syncStockBasics();
  await syncDailyCandles();
  await syncIndexBasics();
  await syncIndexDaily();
  console.log('[sync] === full sync complete ===');
}
