# 🚀 資料遷移執行檢查清單

## ✅ 遷移前準備

### 1. 環境確認
- [ ] 確認 `.env` 檔案存在且設定正確
- [ ] 確認 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 正確
- [ ] 執行 `npm install` 安裝相依套件

```bash
cd supabase_backend
cat .env  # 檢查環境變數
npm install  # 確保套件安裝完成
```

### 2. CSV 檔案準備

**必須的 CSV 檔案（8個核心表）：**
- [ ] `客戶資料.csv` → users 表
- [ ] `下單商品.csv` → product_catalog 表
- [ ] `Topps_Now_訂購總表.csv` → orders 表
- [ ] `團拆紀錄.csv` → breaks 表
- [ ] `出貨紀錄.csv` → shipments 表
- [ ] `團拆金.csv` → break_credits 表
- [ ] `每日抽籤紀錄.csv` → lottery 表
- [ ] `綠界付款記錄.csv` → ecpay_records 表

**可選的 CSV 檔案（3個功能表）：**
- [ ] `主訂單.csv` → psa_orders 表
- [ ] `訂單歷史紀錄.csv` → order_history 表

**檢查指令：**
```bash
cd supabase_backend
ls -lh *.csv
```

### 3. 資料庫備份（重要！）

**在遷移前務必備份現有資料：**

```bash
# 如果是測試環境，可以直接清空
# 如果是正式環境，建議先匯出備份

# 方法1: 使用 Supabase Dashboard 匯出
# 登入 https://supabase.com → 專案 → Table Editor → 右上角 Export

# 方法2: 使用 pg_dump (如果可以連線到資料庫)
# pg_dump -h xxx.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 📋 遷移執行步驟

### 步驟 1: 測試連線

```bash
cd supabase_backend
node -e "import('dotenv').then(m=>m.default.config());import('@supabase/supabase-js').then(m=>{const c=m.createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);c.from('users').select('count').single().then(r=>console.log('✅ 連線成功:',r))})"
```

### 步驟 2: 清空測試資料（如需要）

**⚠️ 警告：這會刪除所有現有資料！**

```bash
# 只在測試環境執行！
node clear_all_data.js
```

### 步驟 3: 執行完整遷移

```bash
# 完整遷移所有 11 個表格
node migrate_all_tables.js
```

### 步驟 4: 分批遷移（可選）

如果想要分批執行，可以使用環境變數控制：

```bash
# 只遷移用戶和商品
SKIP_ORDERS=1 SKIP_BREAKS=1 SKIP_SHIPMENTS=1 SKIP_CREDITS=1 SKIP_LOTTERY=1 SKIP_ECPAY=1 SKIP_PSA=1 SKIP_HISTORY=1 node migrate_all_tables.js

# 只遷移訂單和團拆
SKIP_USERS=1 SKIP_PRODUCTS=1 SKIP_SHIPMENTS=1 SKIP_CREDITS=1 SKIP_LOTTERY=1 SKIP_ECPAY=1 SKIP_PSA=1 SKIP_HISTORY=1 node migrate_all_tables.js

# 只遷移輔助資料
SKIP_USERS=1 SKIP_PRODUCTS=1 SKIP_ORDERS=1 SKIP_BREAKS=1 node migrate_all_tables.js
```

---

## 🔍 遷移後驗證

### 1. 檢查資料筆數

登入 Supabase Dashboard 檢查每個表格的筆數：

```sql
-- 用戶數
SELECT COUNT(*) as total FROM users;

-- 商品數
SELECT COUNT(*) as total FROM product_catalog;

-- 訂單數
SELECT COUNT(*) as total FROM orders;

-- 團拆數
SELECT COUNT(*) as total FROM breaks;

-- 出貨記錄數
SELECT COUNT(*) as total FROM shipments;

-- 團拆金數
SELECT COUNT(*) as total FROM break_credits;

-- 抽籤記錄數
SELECT COUNT(*) as total FROM lottery;

-- 綠界記錄數
SELECT COUNT(*) as total FROM ecpay_records;

-- PSA 訂單數
SELECT COUNT(*) as total FROM psa_orders;

-- 訂單歷史數
SELECT COUNT(*) as total FROM order_history;
```

### 2. 檢查外鍵完整性

**驗證所有 user_id 都有對應的用戶：**

```sql
-- 檢查孤立的訂單
SELECT COUNT(*) as orphaned_orders
FROM orders 
WHERE user_id NOT IN (SELECT id FROM users);

-- 檢查孤立的團拆
SELECT COUNT(*) as orphaned_breaks
FROM breaks 
WHERE user_id NOT IN (SELECT id FROM users);

-- 檢查孤立的出貨記錄
SELECT COUNT(*) as orphaned_shipments
FROM shipments 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);

-- 檢查孤立的團拆金
SELECT COUNT(*) as orphaned_credits
FROM break_credits 
WHERE user_id NOT IN (SELECT id FROM users);

-- 檢查孤立的抽籤記錄
SELECT COUNT(*) as orphaned_lottery
FROM lottery 
WHERE user_id NOT IN (SELECT id FROM users);

-- 檢查孤立的綠界記錄
SELECT COUNT(*) as orphaned_ecpay
FROM ecpay_records 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users);
```

**✅ 預期結果：所有查詢應該回傳 0**

### 3. 檢查必填欄位

```sql
-- 檢查用戶必填欄位
SELECT COUNT(*) as invalid_users
FROM users 
WHERE phone IS NULL OR phone = '' OR birthday IS NULL OR birthday = '';

-- 檢查訂單必填欄位
SELECT COUNT(*) as invalid_orders
FROM orders 
WHERE item IS NULL OR item = '' OR total_fee IS NULL;

-- 檢查團拆必填欄位
SELECT COUNT(*) as invalid_breaks
FROM breaks 
WHERE break_id IS NULL OR break_id = '' OR total_fee IS NULL;

-- 檢查商品必填欄位
SELECT COUNT(*) as invalid_products
FROM product_catalog 
WHERE item_name IS NULL OR item_name = '';
```

**✅ 預期結果：所有查詢應該回傳 0**

### 4. 抽樣檢查資料正確性

```sql
-- 隨機檢查 5 筆用戶
SELECT * FROM users ORDER BY RANDOM() LIMIT 5;

-- 隨機檢查 5 筆訂單
SELECT o.*, u.nickname, u.phone 
FROM orders o 
LEFT JOIN users u ON o.user_id = u.id 
ORDER BY RANDOM() LIMIT 5;

-- 隨機檢查 5 筆團拆
SELECT b.*, u.nickname 
FROM breaks b 
LEFT JOIN users u ON b.user_id = u.id 
ORDER BY RANDOM() LIMIT 5;

-- 檢查商品價格範圍
SELECT MIN(price) as min_price, MAX(price) as max_price, AVG(price) as avg_price
FROM product_catalog;

-- 檢查訂單金額範圍
SELECT MIN(total_fee) as min_total, MAX(total_fee) as max_total, AVG(total_fee) as avg_total
FROM orders;
```

### 5. 測試前端功能

- [ ] 登入功能正常（phone + birthday）
- [ ] 訂單列表顯示正確
- [ ] 團拆記錄顯示正確
- [ ] 商品列表顯示正確
- [ ] 出貨記錄顯示正確
- [ ] 每日抽籤功能正常
- [ ] 團拆金顯示正確

---

## ❌ 遷移失敗處理

### 常見錯誤 1: 用戶對應失敗

**症狀：**
```
準備插入 1000 筆訂單 (500 筆有 user_id)
```

**原因：** CSV 中的「訂購人」或「聯絡方式」無法對應到 users 表

**解決方法：**

1. 檢查 users 表是否有這些用戶：
```sql
SELECT * FROM users WHERE phone = '0912345678';
```

2. 確認 CSV 中的電話格式一致（去除空格、符號）

3. 如果用戶不存在，先手動新增或修正 CSV

### 常見錯誤 2: 重複主鍵

**症狀：**
```
❌ 插入訂單失敗: duplicate key value violates unique constraint
```

**原因：** 資料已存在

**解決方法：**

1. 改用 upsert 而非 insert
2. 或先清空表格再重新遷移

```bash
# 清空特定表格
node -e "import('dotenv').then(m=>m.default.config());import('@supabase/supabase-js').then(m=>{const c=m.createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);c.from('orders').delete().neq('id','00000000-0000-0000-0000-000000000000').then(r=>console.log(r))})"
```

### 常見錯誤 3: 日期格式錯誤

**症狀：**
```
❌ 插入訂單失敗: invalid input syntax for type timestamp
```

**原因：** CSV 中的日期格式無法解析

**解決方法：**

1. 檢查 CSV 中的日期格式
2. 修改 `parseDate()` 函數支援該格式

### 常見錯誤 4: 欄位類型不符

**症狀：**
```
❌ 插入商品失敗: column "price" is of type numeric but expression is of type text
```

**原因：** 數值欄位傳入了非數值字串

**解決方法：**

1. 檢查 CSV 中是否有非數值的價格（如 "N/A", "待定"）
2. 在轉換函數中加入驗證：

```javascript
price: isNaN(parseFloat(row['單價'])) ? 0 : parseFloat(row['單價'])
```

---

## 📊 預期遷移結果

根據 `DATABASE_TABLES_COMPLETE.md` 的資料表結構，預期遷移結果：

| 表格 | 預期筆數 | 重要性 |
|------|---------|--------|
| users | 50-200 | ✅ 核心 |
| product_catalog | 100-500 | ✅ 核心 |
| orders | 500-2000 | ✅ 核心 |
| breaks | 200-1000 | ✅ 核心 |
| shipments | 100-500 | ✅ 核心 |
| break_credits | 50-200 | ✅ 核心 |
| lottery | 100-500 | ✅ 核心 |
| ecpay_records | 100-500 | ✅ 核心 |
| psa_orders | 0-50 | ⚠️ 可選 |
| order_history | 500-2000 | ⚠️ 可選 |
| notifications | 0 | ⚠️ 暫無 CSV |

---

## 🎯 遷移完成後行動

- [ ] 更新 `.env` 為正式環境設定
- [ ] 部署 Cloudflare Worker
- [ ] 測試前端所有功能
- [ ] 刪除測試資料
- [ ] 備份正式環境資料
- [ ] 監控錯誤日誌

---

## 📞 需要協助？

如果遇到無法解決的問題：

1. 檢查 Supabase Dashboard 的 Logs
2. 查看瀏覽器 Console 的錯誤訊息
3. 檢查 worker.js 中的資料庫查詢語法
4. 確認所有表格的 schema 與 `DATABASE_TABLES_COMPLETE.md` 一致
