-- Fix user isolation: cleanup after partial migration failure

PRAGMA foreign_keys=off;

-- 1. Delete leftover old_Strategy table
DROP TABLE IF EXISTS "old_Strategy";

-- 2. Add userId to StockConfig
ALTER TABLE "StockConfig" ADD COLUMN "userId" TEXT;
DROP INDEX IF EXISTS "StockConfig_enabled_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "StockConfig_userId_stockCode_purpose_key" ON "StockConfig"("userId", "stockCode", "purpose");

-- 3. Fix Prompt.userId: nullable -> NOT NULL default 'global'
ALTER TABLE "Prompt" ADD COLUMN "userId" TEXT NOT NULL DEFAULT 'global';
UPDATE "Prompt" SET "userId" = COALESCE("userId", 'global') WHERE "userId" IS NULL;

-- 4. Add userId index to Strategy
CREATE INDEX IF NOT EXISTS "Strategy_userId_idx" ON "Strategy"("userId");

-- 5. Add MinuteCandle indexes
CREATE INDEX IF NOT EXISTS "MinuteCandle_tradeDate_idx" ON "MinuteCandle"("tradeDate");
CREATE INDEX IF NOT EXISTS "MinuteCandle_tsCode_tradeDate_idx" ON "MinuteCandle"("tsCode", "tradeDate");

-- 6. Fix StrategyRun FK - rebuild with FK pointing to Strategy (not old_Strategy)
CREATE TABLE "new_StrategyRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "strategyId" TEXT NOT NULL,
    "stockCodes" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "dataConfig" TEXT NOT NULL DEFAULT '{"kline":true}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyRun_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StrategyRun" ("id", "userId", "strategyId", "stockCodes", "startDate", "endDate", "dataConfig", "status", "startedAt", "finishedAt", "createdAt")
  SELECT "id", "userId", "strategyId", "stockCodes", "startDate", "endDate", "dataConfig", "status", "startedAt", "finishedAt", "createdAt" FROM "StrategyRun";
DROP TABLE "StrategyRun";
ALTER TABLE "new_StrategyRun" RENAME TO "StrategyRun";
CREATE INDEX IF NOT EXISTS "StrategyRun_userId_idx" ON "StrategyRun"("userId");
CREATE INDEX IF NOT EXISTS "StrategyRun_status_idx" ON "StrategyRun"("status");

PRAGMA foreign_keys=on;
