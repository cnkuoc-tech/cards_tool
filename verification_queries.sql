/**
 * 全面資料驗證腳本
 * 
 * 使用方法：
 * 1. 在 Cloudflare Workers 中新增一個臨時 endpoint
 * 2. 或者直接從 Supabase Dashboard SQL Editor 執行查詢
 */

-- ============================================================
-- 1. 檢查所有資料表的筆數
-- ============================================================

SELECT 
  'users' as table_name, 
  COUNT(*) as count 
FROM users
UNION ALL
SELECT 
  'product_catalog' as table_name, 
  COUNT(*) as count 
FROM product_catalog
UNION ALL
SELECT 
  'order_entries' as table_name, 
  COUNT(*) as count 
FROM order_entries
UNION ALL
SELECT 
  'break_records' as table_name, 
  COUNT(*) as count 
FROM break_records
UNION ALL
SELECT 
  'payment_notifications' as table_name, 
  COUNT(*) as count 
FROM payment_notifications
UNION ALL
SELECT 
  'psa_orders' as table_name, 
  COUNT(*) as count 
FROM psa_orders
UNION ALL
SELECT 
  'break_credits' as table_name, 
  COUNT(*) as count 
FROM break_credits
UNION ALL
SELECT 
  'daily_fortunes' as table_name, 
  COUNT(*) as count 
FROM daily_fortunes;

-- ============================================================
-- 2. 檢查 users 資料表結構和範例資料
-- ============================================================

SELECT 
  phone, 
  nickname, 
  birthday, 
  email, 
  address,
  created_at
FROM users 
LIMIT 3;

-- ============================================================
-- 3. 檢查 product_catalog 資料表結構和範例資料
-- ============================================================

SELECT 
  item_name, 
  card_no, 
  price,
  category,
  is_box_preorder,
  can_draw_sp,
  total_quantity,
  current_quantity,
  (total_quantity - current_quantity) as accumulated
FROM product_catalog 
WHERE is_box_preorder = 'true'
LIMIT 5;

-- ============================================================
-- 4. 檢查 order_entries 資料表結構
-- ============================================================

-- 先查看第一筆訂單的所有欄位
SELECT * FROM order_entries LIMIT 1;

-- 檢查是否有 user_id 欄位
SELECT 
  phone,
  nickname,
  item_name,
  card_no,
  quantity,
  total_fee,
  is_cleared,
  is_shipped,
  order_date,
  user_id  -- 看看這個欄位是否存在
FROM order_entries 
LIMIT 3;

-- ============================================================
-- 5. 檢查特定用戶的訂單
-- ============================================================

SELECT 
  phone,
  nickname,
  item_name,
  card_no,
  quantity,
  total_fee,
  is_cleared,
  is_shipped,
  order_date
FROM order_entries 
WHERE phone = '0975313096'
ORDER BY order_date DESC
LIMIT 10;

-- ============================================================
-- 6. 檢查資料類型問題
-- ============================================================

-- 檢查 boolean 欄位的實際值
SELECT DISTINCT
  is_box_preorder,
  pg_typeof(is_box_preorder) as type
FROM product_catalog;

SELECT DISTINCT
  is_cleared,
  pg_typeof(is_cleared) as type
FROM order_entries;

-- ============================================================
-- 7. 檢查空值狀況
-- ============================================================

SELECT 
  COUNT(*) as total,
  COUNT(user_id) as has_user_id,
  COUNT(*) - COUNT(user_id) as null_user_id
FROM order_entries;

SELECT 
  COUNT(*) as total,
  COUNT(close_time) as has_close_time,
  COUNT(*) - COUNT(close_time) as null_close_time
FROM product_catalog;
