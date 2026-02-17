-- 修正缺失的欄位

-- 1. orders 表新增 notes 欄位
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. payments 表新增 rtn_msg 欄位
ALTER TABLE payments 
  ADD COLUMN IF NOT EXISTS rtn_msg TEXT;

-- 3. break_credits 表修改 used_break_ids 為 TEXT
ALTER TABLE break_credits 
  ALTER COLUMN used_break_ids TYPE TEXT;
