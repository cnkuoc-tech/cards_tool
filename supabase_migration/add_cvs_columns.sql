-- 為 users 表新增收件用門市和711店號欄位
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS cvs_store_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS cvs_store_id VARCHAR(20);

COMMENT ON COLUMN users.cvs_store_name IS '收件用門市名稱';
COMMENT ON COLUMN users.cvs_store_id IS '711店號';

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_users_cvs_store ON users(cvs_store_id);
