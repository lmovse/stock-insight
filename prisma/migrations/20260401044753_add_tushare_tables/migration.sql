-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WatchlistGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WatchlistGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "stockCode" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchlistItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "WatchlistGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "shares" REAL NOT NULL,
    "avgCost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "shares" REAL NOT NULL,
    "tradedAt" DATETIME NOT NULL,
    CONSTRAINT "Trade_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trade_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChartConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "indicators" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    CONSTRAINT "ChartConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DrawingLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "stockCode" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#E53935',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrawingLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockBasic" (
    "tsCode" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" TEXT,
    "industry" TEXT,
    "market" TEXT NOT NULL,
    "listDate" TEXT,
    "delistDate" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DailyCandle" (
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
    "floatCap" REAL,
    CONSTRAINT "DailyCandle_tsCode_fkey" FOREIGN KEY ("tsCode") REFERENCES "StockBasic" ("tsCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IndexBasic" (
    "tsCode" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "fullname" TEXT,
    "market" TEXT NOT NULL,
    "count" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IndexDaily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tsCode" TEXT NOT NULL,
    "tradeDate" TEXT NOT NULL,
    "close" REAL NOT NULL,
    "vol" REAL,
    "amount" REAL,
    CONSTRAINT "IndexDaily_tsCode_fkey" FOREIGN KEY ("tsCode") REFERENCES "IndexBasic" ("tsCode") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "jobName" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "errorMsg" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WatchlistGroup_userId_idx" ON "WatchlistGroup"("userId");

-- CreateIndex
CREATE INDEX "WatchlistItem_userId_idx" ON "WatchlistItem"("userId");

-- CreateIndex
CREATE INDEX "WatchlistItem_groupId_idx" ON "WatchlistItem"("groupId");

-- CreateIndex
CREATE INDEX "Position_userId_idx" ON "Position"("userId");

-- CreateIndex
CREATE INDEX "Trade_userId_idx" ON "Trade"("userId");

-- CreateIndex
CREATE INDEX "Trade_positionId_idx" ON "Trade"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartConfig_userId_key" ON "ChartConfig"("userId");

-- CreateIndex
CREATE INDEX "DrawingLine_userId_stockCode_idx" ON "DrawingLine"("userId", "stockCode");

-- CreateIndex
CREATE INDEX "StockBasic_symbol_idx" ON "StockBasic"("symbol");

-- CreateIndex
CREATE INDEX "StockBasic_market_idx" ON "StockBasic"("market");

-- CreateIndex
CREATE INDEX "DailyCandle_tsCode_idx" ON "DailyCandle"("tsCode");

-- CreateIndex
CREATE INDEX "DailyCandle_tradeDate_idx" ON "DailyCandle"("tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCandle_tsCode_tradeDate_key" ON "DailyCandle"("tsCode", "tradeDate");

-- CreateIndex
CREATE INDEX "IndexDaily_tsCode_idx" ON "IndexDaily"("tsCode");

-- CreateIndex
CREATE INDEX "IndexDaily_tradeDate_idx" ON "IndexDaily"("tradeDate");

-- CreateIndex
CREATE UNIQUE INDEX "IndexDaily_tsCode_tradeDate_key" ON "IndexDaily"("tsCode", "tradeDate");

-- CreateIndex
CREATE INDEX "SyncLog_jobName_idx" ON "SyncLog"("jobName");
