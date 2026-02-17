# 🚨 緊急全面修正報告

## 發現的嚴重問題

### 1. 累積張數查詢限制 ❌
**問題**：
- `supabase.query()` 沒有設定無限制查詢
- 直接用 `fetch` 時 Range header 設定錯誤
- **Supabase 預設只返回前 1000 筆**

**已修正**：
- ✅ 新增 `queryAll()` 方法，設定 `Range: '0-999999'`
- ✅ handleGetProducts 改用 `queryAll()`
- ✅ handleGetOrderInfo 改用 `queryAll()`
- ✅ handleAddOrder 改用 `queryAll()`

---

### 2. 團拆金功能不完整 ⚠️
**問題**：
- handleGetBreakCredit 邏輯簡化過度
- handleUseBreakCredit 只更新第一筆記錄
- 缺少 `used_for_breaks` 欄位更新

**需要修正**：
- 查詢方式：應該用 nickname 直接查詢（不用 user_id）
- 計算邏輯：遍歷所有記錄，累加可用餘額
- 使用邏輯：按順序扣除，更新多筆記錄

---

### 3. 出貨記錄功能 ⚠️
**當前狀態**：
```javascript
async function handleCreateShipmentRecord(body, supabase) {
  const { phone, items } = body;
  // 基本實作，缺少完整邏輯
}
```

**backend.js 原始邏輯**：
- 驗證用戶
- 建立出貨記錄
- 更新訂單狀態
- 發送 Email 通知
- 計算運費

---

### 4. 每日抽籤功能 ⚠️
**當前狀態**：基本實作

**backend.js 原始邏輯**：
- 檢查今日是否已抽過
- 隨機抽籤（1-100）
- 根據結果給予團拆金
- 記錄抽籤歷史

---

### 5. 付款通知功能 ⚠️
**當前狀態**：
```javascript
async function handleNotifyPaymentBulk(body, supabase) {
  // 只插入 order_history
  // 缺少暫存表邏輯
}
```

**backend.js 原始邏輯**：
- 發送 Email 通知
- 寫入「付款通知暫存」表
- 返回 disabledKeys（前端用於禁用按鈕）

---

## 修正優先級

### 🔴 P0 - 立即修正（影響核心功能）
1. ✅ 累積張數查詢（已修正）
2. ⚠️ 價格自動調整邏輯（需驗證）
3. ⚠️ 下單後更新舊訂單價格（需驗證）

### 🟡 P1 - 高優先級（影響常用功能）
4. ⚠️ 團拆金功能完整實作
5. ⚠️ 付款通知功能完整實作
6. ⚠️ 訂單狀態更新功能

### 🟢 P2 - 中優先級（次要功能）
7. ⚠️ 出貨記錄功能
8. ⚠️ 每日抽籤功能
9. ⚠️ 團拆相關功能

---

## 具體修正項目

### ✅ 已完成
1. SupabaseClient 加入 `queryAll()` 方法
2. handleGetProducts 使用 queryAll 查詢所有訂單
3. handleGetOrderInfo 使用 queryAll 計算累積
4. handleAddOrder 使用 queryAll 計算累積和更新價格

### ⚠️ 待完成
1. **團拆金功能**：
   - handleGetBreakCredit 改為完整邏輯
   - handleUseBreakCredit 支援多筆記錄扣除
   
2. **付款通知功能**：
   - 加入 Email 發送（或記錄）
   - 寫入 payment_notifications 表
   - 返回 disabledKeys

3. **出貨記錄功能**：
   - 完整的 createShipmentRecord 邏輯
   - 更新訂單寄出狀態
   - 計算運費

4. **每日抽籤功能**：
   - 檢查重複抽籤
   - 抽籤邏輯
   - 給予團拆金獎勵

---

## 測試建議

### 累積張數
```bash
# 測試 1: 查詢商品列表
curl -X POST /api -d '{"action":"getProducts"}'
# 檢查：每個商品的 accumulatedCount 是否正確

# 測試 2: 下單後查詢
curl -X POST /api -d '{"action":"addOrderEntriesToMain", ...}'
curl -X POST /api -d '{"action":"getProducts"}'
# 檢查：累積是否包含新訂單

# 測試 3: 查詢訂單
curl -X POST /api -d '{"action":"getOrderInfo", "phone":"..."}'
# 檢查：每筆訂單的「累積張數」欄位
```

### 價格調整
```bash
# 測試 1: 下單到達門檻
# 設定：商品門檻 = 10 張，當前累積 = 8 張
curl -X POST /api -d '{"action":"addOrderEntriesToMain", "entries":[{"item":"...", "quantity":3}]}'
# 預期：
# - 新訂單使用門檻價
# - 舊訂單價格自動更新
```

---

## 部署前檢查清單

- [x] queryAll 方法正確實作
- [x] 所有累積張數查詢改用 queryAll
- [ ] 團拆金功能完整實作
- [ ] 付款通知功能完整實作
- [ ] 出貨記錄功能完整實作
- [ ] 每日抽籤功能完整實作
- [ ] 價格調整邏輯驗證通過
- [ ] 前端測試通過
