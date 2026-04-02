import cron, { ScheduledTask } from 'node-cron';
import { syncDailyCandles, syncIndexBasics, syncIndexDaily, syncMairuiStockList } from './sync.js';

interface TaskConfig {
  name: string;
  cron: string;
  fn: () => Promise<void>;
}

const TASKS: TaskConfig[] = [
  // 每天 01:00 拉取股票列表（mairui 免费无限制）
  { name: 'sync_mairui_stock_list', cron: '0 1 * * *', fn: syncMairuiStockList },
  // 交易日 16:00-23:55 每5分钟增量同步日线行情
  { name: 'sync_daily_candles', cron: '*/5 16-23 * * 1-5', fn: syncDailyCandles },
  // 每天 03:00 拉取指数基础信息
  { name: 'sync_index_basics', cron: '0 3 * * *', fn: syncIndexBasics },
  // 交易日 16:00-22:00 每10分钟一次指数日线
  { name: 'sync_index_daily', cron: '*/10 16-22 * * 1-5', fn: syncIndexDaily },
];

let scheduledTasks: ScheduledTask[] = [];

export function startScheduler() {
  if (scheduledTasks.length > 0) {
    console.warn('[scheduler] already started');
    return;
  }

  for (const task of TASKS) {
    const scheduled = cron.schedule(task.cron, async () => {
      console.log(`[scheduler] starting ${task.name}`);
      try {
        await task.fn();
        console.log(`[scheduler] ${task.name} completed`);
      } catch (err) {
        console.error(`[scheduler] ${task.name} error:`, err);
      }
    });
    scheduledTasks.push(scheduled);
    console.log(`[scheduler] registered: ${task.name} (${task.cron})`);
  }

  console.log(`[scheduler] started ${scheduledTasks.length} tasks`);
}

export function stopScheduler() {
  for (const task of scheduledTasks) {
    task.stop();
  }
  scheduledTasks = [];
  console.log('[scheduler] stopped all tasks');
}
