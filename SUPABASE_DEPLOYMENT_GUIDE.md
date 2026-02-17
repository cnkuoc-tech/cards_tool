# Ning's Card Store - Supabase 版本部署指南

## 📋 檔案說明

### 正式版（不要動）
- `backend.js` - Google Apps Script 後端（正式環境）
- `worker.html` - 前端網頁（正式環境）
- 網址：https://www.ningscard.com

### 測試版（Supabase 新版本）
- `worker_supabase_complete.js` - 全新的 Supabase 後端（完整重寫）
- 測試網址：https://supabasefrontdemo.cnkuoc.workers.dev/

---

## 🎯 worker_supabase_complete.js 功能清單

### ✅ 已完整實作
1. **會員功能**
   - 登入（phone + birthday 驗證）
   - 註冊新用戶
   - 個人資料更新

2. **商品功能**
   - 取得商品列表
   - **動態計算累積張數**（從 orders 資料表實時加總）
   - 支援多圖片、分類、門檻價等完整欄位

3. **訂單功能**
   - 查詢用戶訂單
   - 新增訂單
   - **價格自動調整**（達到門檻時回溯更新舊訂單）
   - 計算每個用戶的累積張數

4. **付款通知功能**
   - 取得待付款訂單 Key
   - 批次付款通知
   - 提交付款通知（支援訂單 & 團拆）

5. **團拆金功能**
   - 查詢團拆金餘額
   - 使用團拆金（自動依序扣除）

6. **每日運勢功能**
   - 檢查今日是否已抽籤
   - 儲存運勢結果

7. **出貨功能**
   - 建立出貨記錄
   - 查詢出貨歷史
   - 自動更新訂單狀態為「已寄出」

8. **訂單查詢**
   - 關鍵字搜尋訂單

9. **資料驗證**
   - 統計各資料表數量
   - 檢查資料完整性

### ⚠️ 暫不實作
- PSA 鑑定功能（需求較少）
- 綠界金流整合（需要敏感金鑰）

---

## 🔑 核心邏輯移植說明

### 1. 累積張數計算
**Google Sheet 原邏輯**：使用 SUMIFS 公式自動計算
```
=SUMIFS(訂購總表!張數, 訂購總表!品項, A2, 訂購總表!卡號, B2)
```

**Supabase 實作**：
```javascript
// 查詢所有訂單
const allOrders = await supabase.queryAll('orders', {
  select: 'item,card_no,quantity'
})

// 依商品分組加總
const accumulatedMap = new Map()
allOrders.forEach(order => {
  const key = `${order.item}||${order.card_no}`
  accumulatedMap.set(key, (accumulatedMap.get(key) || 0) + order.quantity)
})
```

### 2. 價格門檻自動調整
**Google Sheet 原邏輯**：
- 下單時檢查全站累積是否達到門檻
- 如果達到，使用 `updateOrderPricesInSheet()` 更新該用戶該商品的所有舊訂單

**Supabase 實作**：
```javascript
// 計算當前累積（加上本次下單）
const currentAccumulated = (globalAccumulated.get(key) || 0) + qty

// 判斷是否剛達到門檻
if (threshold > 0 && currentAccumulated >= threshold) {
  const previousAccumulated = globalAccumulated.get(key) || 0
  
  if (previousAccumulated < threshold) {
    // 剛達到門檻！回溯更新舊訂單
    const oldOrders = await supabase.query('orders', {
      eq: { phone, item, card_no }
    })
    
    for (const oldOrder of oldOrders) {
      await supabase.update('orders',
        { id: oldOrder.id },
        { price: thresholdPrice, total_fee: thresholdPrice * quantity }
      )
    }
  }
}
```

### 3. 團拆金使用
**Google Sheet 原邏輯**：
- 查詢該用戶的團拆金記錄
- 依序扣除（先進先出）

**Supabase 實作**：
```javascript
let remainingToUse = amount

for (const record of records) {
  const available = record.credit_amount - record.used_amount
  if (available > 0 && remainingToUse > 0) {
    const toUse = Math.min(available, remainingToUse)
    await supabase.update('break_credits',
      { id: record.id },
      { used_amount: record.used_amount + toUse }
    )
    remainingToUse -= toUse
  }
}
```

---

## 🚀 部署步驟

### 方法一：Cloudflare Dashboard 手動部署（推薦）

1. 登入 Cloudflare Dashboard
2. 進入 Workers & Pages
3. 找到你的 Worker（或建立新的）
4. 複製整個 `worker_supabase_complete.js` 的內容
5. 貼上到 Worker 編輯器
6. 設定環境變數：
   - `SUPABASE_URL`: `https://hmqwcpstzkxfwabasqgx.supabase.co`
   - `SUPABASE_ANON_KEY`: （你的 Supabase anon key）
7. 點擊「Save and Deploy」

### 方法二：使用 wrangler CLI

```bash
# 1. 安裝 wrangler
npm install -g wrangler

# 2. 登入 Cloudflare
wrangler login

# 3. 建立 wrangler.toml（或使用現有的）
cat > wrangler.toml << EOF
name = "ningscard-supabase"
main = "worker_supabase_complete.js"
compatibility_date = "2024-01-01"

[vars]
SUPABASE_URL = "https://hmqwcpstzkxfwabasqgx.supabase.co"

# 使用 wrangler secret put 設定敏感資訊
# wrangler secret put SUPABASE_ANON_KEY
EOF

# 4. 部署
wrangler deploy
```

---

## 🧪 測試

部署完成後，訪問你的 Worker 網址（例如：https://supabasefrontdemo.cnkuoc.workers.dev/）

你會看到一個簡單的測試介面，可以測試各種 API 功能：

1. **取得商品列表** - 測試商品查詢和累積張數計算
2. **測試登入** - 驗證會員登入功能
3. **查詢訂單** - 測試訂單查詢
4. **驗證資料** - 檢查資料庫狀態

### API 調用範例

```javascript
// 取得商品列表
fetch('https://supabasefrontdemo.cnkuoc.workers.dev/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'getProducts'
  })
})

// 登入
fetch('https://supabasefrontdemo.cnkuoc.workers.dev/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'login',
    phone: '0912345678',
    birthday: '0101'
  })
})

// 下單
fetch('https://supabasefrontdemo.cnkuoc.workers.dev/api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'addOrderEntriesToMain',
    nickname: '測試用戶',
    phone: '0912345678',
    orderEntries: [
      { item: '大谷翔平', cardNo: 'TN-123', quantity: 5, price: 100 }
    ]
  })
})
```

---

## 📊 資料表結構對應

### Google Sheet → Supabase

| Google Sheet | Supabase Table | 說明 |
|-------------|----------------|------|
| 會員列表 | `users` | 會員資料 |
| 下單商品 | `product_catalog` | 商品目錄 |
| Topps_Now_訂購總表 | `orders` | 訂單主檔 |
| 團拆金 | `break_credits` | 團拆金記錄 |
| PSA鑑定訂單 | `psa_orders` | PSA 訂單 |
| 出貨記錄 | `shipment_records` | 出貨記錄 |
| 付款通知暫存 | `payment_records` | 付款通知 |
| （新增）| `daily_fortune` | 每日運勢 |
| （新增）| `email_notifications` | 郵件通知記錄 |
| （新增）| `admin_logs` | 管理員操作記錄 |

---

## ⚠️ 重要注意事項

1. **不要修改正式版檔案**
   - `backend.js` 和 `worker.html` 是正式環境，保持原樣

2. **測試數據隔離**
   - 建議在 Supabase 中使用不同的資料表或環境來測試

3. **環境變數安全**
   - `SUPABASE_ANON_KEY` 是敏感資訊，使用 `wrangler secret put` 設定
   - 不要直接寫在程式碼中

4. **性能考量**
   - `queryAll()` 會查詢所有資料，適合累積張數計算
   - 對於大量資料（>10,000 筆），建議使用 Supabase 的 RPC 或 View

5. **錯誤處理**
   - 所有 API 都包含 try-catch 錯誤處理
   - 失敗時會返回 `{ success: false, message: '錯誤訊息' }`

---

## 🔧 未來擴展

如果測試成功，可以考慮：

1. **整合完整前端**
   - 將 worker.html 的前端介面整合進來
   - 或建立新的 React/Vue 前端

2. **加入綠界金流**
   - 整合 ECPay API
   - 實作付款回調處理

3. **郵件通知**
   - 使用 Cloudflare Email Workers
   - 或整合第三方郵件服務（SendGrid、Mailgun）

4. **管理後台**
   - 建立管理員介面
   - 出貨管理、訂單管理等

5. **效能優化**
   - 使用 Cloudflare KV 快取商品列表
   - 建立 Supabase View 來加速累積張數查詢

---

## 📞 支援

如有問題，請檢查：
1. Cloudflare Worker 的 Logs
2. Supabase Dashboard 的 SQL Editor
3. 瀏覽器的 Console 錯誤訊息

---

**版本**: v1.0.0  
**最後更新**: 2026-02-06  
**作者**: GitHub Copilot
