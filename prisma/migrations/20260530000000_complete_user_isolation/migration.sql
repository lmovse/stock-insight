-- Complete user isolation setup (handles remaining changes after partial migration)

PRAGMA foreign_keys=off;

-- Strategy: change userId to NOT NULL default 'global'
ALTER TABLE "Strategy" RENAME TO "old_Strategy";
CREATE TABLE "Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'global',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteria" TEXT,
    "promptId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Strategy_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "Strategy" ("id", "userId", "name", "description", "criteria", "promptId", "createdAt", "updatedAt")
  SELECT "id", COALESCE("userId", 'global'), "name", "description", "criteria", "promptId", "createdAt", "updatedAt" FROM "old_Strategy";
DROP TABLE "old_Strategy";
CREATE INDEX IF NOT EXISTS "Strategy_userId_idx" ON "Strategy"("userId");

-- Prompt: change userId to NOT NULL default 'global'
ALTER TABLE "Prompt" RENAME TO "old_Prompt";
CREATE TABLE "Prompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'global',
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "Prompt" ("id", "userId", "name", "content", "createdAt", "updatedAt")
  SELECT "id", COALESCE("userId", 'global'), "name", "content", "createdAt", "updatedAt" FROM "old_Prompt";
DROP TABLE "old_Prompt";
CREATE INDEX IF NOT EXISTS "Prompt_userId_idx" ON "Prompt"("userId");

-- Create ScriptStrategy table
CREATE TABLE IF NOT EXISTS "ScriptStrategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'global',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scriptPath" TEXT NOT NULL,
    "params" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS "ScriptStrategy_userId_idx" ON "ScriptStrategy"("userId");

-- Create ScriptRun table
CREATE TABLE IF NOT EXISTS "ScriptRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scriptStrategyId" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "result" TEXT,
    "analysis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    CONSTRAINT "ScriptRun_scriptStrategyId_fkey" FOREIGN KEY ("scriptStrategyId") REFERENCES "ScriptStrategy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ScriptRun_scriptStrategyId_idx" ON "ScriptRun"("scriptStrategyId");
CREATE INDEX IF NOT EXISTS "ScriptRun_status_idx" ON "ScriptRun"("status");

-- Add userId to StockConfig
ALTER TABLE "StockConfig" ADD COLUMN "userId" TEXT;
DROP INDEX IF EXISTS "StockConfig_enabled_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "StockConfig_userId_stockCode_purpose_key" ON "StockConfig"("userId", "stockCode", "purpose");

PRAGMA foreign_keys=on;
