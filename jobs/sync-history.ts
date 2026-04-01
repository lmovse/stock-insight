// jobs/sync-history.ts
// 两阶段同步：
// 阶段1：API获取数据，写入CSV文件
// 阶段2：批量读取CSV导入数据库
// Run with: npx tsx jobs/sync-history.ts

import { PrismaClient } from '@prisma/client';
import { tushareGet, parseTradeDate, withRetry } from '../lib/tushare/client.js';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// CUID generator (matches Prisma's @default(cuid()))
function cuid(): string {
  const timestamp = Math.floor(Date.now() / 1000).toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  const counter = Math.random().toString(36).substring(2, 6);
  return `c${timestamp}${random}${counter}`;
}
const CSV_DIR = path.join(process.cwd(), 'data', 'daily');

async function main() {
  // 确保目录存在
  if (!fs.existsSync(CSV_DIR)) {
    fs.mkdirSync(CSV_DIR, { recursive: true });
  }

  // 阶段1：从上次中断的股票继续抓取
  await phase1Fetch();

  // 阶段2：批量导入数据库
  await phase2Import();
}

async function phase1Fetch() {
  console.log('[sync] === 阶段1：抓取数据到CSV ===');

  const stocks = await prisma.stockBasic.findMany({
    select: { tsCode: true },
    orderBy: { tsCode: 'asc' },
  });
  console.log(`[sync] 共 ${stocks.length} 只股票`);

  // 找到已完成的CSV文件，跳过
  const doneFiles = new Set(
    fs.readdirSync(CSV_DIR)
      .filter(f => f.endsWith('.csv'))
      .map(f => f.replace('.csv', ''))
  );
  console.log(`[sync] 已完成 ${doneFiles.size} 个CSV，跳过`);

  let fetched = 0;
  let skipped = 0;

  for (let i = 0; i < stocks.length; i++) {
    const { tsCode } = stocks[i];
    const csvFile = path.join(CSV_DIR, `${tsCode}.csv`);

    if (doneFiles.has(tsCode)) {
      skipped++;
      continue;
    }

    process.stdout.write(`[${i + 1}/${stocks.length}] ${tsCode}... `);

    try {
      const items = await withRetry(() =>
        tushareGet<string>('daily', { ts_code: tsCode }, 'ts_code,trade_date,open,high,low,close,vol,amount')
      );

      if (!items || items.length === 0) {
        console.log('无数据');
        // 写一个空文件标记
        fs.writeFileSync(csvFile, 'ts_code,trade_date,open,high,low,close,vol,amount\n');
        fetched++;
        continue;
      }

      // 写入CSV
      const header = 'ts_code,trade_date,open,high,low,close,vol,amount\n';
      const rows = items.map((item) => item.join(',')).join('\n');
      fs.writeFileSync(csvFile, header + rows + '\n');
      console.log(`${items.length} 条`);
      fetched++;
    } catch (err) {
      console.error(`FAILED: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n[sync] 阶段1完成：抓取 ${fetched} 只，跳过 ${skipped} 只`);
}

async function phase2Import() {
  console.log('\n[sync] === 阶段2：批量导入数据库 ===');

  const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));
  console.log(`[sync] 待导入 ${files.length} 个CSV文件`);

  let totalImported = 0;
  let totalFailed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const tsCode = file.replace('.csv', '');
    const filePath = path.join(CSV_DIR, file);

    if (i % 100 === 0 || i === files.length - 1) {
      console.log(`[${i + 1}/${files.length}] ${tsCode}...`);
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n');

      if (lines.length <= 1) {
        console.log('空文件，跳过');
        continue;
      }

      const records: {
        id: string;
        tsCode: string;
        tradeDate: string;
        open: number;
        high: number;
        low: number;
        close: number;
        vol: number;
        amount: number | null;
      }[] = [];

      for (let j = 1; j < lines.length; j++) {
        const cols = lines[j].split(',');
        if (cols.length < 7) continue;
        records.push({
          id: cuid(),
          tsCode: cols[0],
          tradeDate: parseTradeDate(cols[1]),
          open: Number(cols[2]),
          high: Number(cols[3]),
          low: Number(cols[4]),
          close: Number(cols[5]),
          vol: Number(cols[6]),
          amount: cols[7] ? Number(cols[7]) : null,
        });
      }

      // 批量 upsert：每只股票一条 SQL，一次性写入
      if (records.length > 0) {
        const values = records.map(r =>
          `('${r.id}','${r.tsCode}','${r.tradeDate}',${r.open},${r.high},${r.low},${r.close},${r.vol},${r.amount})`
        ).join(',');
        await prisma.$executeRawUnsafe(`
          INSERT INTO DailyCandle (id, tsCode, tradeDate, open, high, low, close, vol, amount)
          VALUES ${values}
          ON CONFLICT (tsCode, tradeDate) DO UPDATE SET
            open = excluded.open,
            high = excluded.high,
            low = excluded.low,
            close = excluded.close,
            vol = excluded.vol,
            amount = excluded.amount
        `);
      }

      console.log(`${records.length} 条`);
      totalImported += records.length;
    } catch (err) {
      console.error(`FAILED: ${err instanceof Error ? err.message : err}`);
      totalFailed++;
    }
  }

  console.log(`\n[sync] 阶段2完成：导入 ${totalImported} 条，失败 ${totalFailed} 个文件`);

  // 打印数据库总记录数
  const count = await prisma.dailyCandle.count();
  console.log(`[sync] 数据库当前共 ${count} 条日线记录`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('[sync] FATAL:', err);
  prisma.$disconnect();
  process.exit(1);
});
