-- 更新 product_catalog 表結構以匹配「下單商品」工作表
DROP TABLE IF EXISTS product_catalog;

CREATE TABLE product_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name VARCHAR(200) NOT NULL,
  card_no VARCHAR(50),
  price DECIMAL(10,2),
  threshold_price DECIMAL(10,2),
  discount_threshold INTEGER,
  min_group_quantity INTEGER,
  can_draw_sp VARCHAR(10),
  can_draw_signature VARCHAR(10),
  can_draw_relic VARCHAR(10),
  can_draw_auto_relic VARCHAR(10),
  is_available VARCHAR(10),
  image_url_1 TEXT,
  image_url_2 TEXT,
  image_url_3 TEXT,
  image_url_4 TEXT,
  stock_status VARCHAR(50),
  is_box_preorder VARCHAR(10),
  can_direct_order VARCHAR(10),
  remaining_stock INTEGER DEFAULT 0,
  description TEXT,
  ordered_quantity INTEGER DEFAULT 0,
  scheduled_list_time TIMESTAMP WITH TIME ZONE,
  scheduled_delist_time TIMESTAMP WITH TIME ZONE,
  is_arrival_notified VARCHAR(10),
  category VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX idx_catalog_item ON product_catalog(item_name);
CREATE INDEX idx_catalog_cardno ON product_catalog(card_no);
CREATE INDEX idx_catalog_category ON product_catalog(category);
CREATE INDEX idx_catalog_available ON product_catalog(is_available);

-- 建立更新觸發器
CREATE TRIGGER update_catalog_updated_at BEFORE UPDATE ON product_catalog
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 停用 RLS
ALTER TABLE product_catalog DISABLE ROW LEVEL SECURITY;
