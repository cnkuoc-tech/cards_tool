-- 修正剩餘問題的 SQL

-- 1. 修改 payments 表，讓 amount 可以為 NULL，增加 product_name 長度
ALTER TABLE payments 
  ALTER COLUMN amount DROP NOT NULL;

ALTER TABLE payments 
  ALTER COLUMN product_name TYPE VARCHAR(500);

-- 2. 為 order_history 表新增 phone 欄位（用於查詢用戶）
ALTER TABLE order_history 
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- 3. 建立索引加速查詢
CREATE INDEX IF NOT EXISTS idx_users_nickname_lower ON users (LOWER(nickname));
CREATE INDEX IF NOT EXISTS idx_breaks_nickname ON breaks (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_nickname ON orders (user_id);

-- 4. 清理重複的「一粒真的好香」用戶（保留較新的）
-- 先將所有引用更新到保留的用戶，然後再刪除舊的
DO $$
DECLARE
  old_user_id UUID;
  new_user_id UUID;
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicate_count
  FROM users
  WHERE nickname = '一粒真的好香';
  
  IF duplicate_count > 1 THEN
    -- 取得舊用戶 ID（要刪除的）
    SELECT id INTO old_user_id
    FROM users
    WHERE nickname = '一粒真的好香' 
      AND phone = '0961018795'
    LIMIT 1;
    
    -- 取得新用戶 ID（要保留的）
    SELECT id INTO new_user_id
    FROM users
    WHERE nickname = '一粒真的好香' 
      AND phone = '0961018796'
    LIMIT 1;
    
    IF old_user_id IS NOT NULL AND new_user_id IS NOT NULL THEN
      -- 更新所有引用到舊用戶的記錄
      UPDATE orders SET user_id = new_user_id WHERE user_id = old_user_id;
      UPDATE breaks SET user_id = new_user_id WHERE user_id = old_user_id;
      UPDATE break_credits SET user_id = new_user_id WHERE user_id = old_user_id;
      UPDATE payments SET user_id = new_user_id WHERE user_id = old_user_id;
      UPDATE shipments SET user_id = new_user_id WHERE user_id = old_user_id;
      UPDATE psa_orders SET user_id = new_user_id WHERE user_id = old_user_id;
      UPDATE lottery SET user_id = new_user_id WHERE user_id = old_user_id;
      
      -- 現在可以安全刪除舊用戶
      DELETE FROM users WHERE id = old_user_id;
      
      RAISE NOTICE '已合併重複的「一粒真的好香」用戶';
    END IF;
  END IF;
END $$;
