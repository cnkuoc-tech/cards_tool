-- ===== 移除重複數據的 SQL 查詢集合 =====
-- 請在 Supabase SQL Editor 中執行這些查詢

-- 🔍 1. 檢查各表中可能的重複項
-- ===== 訂單表 (orders) 重複檢查 =====
SELECT 
  id, phone, item, card_no, quantity, COUNT(*) as cnt
FROM orders
GROUP BY phone, item, card_no, quantity
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ===== 團拆表 (breaks) 重複檢查 =====
SELECT 
  break_id, user_id, COUNT(*) as cnt
FROM breaks
GROUP BY break_id, user_id
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ===== 卡片詳細表 (card_details) 重複檢查 =====
SELECT 
  user_id, card_number, COUNT(*) as cnt
FROM card_details
GROUP BY user_id, card_number
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ===== 用戶表 (users) 重複檢查 =====
SELECT 
  phone, COUNT(*) as cnt
FROM users
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ===== ECPay 記錄表 (ecpay_records) 重複檢查 =====
SELECT 
  merchant_trade_no, COUNT(*) as cnt
FROM ecpay_records
GROUP BY merchant_trade_no
HAVING COUNT(*) > 1
ORDER BY cnt DESC;

-- ================================
-- 🗑️ 2. 移除重複的訂單（保留最早的記錄）
-- ================================
DELETE FROM orders
WHERE id NOT IN (
  SELECT MIN(id)
  FROM orders
  GROUP BY phone, item, card_no, quantity
);

-- ================================
-- 🗑️ 3. 移除重複的團拆（保留最早創建的記錄）
-- ================================
DELETE FROM breaks
WHERE id NOT IN (
  SELECT MIN(id)
  FROM breaks
  GROUP BY break_id, user_id
);

-- ================================
-- 🗑️ 4. 移除重複的卡片詳細（保留最早的記錄）
-- ================================
DELETE FROM card_details
WHERE id NOT IN (
  SELECT MIN(id)
  FROM card_details
  GROUP BY user_id, card_number
);

-- ================================
-- 🗑️ 5. 移除重複的用戶（保留最早註冊的記錄）
-- ================================
DELETE FROM users
WHERE id NOT IN (
  SELECT MIN(id)
  FROM users
  GROUP BY phone
);

-- ================================
-- 🗑️ 6. 移除重複的 ECPay 記錄（保留最早的記錄）
-- ================================
DELETE FROM ecpay_records
WHERE id NOT IN (
  SELECT MIN(id)
  FROM ecpay_records
  GROUP BY merchant_trade_no
);

-- ================================
-- ✅ 驗證：檢查移除後是否還有重複
-- ================================
-- 執行完 DELETE 查詢後，再次執行上面的 SELECT 檢查查詢，應該都不會有結果

-- ================================
-- 📊 備用方案：僅查看重複但不刪除
-- ================================
-- 如果想先預覽會刪除哪些記錄，可以使用這個查詢（用 CTE 方式）：

WITH duplicate_orders AS (
  SELECT id, phone, item, card_no, 
         ROW_NUMBER() OVER (PARTITION BY phone, item, card_no ORDER BY id) as rn
  FROM orders
)
SELECT * FROM duplicate_orders WHERE rn > 1;

-- ================================
-- 🔧 高級：移除完全相同的行
-- ================================
-- 如果整行都完全相同，可以用以下查詢找出（某些表可能需要調整）：

-- 訂單表：完全相同的行
SELECT * FROM (
  SELECT *, 
         COUNT(*) OVER (PARTITION BY phone, item, card_no, quantity, total_fee, 
                        arrival_status, is_shipped, status, balance_amount) as cnt
  FROM orders
) t
WHERE cnt > 1
ORDER BY phone, item;

-- 移除完全相同的訂單行（保留ID最小的）
DELETE FROM orders
WHERE (phone, item, card_no, quantity, total_fee, arrival_status, is_shipped, status, balance_amount) IN (
  SELECT phone, item, card_no, quantity, total_fee, arrival_status, is_shipped, status, balance_amount
  FROM orders
  GROUP BY phone, item, card_no, quantity, total_fee, arrival_status, is_shipped, status, balance_amount
  HAVING COUNT(*) > 1
)
AND id NOT IN (
  SELECT MIN(id)
  FROM orders
  GROUP BY phone, item, card_no, quantity, total_fee, arrival_status, is_shipped, status, balance_amount
);

-- ================================
-- 📌 重要提示
-- ================================
-- 1. 執行 DELETE 前，建議先執行對應的 SELECT 查詢確認要刪除的記錄
-- 2. 如果需要保留記錄用於審計，建議先備份表：
--    CREATE TABLE orders_backup AS SELECT * FROM orders;
-- 3. 某些情況下，可能需要調整 GROUP BY 欄位以符合您的業務邏輯
-- 4. 如果有 CASCADE DELETE 的外鍵關係，可能需要謹慎執行，以免誤刪相關數據
