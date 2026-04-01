-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StockBasic" (
    "tsCode" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pinyin" TEXT NOT NULL DEFAULT '',
    "area" TEXT,
    "industry" TEXT,
    "market" TEXT NOT NULL,
    "listDate" TEXT,
    "delistDate" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StockBasic" ("area", "delistDate", "industry", "listDate", "market", "name", "symbol", "tsCode", "updatedAt") SELECT "area", "delistDate", "industry", "listDate", "market", "name", "symbol", "tsCode", "updatedAt" FROM "StockBasic";
DROP TABLE "StockBasic";
ALTER TABLE "new_StockBasic" RENAME TO "StockBasic";
CREATE INDEX "StockBasic_symbol_idx" ON "StockBasic"("symbol");
CREATE INDEX "StockBasic_market_idx" ON "StockBasic"("market");
CREATE INDEX "StockBasic_pinyin_idx" ON "StockBasic"("pinyin");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
