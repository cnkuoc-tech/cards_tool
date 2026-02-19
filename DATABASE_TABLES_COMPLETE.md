# 資料庫表格與欄位完整清單

**檢查日期:** 2026年2月19日  
**檢查範圍:** backend/worker.js 所有資料庫操作

---

## 📊 使用中的資料表（共 11 個）

### 1. **users** (用戶表) ✅ 核心表

**用途:** 用戶基本資料、登入驗證

**使用位置:**
- 登入驗證 (line 383)
- 註冊 (line 421, 438)
- 取得訂單資訊 (line 569)
- 新增訂單 (line 767)
- 更新用戶資料 (line 1509)
- 搜尋用戶 (line 1528, 1578, 1629)
- PSA 訂單 (line 1949)
- 團拆金管理 (line 1753, 1815)
- 每日抽籤 (line 2019)
- 出貨管理 (line 2119, 2163, 2231, 2277)

**欄位清單:**
```sql
- id                UUID PRIMARY KEY
- phone             VARCHAR(20) UNIQUE NOT NULL  -- 🔑 登入用（主要）
- nickname          VARCHAR(50)                  -- 暱稱
- birthday          DATE                         -- 🔑 登入驗證用
- email             VARCHAR(100)
- address           TEXT
- real_name         VARCHAR(100)                 -- 真實姓名
- cvs_store_name    VARCHAR(200)                 -- 超商店名
- cvs_store_id      VARCHAR(50)                  -- 超商店號
- password          VARCHAR(4)                   -- 預留（目前未使用）
- created_at        TIMESTAMP
- updated_at        TIMESTAMP
```

---

### 2. **product_catalog** (商品目錄表) ✅ 核心表

**用途:** 商品資訊、價格、庫存管理

**使用位置:**
- 取得商品列表 (line 453)
- 新增訂單時查詢 (line 776)
- 門檻價格計算 (line 935)
- 庫存扣減 (line 952)

**欄位清單:**
```sql
- id                    UUID PRIMARY KEY
- item_name             VARCHAR(200) NOT NULL    -- 商品名稱
- card_no               VARCHAR(50)              -- 卡號
- price                 DECIMAL(10,2)            -- 原價
- threshold_price       DECIMAL(10,2)            -- 門檻價
- discount_threshold    INTEGER                  -- 門檻張數
- stock_status          VARCHAR(50)              -- 庫存狀態
- remaining_stock       INTEGER                  -- 剩餘庫存
- is_box_preorder       VARCHAR(10)              -- 是否為整盒預購 (Y/N)
- can_direct_order      VARCHAR(10)              -- 是否可直接訂購
- is_available          VARCHAR(10)              -- 是否開放 (Y/N)
- image_url_1           TEXT                     -- 圖片1
- image_url_2           TEXT                     -- 圖片2
- image_url_3           TEXT                     -- 圖片3
- image_url_4           TEXT                     -- 圖片4
- scheduled_delist_time TIMESTAMP                -- 預定下架時間
- created_at            TIMESTAMP
- updated_at            TIMESTAMP
```

---

### 3. **orders** (訂單表) ✅ 核心表

**用途:** 用戶訂單記錄、付款狀態

**使用位置:**
- 取得用戶訂單 (line 590)
- 新增訂單 (line 917)
- 累積張數計算 (line 994, 1014)
- 門檻價格更新 (line 1044)
- 未結清訂單查詢 (line 1261)
- 付款狀態更新 (line 1396)
- 搜尋訂單 (line 1533)

**欄位清單:**
```sql
- id                UUID PRIMARY KEY
- user_id           UUID REFERENCES users(id)
- timestamp         TIMESTAMP NOT NULL           -- 訂單時間
- item              VARCHAR(200)                 -- 商品名稱
- card_no           VARCHAR(50)                  -- 卡號
- quantity          INTEGER DEFAULT 1            -- 數量
- unit_price        DECIMAL(10,2)                -- 單價
- deposit           DECIMAL(10,2) DEFAULT 0      -- 訂金
- balance_amount    DECIMAL(10,2)                -- 尾款金額
- total_fee         DECIMAL(10,2) NOT NULL       -- 總金額
- status            VARCHAR(50) DEFAULT '已通知' -- 付款狀態
- payment_method    VARCHAR(50)
- is_notified       BOOLEAN DEFAULT FALSE
- is_cleared        BOOLEAN DEFAULT FALSE        -- 是否已結清
- is_invoiced       VARCHAR(10)
- is_shipped        VARCHAR(10)                  -- 是否已出貨
- arrival_status    VARCHAR(50)                  -- 到貨狀態
- image_url         TEXT
- box_order         VARCHAR(100)                 -- 整盒訂購標記
- merchant_trade_no VARCHAR(100)                 -- 綠界交易編號
- payment_date      TIMESTAMP
- notes             TEXT                         -- 備註
- remark            TEXT                         -- 🔒 manual_price_override 標記
- created_at        TIMESTAMP
- updated_at        TIMESTAMP
```

---

### 4. **breaks** (團拆記錄表) ✅ 核心表

**用途:** 團拆購買記錄、球隊分配

**使用位置:**
- 取得用戶團拆 (line 595)
- 未結清團拆查詢 (line 1284)
- 付款狀態更新 (line 1431, 1447)
- 搜尋團拆 (line 1542)
- Admin 批次新增 (line 1857-2018)
- Admin 更新/刪除 (line 3249-3393)

**欄位清單:**
```sql
- id                UUID PRIMARY KEY
- break_id          VARCHAR(50) NOT NULL         -- 團拆編號
- user_id           UUID REFERENCES users(id)
- name              VARCHAR(200)                 -- 團拆名稱
- category          VARCHAR(50) DEFAULT '棒球'   -- 分類
- format            VARCHAR(50) DEFAULT '隨機'   -- 格式：隨機/PYT/指定
- item              VARCHAR(200)                 -- 關聯商品
- total_fee         DECIMAL(10,2) NOT NULL
- paid              DECIMAL(10,2) DEFAULT 0
- balance           DECIMAL(10,2)                -- 計算欄位
- status            VARCHAR(50) DEFAULT '已通知'
- is_opened         BOOLEAN DEFAULT FALSE        -- 是否已拆
- is_shipped        BOOLEAN DEFAULT FALSE        -- 是否已出貨
- is_cleared        BOOLEAN DEFAULT FALSE        -- 是否已結清
- payment_method    VARCHAR(50)
- merchant_trade_no VARCHAR(100)
- payment_date      TIMESTAMP
- remark            TEXT
- created_at        TIMESTAMP
- updated_at        TIMESTAMP
```

---

### 5. **shipments** (出貨記錄表) ✅ 核心表

**用途:** 出貨記錄、物流追蹤

**使用位置:**
- 取得用戶出貨記錄 (line 598)
- 新增出貨記錄 (line 2149, 2193, 2239, 2293)
- 批次更新追蹤號碼 (line 3848-3936)
- 刪除出貨記錄 (line 3938-3970)
- 取得所有出貨記錄 (line 3698-3838)
- 出貨報表生成 (line 2342-2580)

**欄位清單:**
```sql
- id            UUID PRIMARY KEY
- user_id       UUID REFERENCES users(id)
- shipment_no   VARCHAR(50)                      -- 出貨編號
- shipment_date TIMESTAMP                        -- 出貨日期
- nickname      VARCHAR(50)                      -- 群組暱稱
- real_name     VARCHAR(100)                     -- 真實姓名
- phone         VARCHAR(20)
- ship_store    VARCHAR(200)                     -- 收件門市
- store_number  VARCHAR(20)                      -- 711店號
- tracking_no   VARCHAR(100)                     -- 物流單號
- items         JSONB                            -- 商品明細 (JSON格式)
- status        VARCHAR(50) DEFAULT 'pending'    -- pending/shipped/delivered
- remark        TEXT
- created_at    TIMESTAMP
- updated_at    TIMESTAMP
```

---

### 6. **break_credits** (團拆金表) ✅ 核心表

**用途:** 團拆金額記錄、使用追蹤

**使用位置:**
- 查詢用戶團拆金 (line 1592, 1644)
- 使用團拆金抵扣 (line 1685)
- 取得所有團拆金 (line 1711)
- 新增團拆金 (line 1770, 1834)
- 批次新增團拆金 (line 1877-1939)
- Admin 更新/刪除 (line 3395-3509, 3511-3539)

**欄位清單:**
```sql
- id              UUID PRIMARY KEY
- user_id         UUID REFERENCES users(id)
- amount          DECIMAL(10,2) NOT NULL         -- 金額
- source          VARCHAR(100)                   -- 來源說明
- is_used         BOOLEAN DEFAULT FALSE          -- 是否已使用
- used_break_ids  TEXT                           -- 已使用的團拆ID（逗號分隔）
- used_amount     DECIMAL(10,2) DEFAULT 0        -- 已使用金額
- created_at      TIMESTAMP
- updated_at      TIMESTAMP
```

---

### 7. **notifications** (付款通知表) ✅ 核心表

**用途:** 付款通知記錄（轉帳等非線上支付）

**使用位置:**
- 新增付款通知 (line 1376)
- Admin 查詢通知 (line 3076-3095)
- Admin 更新通知狀態 (line 3097-3152)

**欄位清單:**
```sql
- id                UUID PRIMARY KEY
- user_id           UUID REFERENCES users(id)
- merchant_trade_no VARCHAR(100)                 -- 訂單編號
- payment_type      VARCHAR(20)                  -- order/break
- payment_method    VARCHAR(50)                  -- 付款方式
- amount            DECIMAL(10,2)                -- 金額
- account_last_5    VARCHAR(10)                  -- 帳號後五碼
- payment_time      VARCHAR(100)                 -- 付款時間（字串）
- order_ids         TEXT                         -- 關聯訂單ID
- break_ids         TEXT                         -- 關聯團拆ID
- status            VARCHAR(50) DEFAULT 'pending' -- pending/confirmed/rejected
- admin_note        TEXT                         -- 管理員備註
- created_at        TIMESTAMP
- updated_at        TIMESTAMP
```

---

### 8. **lottery** (每日抽籤表) ✅ 核心表

**用途:** 每日運勢抽籤記錄

**使用位置:**
- 查詢今日是否已抽籤 (line 2040)
- 儲存抽籤結果 (line 2096)
- 清理重複用戶時刪除 (line 3543)

**欄位清單:**
```sql
- id         UUID PRIMARY KEY
- user_id    UUID REFERENCES users(id)
- result     VARCHAR(50)                         -- 運勢結果
- draw_date  TIMESTAMP                           -- 抽籤時間
- status     VARCHAR(50) DEFAULT '已完成'
- created_at TIMESTAMP
- updated_at TIMESTAMP
```

---

### 9. **ecpay_records** (綠界付款記錄表) ✅ 核心表

**用途:** 綠界金流交易記錄

**使用位置:**
- 建立綠界付款 (line 2257)
- 查詢付款狀態 (line 2299, 4098)
- 更新付款狀態 (line 4125)

**欄位清單:**
```sql
- id                UUID PRIMARY KEY
- merchant_trade_no VARCHAR(100) UNIQUE NOT NULL -- 商家交易編號
- user_id           UUID REFERENCES users(id)
- trade_amt         DECIMAL(10,2)                -- 交易金額
- trade_desc        VARCHAR(200)                 -- 交易描述
- item_name         VARCHAR(200)                 -- 商品名稱
- payment_type      VARCHAR(20)                  -- order/break
- return_code       VARCHAR(10)                  -- 綠界回傳碼
- return_message    TEXT                         -- 綠界回傳訊息
- trade_no          VARCHAR(100)                 -- 綠界交易編號
- trade_date        TIMESTAMP                    -- 交易時間
- payment_date      TIMESTAMP                    -- 付款時間
- payment_type_charge_fee DECIMAL(10,2)          -- 手續費
- custom_field_1    VARCHAR(100)                 -- 自訂欄位1（電話）
- custom_field_2    TEXT                         -- 自訂欄位2（訂單IDs）
- order_details     JSONB                        -- 訂單詳情
- status            VARCHAR(50) DEFAULT 'pending' -- pending/success/failed
- created_at        TIMESTAMP
- updated_at        TIMESTAMP
```

---

### 10. **psa_orders** (PSA鑑定訂單表) ✅ 功能表

**用途:** PSA 卡片鑑定服務訂單

**使用位置:**
- 新增 PSA 訂單 (line 1970)
- Admin 查詢/更新/刪除 (line 3154-3247)

**欄位清單:**
```sql
- id              UUID PRIMARY KEY
- order_id        VARCHAR(50) UNIQUE NOT NULL    -- PSA 訂單編號
- user_id         UUID REFERENCES users(id)
- real_name       VARCHAR(100)
- email           VARCHAR(100)
- phone           VARCHAR(20)
- shipping_method VARCHAR(50)                    -- 寄送方式
- total_cards     INTEGER                        -- 總卡片數
- total_amount    DECIMAL(10,2)                  -- 總金額
- status          VARCHAR(50) DEFAULT '已提交'
- price_per_card  DECIMAL(10,2)                  -- 每張價格
- status_updated_at TIMESTAMP                    -- 狀態更新時間
- timestamp       TIMESTAMP                      -- 訂單時間
- created_at      TIMESTAMP
- updated_at      TIMESTAMP
```

---

### 11. **order_history** (訂單歷史表) ✅ 輔助表

**用途:** 記錄訂單變更歷史

**使用位置:**
- 記錄訂單更新歷史 (line 1331)

**欄位清單:**
```sql
- id         UUID PRIMARY KEY
- user_id    UUID REFERENCES users(id)
- action     VARCHAR(50)                         -- 操作類型
- order_type VARCHAR(50)                         -- order/break
- order_id   VARCHAR(100)                        -- 訂單ID
- item       VARCHAR(200)                        -- 商品名稱
- amount     DECIMAL(10,2)                       -- 金額
- details    TEXT                                -- 詳細資訊
- timestamp  TIMESTAMP DEFAULT NOW()
- created_at TIMESTAMP
```

---

## 📋 遷移檢查清單

### ✅ 必須遷移的核心表（9個）

1. ✅ **users** - 用戶資料（含登入資訊）
2. ✅ **product_catalog** - 商品目錄
3. ✅ **orders** - 訂單記錄
4. ✅ **breaks** - 團拆記錄
5. ✅ **shipments** - 出貨記錄
6. ✅ **break_credits** - 團拆金
7. ✅ **notifications** - 付款通知（暫無 CSV）
8. ✅ **lottery** - 每日抽籤記錄
9. ✅ **ecpay_records** - 綠界交易記錄

### ⚠️ 可選遷移的功能表（2個）

10. ⚠️ **psa_orders** - PSA訂單（如果有使用PSA功能）
11. ⚠️ **order_history** - 訂單歷史（建議遷移用於追蹤）

---

## 🔍 欄位使用頻率分析

### 高頻使用欄位（必須有資料）

**users:**
- `phone` (登入用，出現 30+ 次)
- `birthday` (驗證用，出現 20+ 次)
- `id` (外鍵關聯，出現 50+ 次)
- `nickname` (顯示用，出現 40+ 次)

**orders:**
- `user_id` (關聯用戶，出現 30+ 次)
- `item`, `card_no` (商品識別，出現 40+ 次)
- `quantity` (數量計算，出現 30+ 次)
- `balance_amount` (付款計算，出現 20+ 次)
- `status` (狀態判斷，出現 25+ 次)

**product_catalog:**
- `item_name`, `card_no` (商品識別，出現 40+ 次)
- `price`, `threshold_price` (價格計算，出現 35+ 次)
- `is_available` (開放狀態，出現 15+ 次)

**breaks:**
- `user_id` (關聯用戶，出現 20+ 次)
- `break_id` (團拆識別，出現 15+ 次)
- `balance` (付款計算，出現 15+ 次)

### 中頻使用欄位（建議有資料）

- `email`, `address`, `real_name` (users)
- `shipment_no`, `tracking_no` (shipments)
- `amount`, `source` (break_credits)
- `merchant_trade_no` (多個表)

### 低頻使用欄位（可空值）

- `password` (users - 未使用)
- `notes` (orders - 備註)
- `remark` (多個表 - 備註)
- `image_url_2/3/4` (product_catalog - 額外圖片)

---

## 📝 CSV 匯出建議順序

### 第一批（核心依賴）
1. **users** - 必須最先匯入（其他表都依賴 user_id）
2. **product_catalog** - 商品資料（訂單依賴）

### 第二批（業務資料）
3. **orders** - 訂單記錄
4. **breaks** - 團拆記錄
5. **break_credits** - 團拆金

### 第三批（輔助資料）
6. **shipments** - 出貨記錄
7. **notifications** - 付款通知
8. **lottery** - 抽籤記錄

### 第四批（交易記錄）
9. **ecpay_records** - 綠界記錄（只遷移 status='success'）
10. **order_history** - 訂單歷史
11. **psa_orders** - PSA訂單（如需要）

---

## ⚠️ 遷移注意事項

### 資料清理建議

**必須清理：**
- 測試用戶資料
- 測試訂單（status='測試'）
- 失敗的付款記錄（ecpay_records.status='failed'）
- 無效的團拆記錄

**必須保留：**
- 所有真實用戶
- 所有已完成/已付款的訂單
- 所有已結清的團拆
- 所有成功的付款記錄
- 所有出貨記錄
- 所有團拆金記錄
- 所有抽籤記錄

### 外鍵關係

```
users (id)
  ├─→ orders (user_id)
  ├─→ breaks (user_id)
  ├─→ shipments (user_id)
  ├─→ break_credits (user_id)
  ├─→ notifications (user_id)
  ├─→ lottery (user_id)
  ├─→ ecpay_records (user_id)
  ├─→ psa_orders (user_id)
  └─→ order_history (user_id)
```

**遷移時必須確保：**
1. users 表的所有 id 都有對應記錄
2. 其他表的 user_id 都能對應到 users.id
3. 使用 UUID 而非 integer ID

---

## 📊 資料完整性檢查 SQL

```sql
-- 檢查孤立的訂單（user_id 不存在）
SELECT COUNT(*) FROM orders 
WHERE user_id NOT IN (SELECT id FROM users);

-- 檢查孤立的團拆
SELECT COUNT(*) FROM breaks 
WHERE user_id NOT IN (SELECT id FROM users);

-- 檢查孤立的出貨記錄
SELECT COUNT(*) FROM shipments 
WHERE user_id NOT IN (SELECT id FROM users);

-- 檢查必填欄位
SELECT COUNT(*) FROM users WHERE phone IS NULL OR birthday IS NULL;
SELECT COUNT(*) FROM orders WHERE user_id IS NULL OR item IS NULL;
SELECT COUNT(*) FROM breaks WHERE user_id IS NULL OR break_id IS NULL;
```

---

**總結:**
- **共 11 個資料表**
- **9 個核心表必須遷移（含 ecpay_records）**
- **2 個功能表依需求遷移**
- **lottery 表確認使用中（每日抽籤功能）**
- **ecpay_records 表確認使用中（綠界金流）**
