-- Supabase 資料庫 Schema
-- 執行此 SQL 以建立所有必要的資料表

-- ============================================
-- 1. 用戶表
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  nickname VARCHAR(50),
  password VARCHAR(4),
  birthday DATE,
  email VARCHAR(100),
  address TEXT,
  real_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_nickname ON users(nickname);

-- ============================================
-- 2. 商品目錄表
-- ============================================
CREATE TABLE product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name VARCHAR(200) NOT NULL,
  card_no VARCHAR(50),
  price DECIMAL(10,2),
  threshold_price DECIMAL(10,2),
  stock_status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_catalog_item ON product_catalog(item_name);
CREATE INDEX idx_catalog_cardno ON product_catalog(card_no);

-- ============================================
-- 3. 訂單表
-- ============================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  item VARCHAR(200),
  card_no VARCHAR(50),
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

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_timestamp ON orders(timestamp DESC);

-- ============================================
-- 4. 團拆記錄表
-- ============================================
CREATE TABLE breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  break_id VARCHAR(50) NOT NULL,
  user_id UUID REFERENCES users(id),
  name VARCHAR(200),
  category VARCHAR(50) DEFAULT '棒球',
  format VARCHAR(50) DEFAULT '隨機',
  item VARCHAR(200),
  total_fee DECIMAL(10,2) NOT NULL,
  paid DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) GENERATED ALWAYS AS (total_fee - paid) STORED,
  status VARCHAR(50) DEFAULT '已通知',
  is_opened BOOLEAN DEFAULT FALSE,
  is_shipped BOOLEAN DEFAULT FALSE,
  is_cleared BOOLEAN DEFAULT FALSE,
  payment_method VARCHAR(50),
  remark TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_breaks_user ON breaks(user_id);
CREATE INDEX idx_breaks_break_id ON breaks(break_id);
CREATE INDEX idx_breaks_status ON breaks(status);
CREATE INDEX idx_breaks_category ON breaks(category);

-- ============================================
-- 5. 團拆金表
-- ============================================
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

CREATE INDEX idx_credits_user ON break_credits(user_id);
CREATE INDEX idx_credits_is_used ON break_credits(is_used);

-- ============================================
-- 6. 付款記錄表
-- ============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_trade_no VARCHAR(100) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  payment_type VARCHAR(20),
  payment_method VARCHAR(50) DEFAULT '綠界信用卡',
  status VARCHAR(50) DEFAULT 'pending',
  trade_no VARCHAR(100),
  payment_date TIMESTAMP WITH TIME ZONE,
  order_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_merchant_trade_no ON payments(merchant_trade_no);
CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================
-- 7. 出貨記錄表
-- ============================================
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  shipment_date TIMESTAMP WITH TIME ZONE,
  tracking_no VARCHAR(100),
  items JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_shipments_user ON shipments(user_id);
CREATE INDEX idx_shipments_tracking ON shipments(tracking_no);

-- ============================================
-- 8. PSA 鑑定訂單表
-- ============================================
CREATE TABLE psa_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(50) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  real_name VARCHAR(100),
  email VARCHAR(100),
  phone VARCHAR(20),
  shipping_method VARCHAR(50),
  total_cards INTEGER,
  total_amount DECIMAL(10,2),
  status VARCHAR(50) DEFAULT '已提交 (待收卡)',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_psa_orders_user ON psa_orders(user_id);
CREATE INDEX idx_psa_orders_order_id ON psa_orders(order_id);

-- ============================================
-- 9. PSA 卡片明細表
-- ============================================
CREATE TABLE psa_card_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(50) REFERENCES psa_orders(order_id),
  card_number INTEGER NOT NULL,
  year VARCHAR(10),
  player VARCHAR(100),
  is_signature BOOLEAN DEFAULT FALSE,
  is_relic BOOLEAN DEFAULT FALSE,
  grading_type VARCHAR(100),
  price DECIMAL(10,2),
  limited VARCHAR(50),
  limited_num VARCHAR(50),
  brand VARCHAR(100),
  card_no VARCHAR(50),
  status VARCHAR(50),
  front_image_url TEXT,
  back_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_psa_cards_order ON psa_card_details(order_id);

-- ============================================
-- 10. 通知記錄表
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(50),
  subject VARCHAR(200),
  content TEXT,
  status VARCHAR(50) DEFAULT 'sent',
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================
-- Functions (自動更新 updated_at)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 為所有表建立觸發器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_breaks_updated_at BEFORE UPDATE ON breaks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_credits_updated_at BEFORE UPDATE ON break_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
