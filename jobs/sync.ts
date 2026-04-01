// jobs/sync.ts
// Standalone process entry point for the tushare sync scheduler
// Run with: npx ts-node jobs/sync.ts
// Or compile and run with: node dist/jobs/sync.js

import { startScheduler, stopScheduler } from '../lib/tushare/scheduler.js';

console.log('[sync-process] starting tushare sync scheduler...');

process.on('SIGINT', () => {
  console.log('[sync-process] received SIGINT, shutting down...');
  stopScheduler();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('[sync-process] received SIGTERM, shutting down...');
  stopScheduler();
  process.exit(0);
});

startScheduler();
