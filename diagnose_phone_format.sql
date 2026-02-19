-- Supabase Phone Data Diagnostic Query
-- 執行此查詢以診斷 phone 格式問題

-- 查詢所有用戶的 phone 格式和相關信息
SELECT 
  id,
  phone,
  nickname,
  length(phone) as phone_length,
  CASE 
    WHEN phone LIKE '0%' THEN 'Starts with 0'
    WHEN phone LIKE '+886%' THEN 'Starts with +886'
    WHEN phone LIKE '886%' THEN 'Starts with 886'
    ELSE 'Other format'
  END as phone_format
FROM users
ORDER BY phone
LIMIT 20;

-- 查詢電話號碼 0975313096 是否存在
SELECT * FROM users WHERE phone = '0975313096';

-- 查詢類似的電話號碼（可能格式不同）
SELECT * FROM users 
WHERE phone LIKE '%975313096%' 
   OR phone LIKE '%0975313096%'
ORDER BY phone;

-- 統計各種 phone 格式
SELECT 
  CASE 
    WHEN phone LIKE '0%' THEN 'Starts with 0'
    WHEN phone LIKE '+886%' THEN 'Starts with +886'
    WHEN phone LIKE '886%' THEN 'Starts with 886'
    ELSE 'Other format'
  END as format,
  COUNT(*) as count
FROM users
GROUP BY format;
