-- 更新 breaks 表，新增付款相關欄位
-- 執行時間: 2026-01-26

-- 新增綠界訂單號
ALTER TABLE breaks 
ADD COLUMN IF NOT EXISTS merchant_trade_no VARCHAR(100);

-- 新增付款時間
ALTER TABLE breaks 
ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE;

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_breaks_merchant_trade_no ON breaks(merchant_trade_no);

-- 註解說明
COMMENT ON COLUMN breaks.merchant_trade_no IS '綠界訂單號';
COMMENT ON COLUMN breaks.payment_date IS '付款時間';
