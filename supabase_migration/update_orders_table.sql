-- 更新 orders 表結構以匹配 Topps_Now_訂購總表
ALTER TABLE orders DROP COLUMN IF EXISTS balance;
ALTER TABLE orders ADD COLUMN unit_price DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN deposit DECIMAL(10,2) DEFAULT 0;
ALTER TABLE orders RENAME COLUMN paid TO balance_amount;
ALTER TABLE orders ADD COLUMN is_invoiced VARCHAR(10);
ALTER TABLE orders ADD COLUMN is_shipped VARCHAR(10);
ALTER TABLE orders ADD COLUMN arrival_status VARCHAR(50);
ALTER TABLE orders ADD COLUMN image_url TEXT;
ALTER TABLE orders ADD COLUMN box_order VARCHAR(100);
ALTER TABLE orders ADD COLUMN merchant_trade_no VARCHAR(100);
ALTER TABLE orders ADD COLUMN payment_date TIMESTAMP WITH TIME ZONE;

-- 移除舊的索引
DROP INDEX IF EXISTS idx_orders_status;

-- 新增索引
CREATE INDEX idx_orders_merchant_trade_no ON orders(merchant_trade_no);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_is_cleared ON orders(is_cleared);
