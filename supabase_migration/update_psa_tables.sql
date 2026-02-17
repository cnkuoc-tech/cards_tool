-- 更新 PSA 相關表，調整欄位以匹配 Google Sheets
-- 執行時間: 2026-01-27

-- PSA 主訂單表：新增缺少的欄位
ALTER TABLE psa_orders 
ADD COLUMN IF NOT EXISTS price_per_card DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE;

-- PSA 卡片明細表：新增缺少的欄位
ALTER TABLE psa_card_details
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP WITH TIME ZONE;

-- 註解說明
COMMENT ON COLUMN psa_orders.price_per_card IS '單張價格';
COMMENT ON COLUMN psa_orders.status_updated_at IS '狀態更新時間';
COMMENT ON COLUMN psa_orders.timestamp IS '訂單建立時間戳記';
COMMENT ON COLUMN psa_card_details.timestamp IS '卡片記錄建立時間戳記';
