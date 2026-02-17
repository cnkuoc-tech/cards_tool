-- 將 users 表的 birthday 欄位從 DATE 改為 VARCHAR(4)
-- 因為生日是 4 碼 MMDD 格式，用作登入密碼

ALTER TABLE users 
ALTER COLUMN birthday TYPE VARCHAR(4) USING birthday::TEXT;

COMMENT ON COLUMN users.birthday IS '生日（MMDD 格式，4 碼，用於登入驗證）';
