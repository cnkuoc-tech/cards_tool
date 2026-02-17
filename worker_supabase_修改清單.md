# Worker Supabase 修改清單

## 🔍 問題分析

### 1. **API 架構問題**
- **現況**: `worker_supabase.js` 的前端呼叫 `https://supabase.cnkuoc.workers.dev` API
- **問題**: 這個 API Worker 可能還沒部署或功能不完整
- **影響**: 所有功能都無法正常運作（登入、商品、訂單、團拆等）

### 2. **需要的 API 端點**（共 16 個）

#### 會員相關
1. `login` - 登入驗證
2. `register` - 註冊（可能不需要）
3. `getOrderInfo` - 取得用戶訂單和團拆資料

#### 商品相關
4. `getProducts` - 取得所有商品（Topps Now + 卡盒）
5. `addOrderEntriesToMain` - 新增訂單

#### 訂單相關
6. `submitPaymentNotification` - 付款通知

#### 團拆相關
7. `getBreakCredit` - 取得團拆額度
8. `useBreakCredit` - 使用團拆額度

#### PSA 相關
9. `submitPsaOrder` - 提交 PSA 訂單
10. `lookupPsaOrders` - 查詢 PSA 訂單

#### 其他功能
11. `notifyPaymentBulk` - 批量付款通知
12. `notifyProfileUpdate` - 個人資料更新通知
13. `checkDailyFortune` - 檢查每日抽獎
14. `saveDailyFortune` - 儲存抽獎結果
15. `getShipmentRecords` - 取得出貨紀錄

## 🎯 解決方案

### 方案 A：修改前端直接查詢 Supabase（推薦）
**優點**:
- 簡單直接，不需要額外的 API Worker
- 減少一層請求，速度更快
- 易於維護

**缺點**:
- 需要大幅修改前端 JavaScript
- 商業邏輯暴露在前端

**需要修改**:
1. 將所有 `callAPI()` 改為直接查詢 Supabase
2. 在前端實作所有資料處理邏輯

### 方案 B：建立完整的 API Worker
**優點**:
- 商業邏輯在後端，較安全
- 前端程式碼改動小

**缺點**:
- 需要建立並維護額外的 Worker
- 多一層請求

**需要建立**:
- 一個新的 Cloudflare Worker (`supabase.cnkuoc.workers.dev`)
- 實作上述 16 個 API 端點

## 📋 具體問題清單

### 問題 1: Topps Now 和卡盒混在一起
**原因**: 
- 前端依賴 `getProducts` API 返回的資料結構
- API 應該要區分 `isBox` 欄位

**修改位置**: 
```javascript
// Line 2349
const res = await callAPI('getProducts', {});
```

**需要的資料結構**:
```javascript
{
  success: true,
  items: [
    {
      item: "商品名稱",
      cardNo: "卡號",
      price: 100,
      fullPrice: 80,
      threshold: 10,
      images: ["url1", "url2"],
      isBox: "N",  // Y=卡盒, N=Topps Now
      status: "open", // open/closed
      stockStatus: "Y" // Y=現貨, P=預購, N=售完
    }
  ]
}
```

### 問題 2: 訂單/團拆紀錄空白
**原因**: 
- `getOrderInfo` API 沒有正確返回資料
- 或資料表 `orders` / `group_breaks` 沒有資料

**修改位置**:
```javascript
// Line 1816, 1847, 3297, 3405, 4112, 4236, 5890
const orderRes = await callAPI('getOrderInfo', {
  phone: user.phone,
  birthday: user.birthday
});
```

**需要的資料結構**:
```javascript
{
  success: true,
  orders: [
    {
      item: "商品名稱",
      cardNo: "卡號",
      quantity: 1,
      totalFee: 100,
      isCleared: "N",
      isShipped: "N",
      orderDate: "2024-01-01"
    }
  ],
  groupBreaks: [
    {
      breakName: "團拆名稱",
      createdAt: "2024-01-01"
    }
  ]
}
```

### 問題 3: 無法執行抽籤
**原因**: 
- 需要 `checkDailyFortune` 和 `saveDailyFortune` API
- 需要資料表 `daily_fortune`

**修改位置**:
```javascript
// Line 5652, 5698
const res = await callAPI('checkDailyFortune', { phone: String(user.phone) });

// Line 5727
const saveRes = await callAPI('saveDailyFortune', {
  phone: phoneStr,
  date: todayStr,
  selectedNum: selectedNum,
  result: result
});
```

## 🔧 推薦修改步驟

### 步驟 1: 確認資料表結構
```sql
-- 檢查現有資料表
SELECT * FROM products LIMIT 5;
SELECT * FROM orders LIMIT 5;
SELECT * FROM group_breaks LIMIT 5;
SELECT * FROM users LIMIT 5;
```

### 步驟 2: 建立 API Worker（暫時方案）
建立檔案 `/supabase_migration/api_worker.js` 包含所有 16 個端點

### 步驟 3: 修改 worker_supabase.js
```javascript
// 將 API_URL 改為本地 Worker 的 /api 路徑
const API_URL = '/api';  // 而不是 'https://supabase.cnkuoc.workers.dev'
```

### 步驟 4: 在同一個 Worker 中處理 API
```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    
    // API 路由
    if (url.pathname === '/api' && request.method === 'POST') {
      return handleAPI(request);
    }
    
    // 其他請求返回 HTML
    return new Response(HTML_CONTENT, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

async function handleAPI(request) {
  const body = await request.json();
  const { action } = body;
  
  // 根據 action 執行不同邏輯
  switch (action) {
    case 'login':
      return handleLogin(body);
    case 'getProducts':
      return handleGetProducts(body);
    case 'getOrderInfo':
      return handleGetOrderInfo(body);
    // ... 其他 13 個 action
  }
}
```

## 🎬 下一步

我可以幫你：

1. **選項 A**: 建立完整的 API 處理函數（在同一個 Worker 中）
2. **選項 B**: 修改前端直接查詢 Supabase（大幅改寫）
3. **選項 C**: 先建立最小可用版本（只實作登入、商品、訂單）

請告訴我你想採用哪個方案？
