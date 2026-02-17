# Ning's Card 前台功能重建計畫

## 📋 現有功能盤點（正式版 worker.html）

### 1️⃣ 會員系統
- [x] 手機 + 生日登入
- [x] 記住我功能
- [x] 會員資料查看/編輯
- [x] 7-11 門市資訊管理
- [x] 隱私權聲明

### 2️⃣ 商品訂購
- [x] **Topps Now 訂購**
  - 商品列表（圖片、價格、卡號）
  - 分類篩選
  - 數量選擇
  - 購物車
  - 下單功能
  
- [x] **卡盒訂購**
  - 卡盒商品列表
  - 商品詳情頁
  - 加入購物車
  - 下單功能

### 3️⃣ 訂單管理
- [x] **我的訂單**
  - 訂單列表（分頁）
  - 訂單狀態（待付款、已付款、已出貨等）
  - 訂單搜尋
  - 批次勾選付款
  - 訂單詳情

### 4️⃣ 團拆系統
- [x] **我的團拆**
  - 團拆列表（分頁）
  - 團拆狀態
  - 團拆搜尋
  - 批次勾選付款
  - 團拆詳情（種類、團名、團拆形式、購買品項、總團費、已付金額）

### 5️⃣ 付款系統
- [x] **多元付款方式**
  - (1) 銀行匯款 - 填寫帳號後五碼
  - (2) Line Pay - 填寫 Line Pay 名稱
  - (3) 綠界信用卡 - 整合綠界金流 API
  
- [x] **付款通知**
  - 批次付款（訂單+團拆混合）
  - 付款金額輸入
  - 付款備註
  - 付款狀態追蹤

### 6️⃣ PSA 鑑定服務
- [x] PSA 送審說明
- [x] 價格表
- [x] 送審表單（多卡片）
- [x] 我的 PSA 訂單

### 7️⃣ 其他功能
- [x] **運勢抽籤**
  - 每日抽籤（大吉、中吉、小吉、凶）
  - 限制每日一次
  - 運勢結果記錄
  
- [x] **關於我們 & 新手指引**
  - Ning's Card 介紹
  - Topps Now 說明
  - 團拆玩法說明
  - 出貨規則
  - PSA 鑑定 FAQ

- [x] **跑馬燈通知**
  - 重要公告輪播

---

## 🎯 遷移到 Supabase 後端的實作計畫

### Phase 1: 核心 API 建立（優先）
**目標**: 將所有 Google Apps Script API 改為 Supabase API

#### 1.1 會員 API
- [ ] `POST /api/login` - 登入驗證（手機 + 生日）
- [ ] `GET /api/user/:id` - 取得會員資料
- [ ] `PUT /api/user/:id` - 更新會員資料（門市、地址等）

#### 1.2 商品 API
- [ ] `GET /api/products` - 取得商品列表（支援分類篩選、到貨狀態）
- [ ] `GET /api/products/:id` - 取得商品詳情

#### 1.3 訂單 API
- [ ] `GET /api/orders` - 取得用戶訂單（支援分頁、搜尋）
- [ ] `POST /api/orders` - 建立訂單
- [ ] `GET /api/orders/:id` - 取得訂單詳情

#### 1.4 團拆 API
- [ ] `GET /api/breaks` - 取得用戶團拆（支援分頁、搜尋）
- [ ] `GET /api/breaks/:id` - 取得團拆詳情

#### 1.5 付款 API
- [ ] `POST /api/payments` - 建立付款通知（銀行匯款、Line Pay）
- [ ] `POST /api/payments/ecpay` - 綠界金流串接
- [ ] `POST /api/payments/ecpay/callback` - 綠界付款回調

#### 1.6 PSA API
- [ ] `POST /api/psa/orders` - 建立 PSA 訂單
- [ ] `GET /api/psa/orders` - 取得用戶 PSA 訂單

#### 1.7 抽籤 API
- [ ] `POST /api/lottery` - 每日抽籤
- [ ] `GET /api/lottery/today` - 檢查今日是否已抽籤

---

### Phase 2: 前端頁面重建
**技術選擇**: 
- Option A: 繼續使用 HTML + Vanilla JS（快速）
- Option B: 使用 React/Next.js（現代化，但需要更多時間）

**建議**: 先用 Option A 快速實現，之後再優化

#### 2.1 建立新的 Cloudflare Worker
```javascript
// worker_supabase.js - 新的 Worker，連接 Supabase
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 處理 API 請求
async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname
  
  // 路由處理
  if (path === '/api/login') return handleLogin(request)
  if (path === '/api/products') return handleProducts(request)
  // ... 其他路由
  
  // 返回前端 HTML
  return new Response(HTML_CONTENT, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}
```

#### 2.2 重建前端頁面
- [ ] 登入頁面
- [ ] 首頁（Topps Now）
- [ ] 卡盒訂購
- [ ] 我的訂單
- [ ] 我的團拆
- [ ] PSA 鑑定
- [ ] 會員資料
- [ ] 運勢抽籤
- [ ] 關於我們

---

### Phase 3: 綠界金流整合
#### 3.1 後端 API
- [ ] 產生綠界訂單（CheckMacValue 簽章）
- [ ] 接收付款回調
- [ ] 更新訂單/團拆付款狀態

#### 3.2 前端整合
- [ ] 綠界付款按鈕
- [ ] 跳轉到綠界頁面
- [ ] 付款完成後返回處理

---

### Phase 4: 進階功能
- [ ] **出貨規則檢查**
  - 單卡累積 10 張以上
  - 商品全到貨
  - 有卡盒訂單到貨
  - 有團拆卡片可一起寄出

- [ ] **團拆金系統**
  - 查看團拆金餘額
  - 使用團拆金抵扣

- [ ] **通知系統**
  - 訂單狀態變更通知
  - 出貨通知
  - LINE 通知整合（選配）

---

## 🚀 立即開始的步驟

### Step 1: 建立 Supabase API（Cloudflare Worker）
建議先建立一個新的 Worker 專門處理 API：

```
/workers
  /api-worker          # API Worker (Supabase)
    - wrangler.toml
    - src/
      - index.js       # 主要路由
      - handlers/
        - auth.js      # 登入相關
        - products.js  # 商品相關
        - orders.js    # 訂單相關
        - breaks.js    # 團拆相關
        - payments.js  # 付款相關
        - psa.js       # PSA 相關
        - lottery.js   # 抽籤相關
      - utils/
        - supabase.js  # Supabase 客戶端
        - ecpay.js     # 綠界金流工具
```

### Step 2: 前端改寫
修改現有的 `worker.html`，將所有 `callAPI()` 改為呼叫新的 Supabase API

### Step 3: 測試部署
- 本地測試：`wrangler dev`
- 部署測試環境：`wrangler deploy --env staging`
- 部署正式環境：`wrangler deploy --env production`

---

## 📝 資料庫 Schema 確認

目前 Supabase 已有的表：
- ✅ users (323 筆)
- ✅ orders (2255 筆)
- ✅ products (181 筆)
- ✅ breaks (557 筆)
- ✅ break_credits (37 筆)
- ✅ payments (110 筆)
- ✅ psa_orders (18 筆)
- ✅ psa_cards (89 筆)
- ✅ shipments (222 筆)
- ✅ lottery (765 筆)
- ✅ topps_now
- ✅ ecpay_records
- ✅ order_history

---

## ❓ 需要確認的問題

1. **前端技術選擇**: 繼續用 Vanilla JS 還是改用 React/Next.js？
2. **綠界金流測試**: 有測試帳號嗎？需要測試環境嗎？
3. **LINE 通知**: 需要整合 LINE Notify 嗎？
4. **部署策略**: 要分 staging 和 production 環境嗎？
5. **LIFF**: 正式版有用 LINE LIFF 嗎？需要保留嗎？

---

## 🎯 建議的優先順序

**Week 1**: 核心功能
1. 登入 API + 前端
2. 商品列表 API + 前端
3. 訂單查詢 API + 前端

**Week 2**: 付款功能
4. 付款通知 API + 前端（銀行匯款、Line Pay）
5. 綠界金流整合

**Week 3**: 完整功能
6. 團拆查詢 + 付款
7. PSA 鑑定
8. 運勢抽籤
9. 會員資料編輯

**Week 4**: 優化測試
10. 效能優化
11. Bug 修復
12. 正式上線

---

準備好了嗎？我們從哪裡開始？ 🚀
