import cron, { ScheduledTask } from 'node-cron';
import { runFullSync, syncMinuteCandles } from './sync';

interface TaskConfig {
  name: string;
  cron: string;
  fn: () => Promise<void>;
}

const TASKS: TaskConfig[] = [
  // 交易日 16:00 触发全面同步（股票基础+日线+指数基础+分钟线），逻辑同 sync API type=all
  {
    name: 'sync_full_at_market_open',
    cron: '0 16 * * 1-5',
    fn: async () => {
      await runFullSync();
      await syncMinuteCandles();
    },
  },
];

let scheduledTasks: ScheduledTask[] = [];
let started = false;

export function startScheduler() {
  if (started) return;
  started = true;

  for (const task of TASKS) {
    const scheduled = cron.schedule(
      task.cron,
      async () => {
        console.log(`[scheduler] starting ${task.name}`);
        try {
          await task.fn();
          console.log(`[scheduler] ${task.name} completed`);
        } catch (err) {
          console.error(`[scheduler] ${task.name} error:`, err);
        }
      },
      { timezone: 'Asia/Shanghai' },
    );
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
  started = false;
  console.log('[scheduler] stopped all tasks');
}

// 自动启动：Next.js 运行时中，首次 import 时自动启动
startScheduler();
