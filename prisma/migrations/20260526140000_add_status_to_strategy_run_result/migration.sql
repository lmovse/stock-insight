-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StrategyRunResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "result" TEXT,
    "reason" TEXT,
    "rawResponse" TEXT,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StrategyRunResult_runId_fkey" FOREIGN KEY ("runId") REFERENCES "StrategyRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StrategyRunResult" ("executedAt", "id", "rawResponse", "reason", "result", "runId", "status", "stockCode") SELECT "executedAt", "id", "rawResponse", "reason", "result", "runId", 'waiting', "stockCode" FROM "StrategyRunResult";
DROP TABLE "StrategyRunResult";
ALTER TABLE "new_StrategyRunResult" RENAME TO "StrategyRunResult";
CREATE INDEX "StrategyRunResult_runId_idx" ON "StrategyRunResult"("runId");
CREATE INDEX "StrategyRunResult_status_idx" ON "StrategyRunResult"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
