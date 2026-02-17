-- 更新 shipments 表，增加完整欄位以匹配 Google Sheets

-- 新增欄位
ALTER TABLE shipments 
  ADD COLUMN IF NOT EXISTS shipment_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS nickname VARCHAR(50),
  ADD COLUMN IF NOT EXISTS real_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ship_store VARCHAR(200),
  ADD COLUMN IF NOT EXISTS store_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS remark TEXT;

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_shipments_shipment_no ON shipments(shipment_no);
CREATE INDEX IF NOT EXISTS idx_shipments_phone ON shipments(phone);
CREATE INDEX IF NOT EXISTS idx_shipments_date ON shipments(shipment_date DESC);

-- 新增觸發器（如果還沒有）
DROP TRIGGER IF EXISTS update_shipments_updated_at ON shipments;
CREATE TRIGGER update_shipments_updated_at 
  BEFORE UPDATE ON shipments
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE shipments IS '出貨紀錄表';
COMMENT ON COLUMN shipments.shipment_no IS '出貨編號';
COMMENT ON COLUMN shipments.shipment_date IS '出貨日期';
COMMENT ON COLUMN shipments.nickname IS '群組暱稱';
COMMENT ON COLUMN shipments.real_name IS '真實姓名';
COMMENT ON COLUMN shipments.phone IS '電話';
COMMENT ON COLUMN shipments.ship_store IS '收件門市';
COMMENT ON COLUMN shipments.store_number IS '711店號';
COMMENT ON COLUMN shipments.items IS '商品明細（JSONB 陣列）';
COMMENT ON COLUMN shipments.tracking_no IS '物流單號';
COMMENT ON COLUMN shipments.remark IS '備註';
COMMENT ON COLUMN shipments.status IS '狀態：pending, shipped, delivered';
