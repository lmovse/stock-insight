-- CreateTable
CREATE TABLE "MinuteCandle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tsCode" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "tradeTime" TEXT NOT NULL,
    "open" REAL NOT NULL,
    "high" REAL NOT NULL,
    "low" REAL NOT NULL,
    "close" REAL NOT NULL,
    "volume" REAL NOT NULL,
    "amount" REAL,
    "adjustFlag" TEXT NOT NULL DEFAULT '3'
);

-- CreateIndex
CREATE INDEX "MinuteCandle_tsCode_idx" ON "MinuteCandle"("tsCode");

-- CreateIndex
CREATE INDEX "MinuteCandle_tradeDate_idx" ON "MinuteCandle"("tradeDate");

-- CreateIndex
CREATE INDEX "MinuteCandle_tsCode_tradeDate_idx" ON "MinuteCandle"("tsCode", "tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "MinuteCandle_tsCode_tradeTime_key" ON "MinuteCandle"("tsCode", "tradeTime");
