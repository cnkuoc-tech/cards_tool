# ✅ 遷移前最終檢查清單

**執行日期:** ___________  
**執行人:** ___________

---

## 📋 第一步：CSV 檔案確認

在 `supabase_backend/` 目錄下，確認以下 6 個 CSV 檔案存在：

- [ ] `users.csv` - 用戶資料
- [ ] `product_catalog.csv` - 商品目錄
- [ ] `orders.csv` - 訂單記錄
- [ ] `breaks.csv` - 團拆記錄
- [ ] `shipments.csv` - 出貨記錄
- [ ] `break_credits.csv` - 團拆金

**檢查指令：**
```bash
cd supabase_backend
ls -lh users.csv product_catalog.csv orders.csv breaks.csv shipments.csv break_credits.csv
```

---

## 🗑️ 第二步：清空 Supabase 資料表

**⚠️ 警告：這會刪除所有現有資料！請確認已備份！**

### 執行步驟：

1. 登入 Supabase Dashboard: https://supabase.com
2. 選擇專案
3. 點選左側 **SQL Editor**
4. 開啟檔案：`clear_tables_for_migration.sql`
5. 複製全部內容
6. 貼上到 SQL Editor
7. 點選 **Run** 執行

### 驗證結果：

執行後應該會顯示：

```
table_name          | remaining_rows
--------------------|---------------
users               | 0
product_catalog     | 0
orders              | 0
breaks              | 0
shipments           | 0
break_credits       | 0
notifications       | 0
lottery             | 0
ecpay_records       | 0
psa_orders          | 0
order_history       | 0
```

- [ ] ✅ 所有表格都顯示 0 rows

---

## 🔍 第三步：環境變數確認

檢查 `.env` 檔案設定：

```bash
cd supabase_backend
cat .env
```

確認以下設定正確：

- [ ] `SUPABASE_URL` 已設定（https://xxx.supabase.co）
- [ ] `SUPABASE_ANON_KEY` 已設定

**測試連線：**
```bash
node -e "import('dotenv').then(m=>m.default.config());console.log('URL:', process.env.SUPABASE_URL);console.log('KEY:', process.env.SUPABASE_ANON_KEY ? '✅ 已設定' : '❌ 未設定')"
```

---

## 🧪 第四步：腳本語法檢查

```bash
cd supabase_backend
node -c migrate_core_tables.js
```

- [ ] ✅ 顯示無語法錯誤

---

## 🚀 第五步：執行遷移

**現在可以開始遷移了！**

```bash
cd supabase_backend
node migrate_core_tables.js
```

### 預期輸出：

```
╔══════════════════════════════════════════════════════════╗
║        📦 核心資料遷移腳本 - 6 個核心表               ║
╚══════════════════════════════════════════════════════════╝

🔗 連線到 Supabase: https://xxx.supabase.co

📂 檢查 CSV 檔案...

  ✅ users.csv
  ✅ product_catalog.csv
  ✅ orders.csv
  ✅ breaks.csv
  ✅ shipments.csv
  ✅ break_credits.csv

📖 讀取 CSV 檔案...

✅ 讀取 users.csv: XXX 筆
✅ 讀取 product_catalog.csv: XXX 筆
✅ 讀取 orders.csv: XXX 筆
✅ 讀取 breaks.csv: XXX 筆
✅ 讀取 shipments.csv: XXX 筆
✅ 讀取 break_credits.csv: XXX 筆

========================================
開始遷移資料...
========================================

📌 [1/6] 遷移用戶資料...
...
✅ 已插入 XXX/XXX 筆用戶

📌 [2/6] 遷移商品資料...
...
✅ 已插入 XXX/XXX 筆商品

...

╔══════════════════════════════════════════════════════════╗
║                  ✅ 遷移完成統計                       ║
╚══════════════════════════════════════════════════════════╝

📊 [1] 用戶資料:       XXX 筆
📦 [2] 商品資料:       XXX 筆
📋 [3] 訂單資料:       XXX 筆
🎯 [4] 團拆記錄:       XXX 筆
📮 [5] 出貨記錄:       XXX 筆
💰 [6] 團拆金:         XXX 筆

💡 用戶對應表:      XXX 個 phone/nickname/real_name → user_id

╔══════════════════════════════════════════════════════════╗
║  🎉 核心資料遷移完成！                                ║
╚══════════════════════════════════════════════════════════╝
```

### 遷移完成確認：

- [ ] 所有表格都顯示 "✅ 已插入"
- [ ] 沒有出現 "❌" 錯誤訊息
- [ ] 用戶對應表數量 > 0

---

## ✅ 第六步：驗證資料

```bash
cd supabase_backend
node verify_migration.js
```

### 檢查項目：

- [ ] ✅ 資料筆數統計正確
- [ ] ✅ 外鍵完整性通過
- [ ] ✅ 必填欄位檢查通過
- [ ] ✅ 抽樣資料正確

---

## 🌐 第七步：測試前端功能

開啟前端測試以下功能：

### 用戶功能
- [ ] 登入功能（phone + birthday）
- [ ] 用戶資料顯示正確

### 訂單功能
- [ ] 訂單列表顯示
- [ ] 訂單詳細資料正確
- [ ] 可以新增訂單

### 團拆功能
- [ ] 團拆列表顯示
- [ ] 團拆詳細資料正確

### 出貨功能
- [ ] 出貨記錄顯示
- [ ] 物流單號正確

### 團拆金功能
- [ ] 團拆金餘額顯示
- [ ] 團拆金使用記錄正確

---

## 📊 遷移結果記錄

| 表格 | CSV 筆數 | 遷移筆數 | 成功率 | 備註 |
|------|---------|---------|--------|------|
| users | _____ | _____ | ___% | |
| product_catalog | _____ | _____ | ___% | |
| orders | _____ | _____ | ___% | |
| breaks | _____ | _____ | ___% | |
| shipments | _____ | _____ | ___% | |
| break_credits | _____ | _____ | ___% | |

**總計：** _____/_____  (**____%**)

---

## ⚠️ 如果遇到錯誤

### 常見錯誤 1: 用戶對應失敗

**症狀：** "XXX 筆無 user_id"

**解決方法：**
1. 檢查 users.csv 是否完整
2. 確認「訂購人」或「聯絡方式」與 users.csv 中的電話、暱稱一致

### 常見錯誤 2: 插入失敗

**症狀：** "❌ 插入訂單失敗: ..."

**解決方法：**
1. 查看錯誤訊息
2. 檢查 CSV 資料格式
3. 確認必填欄位有值

### 常見錯誤 3: 連線問題

**症狀：** "連線失敗" 或 "timeout"

**解決方法：**
1. 檢查網路連線
2. 確認 SUPABASE_URL 正確
3. 確認 SUPABASE_ANON_KEY 有效

---

## ✅ 遷移完成

- [ ] 所有檢查項目都已完成
- [ ] 資料驗證通過
- [ ] 前端功能測試正常
- [ ] 已備份原始資料
- [ ] 已記錄遷移結果

**遷移完成時間：** ___________  
**簽名確認：** ___________

---

## 📞 需要協助？

如果遇到問題：

1. 查看終端機錯誤訊息
2. 檢查 Supabase Dashboard Logs
3. 執行 `node verify_migration.js` 診斷
4. 查看 `DATABASE_TABLES_COMPLETE.md` 確認表格結構
