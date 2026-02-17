-- 修正 payments.product_name 欄位長度
-- 從 VARCHAR(100) 增加到 VARCHAR(1000) 以容納長商品名稱

ALTER TABLE payments ALTER COLUMN product_name TYPE VARCHAR(1000);
