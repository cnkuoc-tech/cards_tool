-- 將 orders 表中 box_order 欄位的大寫 TRUE 統一改為小寫 true
-- 這樣可以確保數據格式一致性

-- 查看當前 box_order 的值分佈
SELECT 
  box_order,
  COUNT(*) as count
FROM orders
GROUP BY box_order
ORDER BY count DESC;

-- 更新：將所有大寫 TRUE 改為小寫 true
UPDATE orders
SET box_order = 'true'
WHERE box_order = 'TRUE';

-- 同時處理其他可能的變體（如果有的話）
UPDATE orders
SET box_order = 'true'
WHERE UPPER(CAST(box_order AS TEXT)) = 'TRUE' 
  AND box_order != 'true';

-- 將 false 相關的值也統一
UPDATE orders
SET box_order = 'false'
WHERE UPPER(CAST(box_order AS TEXT)) = 'FALSE' 
  AND box_order != 'false';

-- 驗證更新結果
SELECT 
  box_order,
  COUNT(*) as count
FROM orders
GROUP BY box_order
ORDER BY count DESC;
