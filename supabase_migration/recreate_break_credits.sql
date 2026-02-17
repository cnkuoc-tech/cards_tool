-- 重新建立 break_credits 表
CREATE TABLE break_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  source VARCHAR(100),
  is_used BOOLEAN DEFAULT FALSE,
  used_break_ids TEXT[],
  used_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX idx_credits_user ON break_credits(user_id);
CREATE INDEX idx_credits_is_used ON break_credits(is_used);

-- 建立更新觸發器
CREATE TRIGGER update_credits_updated_at BEFORE UPDATE ON break_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 停用 RLS
ALTER TABLE break_credits DISABLE ROW LEVEL SECURITY;
