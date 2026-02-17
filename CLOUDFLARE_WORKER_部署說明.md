# Cloudflare Worker 完整版 - 部署說明

## 📋 檔案資訊

**檔案名稱**: `cloudflare-worker-complete.js`  
**建立日期**: 2024-02-02  
**版本**: 1.0 完整版

---

## ✨ 功能清單

### 🔐 會員系統
- ✅ 登入：手機號碼 + 生日（MMDD 4碼）
- ✅ 登出功能
- ✅ 記住登入狀態（localStorage，7天有效期）
- ✅ 自動登入檢查

### 📱 頁面結構（使用 switchTab 切換）
1. **首頁 (home)** - 關於我們的介紹
2. **商品列表 (entry)** - Topps Now 商品展示
3. **訂單查詢 (orders)** - 我的訂單，支援篩選：
   - 全部
   - 待付款
   - 已付款
   - 已出貨
4. **團拆查詢 (breaks)** - 團拆紀錄列表
5. **PSA 鑑定 (psa)** - PSA 鑑定申請表單
   - Ultra Pro 一觸框
   - 其他保護方式
6. **付款通知 (profile)** - 付款通知表單
7. **關於我們 (about)** - 詳細介紹

### 🗄️ 資料庫結構（Supabase）

#### users 表
```sql
- id: integer (主鍵)
- phone: varchar
- birthday: varchar (MMDD 格式)
- nickname: varchar
- real_name: varchar
- email: varchar
- address: varchar
```

#### products 表
```sql
- id: integer (主鍵)
- item_name: varchar
- price: numeric
- image_url_1: varchar
- is_available: boolean
- stock_status: varchar
- created_at: timestamp
```

#### orders 表
```sql
- id: integer (主鍵)
- user_id: integer (外鍵)
- item_name: varchar
- card_no: varchar
- quantity: integer
- total_fee: numeric
- is_cleared: boolean
- is_shipped: boolean
- order_date: timestamp
```

#### group_breaks 表
```sql
- id: integer (主鍵)
- user_id: integer (外鍵)
- break_name: varchar
- created_at: timestamp
```

### 🌐 API 端點

#### POST /api/login
登入驗證
```json
// Request
{
  "phone": "0912345678",
  "birthday": "0115"
}

// Response
{
  "success": true,
  "user": {
    "id": 1,
    "phone": "0912345678",
    "nickname": "暱稱",
    "real_name": "真實姓名",
    "email": "email@example.com",
    "address": "地址"
  },
  "orders": [...],
  "breaks": [...]
}
```

#### GET /api/products
取得商品列表
```json
// Response
{
  "success": true,
  "products": [
    {
      "id": 1,
      "item_name": "商品名稱",
      "price": 1000,
      "image_url_1": "https://...",
      "is_available": true,
      "stock_status": "有貨",
      "created_at": "2024-01-01"
    }
  ]
}
```

#### GET /api/orders?user_id=xxx&filter=all
取得訂單列表（支援篩選）
```json
// Response
{
  "success": true,
  "orders": [
    {
      "id": 1,
      "item_name": "商品名稱",
      "card_no": "#123",
      "quantity": 1,
      "total_fee": 1000,
      "is_cleared": false,
      "is_shipped": false,
      "order_date": "2024-01-01"
    }
  ]
}
```

#### GET /api/breaks?user_id=xxx
取得團拆列表
```json
// Response
{
  "success": true,
  "breaks": [
    {
      "id": 1,
      "break_name": "團拆名稱",
      "created_at": "2024-01-01"
    }
  ]
}
```

#### POST /api/payment-notice
付款通知
```json
// Request
{
  "method": "ATM",
  "lastFive": "12345",
  "amount": 1000,
  "note": "備註"
}
```

#### POST /api/psa-submit
PSA 鑑定申請
```json
// Request
{
  "realName": "真實姓名",
  "nickname": "暱稱",
  "phone": "0912345678",
  "quantity": "5",
  "type": "ultra",
  "total": 4000
}
```

---

## 🚀 部署步驟

### 1️⃣ 準備 Supabase

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)
2. 選擇你的專案或建立新專案
3. 複製以下資訊：
   - **SUPABASE_URL**: `https://hmqwcpstzkxfwabasqgx.supabase.co`
   - **SUPABASE_ANON_KEY**: 在 Settings → API → anon public

### 2️⃣ 部署到 Cloudflare Workers

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 點選 **Workers & Pages**
3. 選擇你的 Worker 或點選 **Create Application**
4. 點選 **Edit Code**
5. 複製 `cloudflare-worker-complete.js` 的全部內容
6. 貼上到編輯器中
7. 點選 **Save and Deploy**

### 3️⃣ 設定環境變數

1. 在 Worker 頁面點選 **Settings**
2. 選擇 **Variables**
3. 點選 **Add variable**
4. 新增以下變數：

| 變數名稱 | 值 | 類型 |
|---------|---|------|
| `SUPABASE_URL` | `https://hmqwcpstzkxfwabasqgx.supabase.co` | Text |
| `SUPABASE_ANON_KEY` | `你的 Anon Key` | Secret |

5. 點選 **Save**

### 4️⃣ 測試

1. 開啟你的 Worker URL（例如：`https://your-worker.workers.dev`）
2. 測試登入功能
3. 測試各個頁面切換
4. 測試 API 端點

---

## 🎨 UI 設計

### 顏色變數
```css
--navy: #0a2342      /* 主色 - 深藍 */
--navy-2: #1c3a63    /* 次要藍色 */
--orange: #e67e22    /* 強調色 - 橘色 */
--red: #d32f2f       /* 警示色 - 紅色 */
--bg-light: #f8f9fa  /* 淺背景色 */
--color-stock: #28a745  /* 庫存綠色 */
```

### 主要元素
- **固定 Header**: 60px 高度，深藍漸層背景
- **側邊選單**: 280px 寬度，滑入/滑出動畫
- **主容器**: 最大 1200px 寬度，白色背景
- **浮水印**: Logo 固定在背景，5% 透明度

---

## 📱 響應式設計

### 手機版 (< 768px)
- 容器邊距縮小
- 訂單資訊改為單欄顯示
- Tab 按鈕改為垂直排列
- 所有按鈕最小觸控區域 44x44px

---

## 🔧 技術細節

### 前端技術
- 原生 JavaScript（無外部依賴）
- CSS3 動畫和漸變
- LocalStorage 用於登入狀態
- Fetch API 用於 API 呼叫

### 後端技術
- Cloudflare Workers
- Supabase REST API
- CORS 跨域處理

### 頁面切換機制
```javascript
let currentPage = 'home'

function switchTab(tabId) {
  // 隱藏所有頁面
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active')
  })
  
  // 顯示目標頁面
  const targetPage = document.getElementById('page-' + tabId)
  targetPage.classList.add('active')
  currentPage = tabId
}
```

---

## ⚠️ 注意事項

1. **環境變數必須設定**: 確保 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 正確設定
2. **資料庫權限**: 確認 Supabase 的 RLS (Row Level Security) 政策正確設定
3. **手機號碼格式**: 登入時手機號碼必須以 0 開頭（例如：0912345678）
4. **生日格式**: MMDD 四位數字（例如：0115 代表 1月15日）
5. **自動登入**: 登入資訊會儲存 7 天，過期後需重新登入

---

## 🐛 除錯建議

### 1. 登入失敗
- 檢查手機號碼和生日格式是否正確
- 確認 Supabase 資料庫中有對應的用戶資料
- 查看瀏覽器 Console 是否有錯誤訊息

### 2. 商品無法顯示
- 檢查 `products` 表中 `is_available` 欄位是否為 true
- 確認圖片 URL 是否有效
- 查看 Network 標籤確認 API 回應

### 3. 訂單篩選失敗
- 確認 `is_cleared` 和 `is_shipped` 欄位類型為 boolean
- 檢查 API 查詢條件是否正確

---

## 📞 支援

如有問題，請聯絡：
- Email: contact@ningscard.com
- LINE: @ningscard

---

**建立者**: GitHub Copilot  
**最後更新**: 2024-02-02
