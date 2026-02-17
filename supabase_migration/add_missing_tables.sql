-- 新增缺少的 4 個資料表

-- ============================================
-- 11. Topps Now 表
-- ============================================
CREATE TABLE topps_now (
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

CREATE INDEX idx_topps_now_user ON topps_now(user_id);
CREATE INDEX idx_topps_now_player ON topps_now(player);
CREATE INDEX idx_topps_now_status ON topps_now(status);

CREATE TRIGGER update_topps_now_updated_at BEFORE UPDATE ON topps_now
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 12. 抽獎表
-- ============================================
CREATE TABLE lottery (
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

CREATE INDEX idx_lottery_user ON lottery(user_id);
CREATE INDEX idx_lottery_item ON lottery(item);
CREATE INDEX idx_lottery_status ON lottery(status);

CREATE TRIGGER update_lottery_updated_at BEFORE UPDATE ON lottery
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 13. 綠界付款記錄表
-- ============================================
CREATE TABLE ecpay_records (
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

CREATE INDEX idx_ecpay_merchant_trade_no ON ecpay_records(merchant_trade_no);
CREATE INDEX idx_ecpay_user ON ecpay_records(user_id);
CREATE INDEX idx_ecpay_trade_no ON ecpay_records(trade_no);

CREATE TRIGGER update_ecpay_records_updated_at BEFORE UPDATE ON ecpay_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 14. 訂單歷史表
-- ============================================
CREATE TABLE order_history (
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

CREATE INDEX idx_order_history_user ON order_history(user_id);
CREATE INDEX idx_order_history_action ON order_history(action);
CREATE INDEX idx_order_history_order_type ON order_history(order_type);
CREATE INDEX idx_order_history_timestamp ON order_history(timestamp DESC);

COMMENT ON TABLE topps_now IS 'Topps Now 球員卡訂單';
COMMENT ON TABLE lottery IS '抽獎訂單記錄';
COMMENT ON TABLE ecpay_records IS '綠界金流付款記錄';
COMMENT ON TABLE order_history IS '訂單操作歷史記錄';
