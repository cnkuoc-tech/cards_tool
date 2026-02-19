-- 在 Supabase SQL Editor 中執行此查詢來檢查 arrival_status 分佈

-- 1. 檢查前 20 筆
SELECT id, item, arrival_status 
FROM orders 
LIMIT 20;

-- 2. 統計分佈
SELECT 
  COALESCE(arrival_status, 'null') as status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM orders), 2) as percentage
FROM orders
GROUP BY arrival_status
ORDER BY count DESC;

-- 3. 如果需要修復（僅作為參考，需要根據實際情況調整）
-- 注意：這只是示例，實際執行前請確認邏輯
-- UPDATE orders SET arrival_status = 'V' WHERE arrival_status IS NULL AND is_shipped = TRUE;
