-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Prompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Prompt" ("content", "createdAt", "id", "name", "updatedAt", "userId") SELECT "content", "createdAt", "id", "name", "updatedAt", "userId" FROM "Prompt";
DROP TABLE "Prompt";
ALTER TABLE "new_Prompt" RENAME TO "Prompt";
CREATE INDEX "Prompt_userId_idx" ON "Prompt"("userId");
CREATE TABLE "new_Strategy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "promptId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Strategy_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "Prompt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Strategy" ("createdAt", "description", "id", "name", "promptId", "updatedAt", "userId") SELECT "createdAt", "description", "id", "name", "promptId", "updatedAt", "userId" FROM "Strategy";
DROP TABLE "Strategy";
ALTER TABLE "new_Strategy" RENAME TO "Strategy";
CREATE INDEX "Strategy_userId_idx" ON "Strategy"("userId");
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
    CONSTRAINT "StrategyRun_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "Strategy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StrategyRun" ("createdAt", "dataConfig", "endDate", "finishedAt", "id", "startDate", "startedAt", "status", "stockCodes", "strategyId", "userId") SELECT "createdAt", "dataConfig", "endDate", "finishedAt", "id", "startDate", "startedAt", "status", "stockCodes", "strategyId", "userId" FROM "StrategyRun";
DROP TABLE "StrategyRun";
ALTER TABLE "new_StrategyRun" RENAME TO "StrategyRun";
CREATE INDEX "StrategyRun_userId_idx" ON "StrategyRun"("userId");
CREATE INDEX "StrategyRun_status_idx" ON "StrategyRun"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
