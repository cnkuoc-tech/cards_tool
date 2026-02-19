-- ⚠️ 清空資料表準備遷移
-- 執行前請確認：這會刪除所有現有資料！
-- 
-- 執行方式：
-- 1. 登入 Supabase Dashboard
-- 2. SQL Editor
-- 3. 複製貼上此 SQL
-- 4. 執行

-- 按照相反順序刪除（避免外鍵衝突）

-- 先刪除所有依賴 user_id 的表格
DELETE FROM order_history;
DELETE FROM psa_orders;
DELETE FROM ecpay_records;
DELETE FROM lottery;
DELETE FROM notifications;
DELETE FROM break_credits;
DELETE FROM shipments;
DELETE FROM breaks;
DELETE FROM orders;

-- 再刪除獨立表格
DELETE FROM product_catalog;

-- 最後刪除用戶表
DELETE FROM users;

-- 驗證清空結果
SELECT 'users' as table_name, COUNT(*) as remaining_rows FROM users
UNION ALL
SELECT 'product_catalog', COUNT(*) FROM product_catalog
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'breaks', COUNT(*) FROM breaks
UNION ALL
SELECT 'shipments', COUNT(*) FROM shipments
UNION ALL
SELECT 'break_credits', COUNT(*) FROM break_credits
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'lottery', COUNT(*) FROM lottery
UNION ALL
SELECT 'ecpay_records', COUNT(*) FROM ecpay_records
UNION ALL
SELECT 'psa_orders', COUNT(*) FROM psa_orders
UNION ALL
SELECT 'order_history', COUNT(*) FROM order_history;

-- ✅ 預期結果：所有表格都應該顯示 0 rows
