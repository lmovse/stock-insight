-- CreateTable
CREATE TABLE "StockConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockCode" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "StockConfig_stockCode_purpose_key" ON "StockConfig"("stockCode", "purpose");

-- CreateIndex
CREATE INDEX "StockConfig_enabled_idx" ON "StockConfig"("enabled");
