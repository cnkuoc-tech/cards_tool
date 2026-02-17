# 全面功能修正計畫

## 問題診斷

### 1. 累積張數問題 ⚠️
**原始邏輯 (backend.js)**:
- Google Sheets 的 `已訂單卡張數` 欄位是**公式自動計算**的
- 公式: `=SUMIF(訂購總表!$C:$C, A2, 訂購總表!$D:$D)` 
- 每次查詢時直接讀取這個公式計算後的值

**當前問題 (Supabase)**:
- `product_catalog.ordered_quantity` 是遷移時的靜態值
- 下單後手動更新 `ordered_quantity`，但邏輯有誤
- 需要改為每次查詢時動態計算

### 2. 價格調整邏輯 ⚠️
**原始邏輯**:
- 檢查「全站累積」>= 門檻
- 達到後更新**該用戶所有該商品的訂單**價格（除了手動調價的）

**當前問題**:
- 只在下單時調整新訂單價格
- 沒有回頭更新舊訂單

### 3. 其他功能檢查清單

#### ✅ 登入功能 (handleLogin)
- 查詢 users 表
- 匹配 phone + birthday
- 返回用戶資訊

#### ⚠️ 註冊功能 (handleRegisterUser)
- 檢查欄位對應
- 檢查重複註冊邏輯

#### ⚠️ 商品目錄查詢 (handleGetProducts)
- 累積張數計算方式
- is_available 判斷邏輯
- 返回欄位完整性

#### ⚠️ 訂單查詢 (handleGetOrderInfo)
- 訂單列表
- 團拆列表
- 付款通知標記
- 全站累積數量

#### ⚠️ 下單功能 (handleAddOrder)
- 商品開放檢查
- 價格調整邏輯
- 圖片/到貨狀態
- **更新舊訂單價格**（缺少）
- 累積張數更新

#### ⚠️ 付款相關
- getPendingPaymentKeys
- notifyPaymentBulk
- submitPaymentNotification
- updateOrderStatusToPending
- updateBreakStatusToPending

#### ⚠️ 其他功能
- 團拆金
- PSA 訂單
- 每日抽籤
- 出貨記錄
- 綠界付款

## 修正策略

### 階段 1: 核心功能修正（優先）
1. **累積張數邏輯**
   - 移除手動更新 ordered_quantity
   - 改為每次查詢時動態計算
   - 加入快取機制（可選）

2. **價格調整完整實作**
   - 下單時檢查是否達到門檻
   - 達到門檻時更新該用戶所有該商品訂單
   - 跳過手動調價的訂單

3. **訂單查詢完整實作**
   - 返回所有必要欄位
   - 計算全站累積
   - 標記付款通知

### 階段 2: 功能完整性檢查
1. 逐一檢查所有 API 函數
2. 對比 backend.js 的邏輯
3. 補全缺少的功能

### 階段 3: 測試與驗證
1. 測試下單流程
2. 測試價格調整
3. 測試累積張數顯示
4. 測試付款流程

## 具體修正項目

### 修正 1: handleGetProducts - 動態計算累積張數
```javascript
// 每次查詢時從 orders 加總
const ordersUrl = `${supabase.url}/rest/v1/orders?select=item,card_no,quantity`;
const ordersResp = await fetch(ordersUrl, { headers: {...}, Range: '0-99999' });
const allOrders = await ordersResp.json();

const accumulatedMap = new Map();
allOrders.forEach(order => {
  const key = order.item + '||' + order.card_no;
  accumulatedMap.set(key, (accumulatedMap.get(key) || 0) + order.quantity);
});
```

### 修正 2: handleAddOrder - 完整價格調整邏輯
```javascript
// 1. 下單前計算累積
// 2. 判斷是否達到門檻
// 3. 達到門檻時:
//    a. 新訂單使用門檻價
//    b. 更新該用戶所有該商品舊訂單價格（跳過手動調價）
```

### 修正 3: handleGetOrderInfo - 完整訂單資訊
```javascript
// 返回:
// - 訂單列表（含圖片、到貨狀態、累積張數）
// - 團拆列表
// - 付款通知標記
// - 用戶資訊
```

## 預期結果
- ✅ 累積張數正確顯示（即時計算）
- ✅ 價格自動調整（新舊訂單都更新）
- ✅ 訂單資料完整
- ✅ 所有功能對應原始 backend.js
