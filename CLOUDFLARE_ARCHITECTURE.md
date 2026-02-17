# Ning's Card - Cloudflare 架構方案

## 🏗️ 架構設計

```
┌─────────────────────────────────────────────────────┐
│                    用戶瀏覽器                         │
│  https://ningscard.com/orders?page=2                │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│           Cloudflare Pages (前端)                    │
│  • HTML/CSS/JavaScript                              │
│  • URL 路由 (無需重新載入)                           │
│  • 狀態管理 (localStorage + URL)                    │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓ API 呼叫
┌─────────────────────────────────────────────────────┐
│         Cloudflare Workers (後端 API)                │
│  • /api/login                                       │
│  • /api/products                                    │
│  • /api/orders                                      │
│  • /api/payments                                    │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│              Supabase (資料庫)                       │
│  • users, orders, products, breaks, payments        │
└─────────────────────────────────────────────────────┘
```

---

## 📂 專案結構

```
ningscardgasdemo/
├── frontend/                    # Cloudflare Pages
│   ├── index.html              # 主頁面（SPA 入口）
│   ├── css/
│   │   └── style.css           # 樣式
│   ├── js/
│   │   ├── app.js              # 主應用程式
│   │   ├── router.js           # URL 路由管理
│   │   ├── auth.js             # 登入/登出
│   │   ├── api.js              # API 呼叫封裝
│   │   ├── pages/              # 各頁面邏輯
│   │   │   ├── home.js         # 首頁
│   │   │   ├── products.js     # 商品列表
│   │   │   ├── orders.js       # 訂單查詢
│   │   │   ├── breaks.js       # 團拆查詢
│   │   │   ├── psa.js          # PSA 鑑定
│   │   │   └── profile.js      # 會員資料
│   │   └── utils/
│   │       ├── storage.js      # localStorage 封裝
│   │       └── helpers.js      # 工具函數
│   └── wrangler.toml           # Pages 設定
│
├── api-worker/                  # Cloudflare Workers (API)
│   ├── src/
│   │   ├── index.js            # Worker 入口
│   │   ├── router.js           # API 路由
│   │   ├── handlers/
│   │   │   ├── auth.js         # 登入 API
│   │   │   ├── products.js     # 商品 API
│   │   │   ├── orders.js       # 訂單 API
│   │   │   ├── breaks.js       # 團拆 API
│   │   │   ├── payments.js     # 付款 API
│   │   │   ├── psa.js          # PSA API
│   │   │   └── lottery.js      # 抽籤 API
│   │   ├── middleware/
│   │   │   ├── auth.js         # 驗證中介層
│   │   │   └── cors.js         # CORS 設定
│   │   └── utils/
│   │       ├── supabase.js     # Supabase 客戶端
│   │       ├── ecpay.js        # 綠界金流
│   │       └── response.js     # 統一回應格式
│   └── wrangler.toml           # Worker 設定
│
└── supabase_backend/            # 現有的遷移工具
    └── ...
```

---

## 🔄 URL 路由實作方式

### 使用 History API（無需重新載入頁面）

```javascript
// frontend/js/router.js
class Router {
  constructor() {
    this.routes = {}
    this.currentPage = null
    
    // 監聽瀏覽器上一頁/下一頁
    window.addEventListener('popstate', () => {
      this.loadCurrentRoute()
    })
  }
  
  // 註冊路由
  register(path, handler) {
    this.routes[path] = handler
  }
  
  // 導航到某個路徑（不重新載入頁面）
  navigate(path) {
    window.history.pushState({}, '', path)
    this.loadCurrentRoute()
  }
  
  // 載入當前路由
  async loadCurrentRoute() {
    const path = window.location.pathname
    const params = new URLSearchParams(window.location.search)
    
    // 找到對應的處理函數
    const handler = this.routes[path] || this.routes['/404']
    
    if (handler) {
      await handler(params)
    }
  }
}

// 使用範例
const router = new Router()

router.register('/', async () => {
  // 顯示首頁
  showPage('home')
})

router.register('/products', async (params) => {
  const category = params.get('category')
  showPage('products', { category })
})

router.register('/orders', async (params) => {
  const page = params.get('page') || 1
  showPage('orders', { page })
})

// 點擊連結時不重新載入
document.addEventListener('click', (e) => {
  if (e.target.tagName === 'A' && e.target.href.startsWith(window.location.origin)) {
    e.preventDefault()
    router.navigate(e.target.pathname + e.target.search)
  }
})
```

### 範例：訂單頁面支援分頁

```javascript
// frontend/js/pages/orders.js
async function showOrdersPage(options = {}) {
  const page = options.page || 1
  const perPage = 20
  
  // 從 API 取得訂單（帶分頁參數）
  const response = await api.get(`/api/orders?page=${page}&per_page=${perPage}`)
  const { orders, total, current_page, total_pages } = response
  
  // 渲染訂單列表
  renderOrders(orders)
  
  // 渲染分頁按鈕
  renderPagination(current_page, total_pages, (newPage) => {
    router.navigate(`/orders?page=${newPage}`)
  })
}

// 重新整理頁面時，會記住在第幾頁
// 例如：用戶在 /orders?page=3，按 F5 重新整理，還是在第 3 頁
```

---

## 💾 狀態保存策略

### 1. 登入狀態（localStorage）
```javascript
// 登入成功後
localStorage.setItem('user', JSON.stringify({
  id: user.id,
  phone: user.phone,
  nickname: user.nickname,
  loginTime: Date.now()
}))

// 檢查登入狀態
function isLoggedIn() {
  const user = JSON.parse(localStorage.getItem('user'))
  if (!user) return false
  
  // 檢查是否過期（例如：7天）
  const expireTime = 7 * 24 * 60 * 60 * 1000
  if (Date.now() - user.loginTime > expireTime) {
    localStorage.removeItem('user')
    return false
  }
  
  return true
}
```

### 2. 當前頁面狀態（URL）
```javascript
// 商品篩選狀態
/products?category=topps_now&status=available

// 訂單分頁 + 搜尋
/orders?page=2&search=大谷翔平

// 團拆分頁 + 狀態篩選
/breaks?page=1&status=pending
```

### 3. 購物車（localStorage）
```javascript
// 加入購物車
function addToCart(product, quantity) {
  const cart = JSON.parse(localStorage.getItem('cart') || '[]')
  cart.push({ product, quantity, addedAt: Date.now() })
  localStorage.setItem('cart', JSON.stringify(cart))
}

// 重新整理後，購物車還在
```

---

## 🚀 部署流程

### Step 1: 建立 Cloudflare Pages
```bash
cd frontend
npm create cloudflare@latest
# 選擇 "Website or web app"
# 選擇 "Framework: None (HTML/JS/CSS)"
```

### Step 2: 建立 API Worker
```bash
cd api-worker
npm create cloudflare@latest
# 選擇 "Hello World Worker"
```

### Step 3: 設定環境變數
```toml
# api-worker/wrangler.toml
name = "ningscard-api"
main = "src/index.js"
compatibility_date = "2024-01-01"

[vars]
SUPABASE_URL = "https://xxx.supabase.co"

[[kv_namespaces]]
binding = "CACHE"
id = "xxx"

[secrets]
# 使用 wrangler secret put 設定
# SUPABASE_ANON_KEY
# ECPAY_MERCHANT_ID
# ECPAY_HASH_KEY
# ECPAY_HASH_IV
```

### Step 4: 部署
```bash
# 部署 API
cd api-worker
wrangler deploy

# 部署前端
cd ../frontend
wrangler pages deploy
```

---

## ✨ 優勢

### vs 目前的 worker.html
| 功能 | 目前 | 新架構 |
|------|------|--------|
| 重新整理 | ❌ 重來 | ✅ 保持狀態 |
| 分享連結 | ❌ 只能分享首頁 | ✅ 可分享任何頁面 |
| 上一頁/下一頁 | ❌ 無法使用 | ✅ 正常運作 |
| SEO | ❌ 差 | ✅ 較好 |
| 開發維護 | 😰 一個檔案 5000+ 行 | 😊 分模組，易維護 |
| 效能 | 🐌 所有資料一次載入 | 🚀 按需載入 |

---

## 📋 實作步驟

**Week 1: 建立基礎架構**
1. ✅ 建立 frontend 專案（HTML + Router）
2. ✅ 建立 api-worker 專案
3. ✅ 設定 CORS、環境變數
4. ✅ 測試基本路由

**Week 2: 核心功能**
5. 登入 API + 頁面
6. 商品列表 API + 頁面（支援篩選、分頁）
7. 訂單查詢 API + 頁面（支援搜尋、分頁）

**Week 3: 付款 & 團拆**
8. 付款通知 API + 頁面
9. 團拆查詢 API + 頁面
10. 綠界金流整合

**Week 4: 完整功能**
11. PSA 鑑定
12. 會員資料
13. 運勢抽籤
14. 測試 + 上線

---

準備好了嗎？我們可以立刻開始建立專案結構！ 🚀
