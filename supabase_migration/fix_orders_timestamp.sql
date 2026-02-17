-- 修正 orders 表的 timestamp 欄位，允許 NULL
ALTER TABLE orders ALTER COLUMN timestamp DROP NOT NULL;
