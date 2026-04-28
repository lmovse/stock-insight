// jobs/backfill-pinyin.ts
// Run with: npx tsx jobs/backfill-pinyin.ts
import { PrismaClient } from '@prisma/client';
import { toPinyin } from '../lib/pinyin';

const prisma = new PrismaClient();

async function main() {
  const stocks = await prisma.stockBasic.findMany();
  console.log(`[backfill] 共 ${stocks.length} 只股票`);

  let updated = 0;
  for (const s of stocks) {
    const py = toPinyin(s.name);
    if (py && s.pinyin !== py) {
      await prisma.stockBasic.update({
        where: { tsCode: s.tsCode },
        data: { pinyin: py },
      });
      updated++;
      process.stdout.write(`\r[backfill] 更新了 ${updated} 只`);
    }
  }

  console.log(`\n[backfill] 完成，更新了 ${updated} 只股票的拼音`);
  await prisma.$disconnect();
}

main();
