-- ============================================
-- Supabase Schema 更新
-- 執行此 SQL 以：
-- 1. 修改 users.birthday 欄位類型
-- 2. 新增 4 個缺少的資料表
-- ============================================

-- 1. 修改 birthday 欄位類型（支援 MMDD 格式）
ALTER TABLE users 
ALTER COLUMN birthday TYPE VARCHAR(10);

COMMENT ON COLUMN users.birthday IS '生日（MMDD 格式，用於登入驗證）';

-- 2. 新增缺少的資料表

-- ============================================
-- Topps Now 表
-- ============================================
CREATE TABLE IF NOT EXISTS topps_now (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  player VARCHAR(100),
  quantity INTEGER DEFAULT 1,
  total_fee DECIMAL(10,2) NOT NULL,
  paid DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) GENERATED ALWAYS AS (total_fee - paid) STORED,
  status VARCHAR(50) DEFAULT '已通知',
  payment_method VARCHAR(50),
  is_notified BOOLEAN DEFAULT FALSE,
  is_cleared BOOLEAN DEFAULT FALSE,
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topps_now_user ON topps_now(user_id);
CREATE INDEX IF NOT EXISTS idx_topps_now_player ON topps_now(player);
CREATE INDEX IF NOT EXISTS idx_topps_now_status ON topps_now(status);

-- ============================================
-- 抽獎表
-- ============================================
CREATE TABLE IF NOT EXISTS lottery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  item VARCHAR(200),
  quantity INTEGER DEFAULT 1,
  total_fee DECIMAL(10,2) NOT NULL,
  paid DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) GENERATED ALWAYS AS (total_fee - paid) STORED,
  status VARCHAR(50) DEFAULT '已通知',
  payment_method VARCHAR(50),
  is_notified BOOLEAN DEFAULT FALSE,
  is_cleared BOOLEAN DEFAULT FALSE,
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lottery_user ON lottery(user_id);
CREATE INDEX IF NOT EXISTS idx_lottery_item ON lottery(item);
CREATE INDEX IF NOT EXISTS idx_lottery_status ON lottery(status);

-- ============================================
-- 綠界付款記錄表
-- ============================================
CREATE TABLE IF NOT EXISTS ecpay_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_trade_no VARCHAR(100) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  trade_no VARCHAR(100),
  trade_amt DECIMAL(10,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE,
  payment_type VARCHAR(20),
  payment_type_charge_fee DECIMAL(10,2),
  charge_fee DECIMAL(10,2),
  trade_date TIMESTAMP WITH TIME ZONE,
  simulate_paid INTEGER DEFAULT 0,
  custom_field_1 VARCHAR(100),
  custom_field_2 VARCHAR(100),
  custom_field_3 VARCHAR(100),
  custom_field_4 VARCHAR(100),
  check_mac_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ecpay_merchant_trade_no ON ecpay_records(merchant_trade_no);
CREATE INDEX IF NOT EXISTS idx_ecpay_user ON ecpay_records(user_id);
CREATE INDEX IF NOT EXISTS idx_ecpay_trade_no ON ecpay_records(trade_no);

-- ============================================
-- 訂單歷史表
-- ============================================
CREATE TABLE IF NOT EXISTS order_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50),
  order_type VARCHAR(50),
  order_id VARCHAR(100),
  item VARCHAR(200),
  amount DECIMAL(10,2),
  details JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_history_user ON order_history(user_id);
CREATE INDEX IF NOT EXISTS idx_order_history_action ON order_history(action);
CREATE INDEX IF NOT EXISTS idx_order_history_order_type ON order_history(order_type);
CREATE INDEX IF NOT EXISTS idx_order_history_timestamp ON order_history(timestamp DESC);

-- 建立 Triggers（如果 update_updated_at_column 函數已存在）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE TRIGGER update_topps_now_updated_at BEFORE UPDATE ON topps_now
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    CREATE TRIGGER update_lottery_updated_at BEFORE UPDATE ON lottery
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
    CREATE TRIGGER update_ecpay_records_updated_at BEFORE UPDATE ON ecpay_records
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;

-- 註解
COMMENT ON TABLE topps_now IS 'Topps Now 球員卡訂單';
COMMENT ON TABLE lottery IS '抽獎訂單記錄';
COMMENT ON TABLE ecpay_records IS '綠界金流付款記錄';
COMMENT ON TABLE order_history IS '訂單操作歷史記錄';

-- 完成
SELECT '✅ Schema 更新完成！' AS message;
