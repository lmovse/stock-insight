// jobs/sync-history.ts
// 前台运行：按 tsCode 排序，逐只股票同步全部历史日线
// Run with: npx tsx jobs/sync-history.ts

import { PrismaClient } from '@prisma/client';
import { tushareGet, rowsToObjects, parseTradeDate, withRetry } from '../lib/tushare/client.js';
import type { DailyItem } from '../lib/tushare/types.js';

const prisma = new PrismaClient();

async function main() {
  console.log('[sync] === starting full history sync ===');
  const jobName = 'sync_all_stock_history';

  const stocks = await prisma.stockBasic.findMany({
    select: { tsCode: true },
    orderBy: { tsCode: 'asc' },
  });
  console.log(`[sync] ${stocks.length} stocks to sync`);

  let totalInserted = 0;
  let totalSkipped = 0;
  let failed: string[] = [];

  for (let i = 0; i < stocks.length; i++) {
    const { tsCode } = stocks[i];
    const progress = `[${i + 1}/${stocks.length}]`;

    try {
      const items = await withRetry(() =>
        tushareGet<DailyItem>('daily', { ts_code: tsCode }, 'ts_code,trade_date,open,high,low,close,vol,amount')
      );

      if (!items || items.length === 0) {
        console.log(`${progress} ${tsCode}: no data`);
        totalSkipped++;
        continue;
      }

      const records = rowsToObjects(
        ['ts_code','trade_date','open','high','low','close','vol','amount'],
        items as unknown as string[][]
      ) as { ts_code: string; trade_date: string; open: string; high: string; low: string; close: string; vol: string; amount: string }[];

      let inserted = 0;
      for (const r of records) {
        await prisma.dailyCandle.upsert({
          where: { tsCode_tradeDate: { tsCode: r.ts_code, tradeDate: parseTradeDate(r.trade_date) } },
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
        inserted++;
      }

      totalInserted += inserted;
      console.log(`${progress} ${tsCode}: ${records.length} records (total: ${totalInserted})`);
    } catch (err) {
      failed.push(tsCode);
      console.error(`${progress} ${tsCode}: FAILED -`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n[sync] === done ===');
  console.log(`[sync] total inserted/updated: ${totalInserted}`);
  console.log(`[sync] skipped (no data): ${totalSkipped}`);
  console.log(`[sync] failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log(`[sync] failed stocks: ${failed.join(', ')}`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('[sync] FATAL:', err);
  prisma.$disconnect();
  process.exit(1);
});
