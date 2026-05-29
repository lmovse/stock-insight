-- Cleanup migration: remove redundant StockConfig_enabled_idx

DROP INDEX IF EXISTS "StockConfig_enabled_idx";
