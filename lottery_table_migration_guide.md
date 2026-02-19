# Lottery 表結構更新指南

## 📋 更新內容

將 `lottery` 表從通用訂單表結構改為專門的每日抽籤記錄表。

## 🔧 執行步驟

### 1. 在 Supabase 執行 SQL

前往 Supabase Dashboard → SQL Editor，執行以下檔案：

```
supabase_migration/update_lottery_table.sql
```

### 2. 表結構變更說明

**刪除的欄位：**
- `quantity` (數量)
- `total_fee` (總金額)
- `paid` (已付金額)
- `balance` (餘額)
- `payment_method` (付款方式)
- `is_notified` (是否已通知)
- `is_cleared` (是否已結清)
- `remark` (備註)

**重命名的欄位：**
- `item` → `result` (運勢結果)

**新增的欄位：**
- `draw_date` (抽籤日期時間) - TIMESTAMP WITH TIME ZONE

**保留的欄位：**
- `id` (主鍵)
- `user_id` (用戶 ID)
- `status` (狀態，預設值改為「已完成」)
- `created_at` (建立時間)
- `updated_at` (更新時間)

### 3. 新的表結構

```sql
lottery
├── id (UUID, 主鍵)
├── user_id (UUID, 外鍵 → users.id)
├── result (VARCHAR, 運勢結果：大吉/中吉/小吉/吉/平/超吉 等)
├── draw_date (TIMESTAMP, 抽籤日期時間)
├── status (VARCHAR, 狀態，預設「已完成」)
├── created_at (TIMESTAMP, 建立時間)
└── updated_at (TIMESTAMP, 更新時間)
```

### 4. 索引更新

- 刪除舊索引：`idx_lottery_item`, `idx_lottery_status`
- 新增複合索引：`idx_lottery_user_date` (user_id + draw_date DESC)
- 新增索引：`idx_lottery_result` (result)

## 📝 程式碼變更

後端程式碼 (`backend/worker.js`) 已同步更新：

### handleCheckDailyFortune
- 使用 `draw_date` 欄位查詢今日記錄
- 使用 `result` 欄位取得運勢結果
- 新增詳細的 console.log 追蹤

### handleSaveDailyFortune
- 插入記錄時使用新欄位結構：
  - `user_id`: 用戶 ID
  - `result`: 運勢結果
  - `draw_date`: 抽籤時間
  - `status`: '已完成'
- 新增錯誤檢查和詳細日誌

## ✅ 測試步驟

1. 執行 SQL 更新表結構
2. 部署更新後的 `backend/worker.js`
3. 測試抽籤功能：
   - 首次進入運勢頁面（應該可以抽）
   - 點擊抽籤（應該成功並顯示結果）
   - 重新整理頁面（應該顯示今天已抽過）
   - 檢查 Supabase `lottery` 表是否有新記錄

## 🔍 驗證查詢

在 Supabase SQL Editor 執行以下查詢檢查資料：

```sql
-- 查看最近的抽籤記錄
SELECT 
  l.id,
  u.nickname,
  u.phone,
  l.result,
  l.draw_date,
  l.status,
  l.created_at
FROM lottery l
JOIN users u ON l.user_id = u.id
ORDER BY l.draw_date DESC
LIMIT 10;

-- 查看今天的抽籤記錄
SELECT 
  l.id,
  u.nickname,
  u.phone,
  l.result,
  l.draw_date
FROM lottery l
JOIN users u ON l.user_id = u.id
WHERE l.draw_date >= CURRENT_DATE
ORDER BY l.draw_date DESC;
```

## 🐛 除錯

如果遇到問題，檢查 Cloudflare Workers 日誌：

```bash
cd /Users/kuoch/NINGSCARDGASDEMO
wrangler tail
```

應該會看到：
- `📝 saveDailyFortune - phone: xxx result: xxx`
- `✅ 找到用戶 ID: xxx`
- `💾 準備插入記錄: {...}`
- `✅ 插入結果: {...}`
