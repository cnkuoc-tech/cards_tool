-- ============================================
-- 修改 lottery 表結構以支援每日抽籤記錄
-- ============================================

-- 1. 先刪除不需要的欄位
-- 注意：balance 是 GENERATED COLUMN，依賴 total_fee 和 paid，所以要先刪除
ALTER TABLE lottery DROP COLUMN IF EXISTS balance CASCADE;
ALTER TABLE lottery DROP COLUMN IF EXISTS quantity;
ALTER TABLE lottery DROP COLUMN IF EXISTS total_fee;
ALTER TABLE lottery DROP COLUMN IF EXISTS paid;
ALTER TABLE lottery DROP COLUMN IF EXISTS payment_method;
ALTER TABLE lottery DROP COLUMN IF EXISTS is_notified;
ALTER TABLE lottery DROP COLUMN IF EXISTS is_cleared;
ALTER TABLE lottery DROP COLUMN IF EXISTS remark;

-- 2. 重命名 item 為 result (運勢結果)
ALTER TABLE lottery RENAME COLUMN item TO result;

-- 3. 新增 draw_date 欄位 (抽籤日期)
ALTER TABLE lottery ADD COLUMN IF NOT EXISTS draw_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 4. 修改 status 欄位預設值
ALTER TABLE lottery ALTER COLUMN status SET DEFAULT '已完成';

-- 5. 更新現有資料 (如果有的話)
UPDATE lottery 
SET draw_date = created_at 
WHERE draw_date IS NULL;

-- 6. 重建索引
DROP INDEX IF EXISTS idx_lottery_item;
DROP INDEX IF EXISTS idx_lottery_status;

CREATE INDEX idx_lottery_user_date ON lottery(user_id, draw_date DESC);
CREATE INDEX idx_lottery_result ON lottery(result);

-- 7. 更新表註釋
COMMENT ON TABLE lottery IS '每日抽籤記錄';
COMMENT ON COLUMN lottery.result IS '運勢結果 (大吉/中吉/小吉/吉/平等)';
COMMENT ON COLUMN lottery.draw_date IS '抽籤日期時間';

-- 完成！
SELECT '✅ lottery 表結構更新完成' AS message;
