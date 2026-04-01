-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyCandle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tsCode" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "vol" REAL NOT NULL,
    "amount" REAL,
    "turnrate" REAL,
    "pe" REAL,
    "ps" REAL,
    "pcf" REAL,
    "marketCap" REAL,
    "floatCap" REAL
);
INSERT INTO "new_DailyCandle" ("amount", "close", "floatCap", "high", "id", "low", "marketCap", "open", "pcf", "pe", "ps", "tradeDate", "tsCode", "turnrate", "vol") SELECT "amount", "close", "floatCap", "high", "id", "low", "marketCap", "open", "pcf", "pe", "ps", "tradeDate", "tsCode", "turnrate", "vol" FROM "DailyCandle";
DROP TABLE "DailyCandle";
ALTER TABLE "new_DailyCandle" RENAME TO "DailyCandle";
CREATE INDEX "DailyCandle_tsCode_idx" ON "DailyCandle"("tsCode");
CREATE INDEX "DailyCandle_tradeDate_idx" ON "DailyCandle"("tradeDate");
CREATE UNIQUE INDEX "DailyCandle_tsCode_tradeDate_key" ON "DailyCandle"("tsCode", "tradeDate");
CREATE TABLE "new_IndexDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tsCode" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "close" REAL NOT NULL,
    "vol" REAL,
    "amount" REAL
);
INSERT INTO "new_IndexDaily" ("amount", "close", "id", "tradeDate", "tsCode", "vol") SELECT "amount", "close", "id", "tradeDate", "tsCode", "vol" FROM "IndexDaily";
DROP TABLE "IndexDaily";
ALTER TABLE "new_IndexDaily" RENAME TO "IndexDaily";
CREATE INDEX "IndexDaily_tsCode_idx" ON "IndexDaily"("tsCode");
CREATE INDEX "IndexDaily_tradeDate_idx" ON "IndexDaily"("tradeDate");
CREATE UNIQUE INDEX "IndexDaily_tsCode_tradeDate_key" ON "IndexDaily"("tsCode", "tradeDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
