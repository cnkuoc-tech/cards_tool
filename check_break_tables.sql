-- 檢查所有 breaks 相關的表

-- 1. 查詢所有包含 'break' 的表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name ILIKE '%break%'
ORDER BY table_name;

-- 2. 查詢 breaks 表的欄位
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'breaks'
ORDER BY ordinal_position;

-- 3. 查詢 break_records 表的欄位（如果存在）
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'break_records'
ORDER BY ordinal_position;

-- 4. 查詢 group_breaks 表的欄位（如果存在）
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'group_breaks'
ORDER BY ordinal_position;

-- 5. 查詢 breaks 表有多少筆資料
SELECT COUNT(*) as total_breaks FROM breaks;

-- 6. 查詢 breaks 表的樣本資料（前 3 筆）
SELECT * FROM breaks LIMIT 3;
