-- 更新 payments 表，新增綠界付款記錄欄位
-- 執行時間: 2026-01-27

-- 新增付款單號
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_no VARCHAR(100);

-- 新增訂單編號
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS order_no VARCHAR(100);

-- 新增商品名稱
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS product_name TEXT;

-- 新增回傳訊息
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS return_message TEXT;

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_payments_payment_no ON payments(payment_no);
CREATE INDEX IF NOT EXISTS idx_payments_order_no ON payments(order_no);

-- 註解說明
COMMENT ON COLUMN payments.payment_no IS '付款單號';
COMMENT ON COLUMN payments.order_no IS '訂單編號';
COMMENT ON COLUMN payments.product_name IS '商品名稱';
COMMENT ON COLUMN payments.return_message IS '綠界回傳訊息';
