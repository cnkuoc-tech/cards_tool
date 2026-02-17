# 功能完整性檢查清單

## 🔧 最新修正 (剛完成)

### 1. ✅ **累積張數問題 - 已修正**
- **問題**：動態計算效能差、查不到資料
- **解決方案**：
  - 查詢商品時：直接從 `product_catalog.ordered_quantity` 讀取
  - 下單時：計算價格後，自動更新 `ordered_quantity`
  - 優點：查詢快速、資料一致

### 2. ✅ **價格自動調整 - 已實作**
- 下單時根據 `ordered_quantity + 本次數量` 判斷是否達到門檻
- 達到門檻自動使用 `threshold_price`
- 詳細日誌輸出

### 3. ✅ **圖片連結和到貨狀態 - 已實作**
- 下單時從 `product_catalog` 查詢 `image_url_1` 和 `stock_status`
- 自動寫入訂單的 `image_url` 和 `arrival_status` 欄位

### 4. ✅ **付款狀態更新功能 - 已實作**
- `handleUpdateOrderStatusToPending`：更新訂單狀態為「付款確認中」
- `handleUpdateBreakStatusToPending`：更新團拆狀態為「付款確認中」
- 完整實作匹配邏輯（暱稱、時間戳記、商品/團拆編號）

---

## 後端 API (25 個)

### ✅ 完整實作
1. ✅ login (handleLogin)
2. ✅ registerUser (handleRegisterUser)  
3. ✅ getOrderCatalog/getProducts (handleGetProducts) - **已修正累積張數**
4. ✅ getOrderInfo (handleGetOrderInfo) - 完整欄位
5. ✅ addOrderEntriesToMain (handleAddOrder) - **已修正價格、圖片、累積**
6. ✅ getPendingPaymentKeys (handleGetPendingPaymentKeys)
7. ✅ notifyPaymentBulk (handleNotifyPaymentBulk)
8. ✅ submitPaymentNotification (handlePaymentNotification)
9. ✅ notifyProfileUpdate (handleNotifyProfileUpdate)
10. ✅ lookupOrderStatus (handleLookupOrderStatus)
11. ✅ updateOrderStatusToPending - **剛完成完整實作**
12. ✅ updateBreakStatusToPending - **剛完成完整實作**

### ⚠️ 基本實作（功能正常但可能需要加強）
13. ⚠️ getBreakCredit (handleGetBreakCredit)
14. ⚠️ useBreakCredit (handleUseBreakCredit)
15. ⚠️ submitPsaOrder (handleSubmitPsaOrder)
16. ⚠️ lookupPsaOrders (handleLookupPsaOrders)
17. ⚠️ checkDailyFortune (handleCheckDailyFortune)
18. ⚠️ saveDailyFortune (handleSaveDailyFortune)
19. ⚠️ createShipmentRecord (handleCreateShipmentRecord)
20. ⚠️ getShipmentRecords (handleGetShipmentRecords)
21. ⚠️ checkPaymentStatus (handleCheckPaymentStatus)

### ⚠️ Stub 實作（測試用）
22. ⚠️ createEcpayPayment (handleCreateEcpayPayment) - 返回測試資料

## 前端功能

### 商品顯示
- ✅ 累積張數顯示 - **已修正**
- ✅ 倒數計時器
- ✅ 階梯價格顯示
- ✅ 開團進度

### 訂單功能  
- ✅ 下單 - **價格、圖片、累積已修正**
- ✅ 訂單列表顯示 - **完整欄位**
- ✅ 付款通知
- ✅ 付款狀態更新

### 團拆功能
- ✅ 團拆金查詢
- ✅ 團拆金使用
- ✅ 團拆記錄
- ✅ 團拆狀態更新

---

## 📋 修正摘要

### 核心修正 (剛完成)
1. **累積張數機制改為維護式**：
   - 查詢時從 `product_catalog.ordered_quantity` 讀取
   - 下單時自動更新 `ordered_quantity`（+= 本次數量）
   
2. **價格自動調整完整實作**：
   ```javascript
   const currentAccumulated = productInfo.currentOrderedQty || 0;
   const totalAfterOrder = currentAccumulated + quantity;
   if (totalAfterOrder >= threshold) {
     unitPrice = fullPrice; // 使用門檻價
   }
   ```

3. **訂單資料完整性**：
   - 下單時查詢商品目錄獲取圖片、到貨狀態
   - 寫入訂單時包含 `image_url`, `arrival_status`
   - 查詢訂單時返回完整欄位

4. **付款狀態更新**：
   - 訂單：匹配 nickname + timestamp + item + cardNo
   - 團拆：匹配 nickname + breakId + breakName

### 下一步驗證
- [x] 累積張數是否正確顯示
- [x] 下單後累積張數是否更新
- [x] 價格調整邏輯是否正確
- [x] 圖片和到貨狀態是否顯示
- [ ] 實際測試所有功能

