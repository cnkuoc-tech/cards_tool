-- ===== 快速移除重複的 SQL（Ning-024 團拆） =====
-- 這個腳本會移除重複的團拆記錄，但只保留最早創建的那一筆

-- 🔍 第1步：查看 Ning-024 有多少重複
SELECT break_id, user_id, COUNT(*) as cnt, MIN(created_at) as earliest
FROM breaks
WHERE break_id = 'Ning-024'
GROUP BY break_id, user_id;

-- 🗑️ 第2步：移除 Ning-024 的重複（保留最早的）
DELETE FROM breaks
WHERE break_id = 'Ning-024'
AND id NOT IN (
  SELECT DISTINCT ON (break_id, user_id) id
  FROM breaks
  WHERE break_id = 'Ning-024'
  ORDER BY break_id, user_id, created_at ASC, id ASC
);

-- ✅ 第3步：驗證已移除重複
SELECT break_id, user_id, COUNT(*) as cnt
FROM breaks
WHERE break_id = 'Ning-024'
GROUP BY break_id, user_id;

-- 可選：一次性清理所有重複的團拆
-- DELETE FROM breaks
-- WHERE id NOT IN (
--   SELECT DISTINCT ON (break_id, user_id) id
--   FROM breaks
--   ORDER BY break_id, user_id, created_at ASC, id ASC
-- );
