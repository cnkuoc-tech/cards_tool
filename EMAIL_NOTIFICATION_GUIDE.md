# Email 通知功能說明

## 📧 已實現的 Email 通知

### 1. ✅ 客戶下單通知（已存在）
**觸發時機**：客戶在前台下訂單時

**收件人**：商家 (ningscard@gmail.com)

**內容**：
- 客戶暱稱、電話
- 訂單明細（商品、數量、單價、小計）
- 總金額

**狀態**：✅ 已實現

---

### 2. 🆕 付款通知（新增）
**觸發時機**：客戶提出付款通知時（不包含綠界刷卡）

**收件人**：商家 (ningscard@gmail.com)

**內容**：
- 客戶暱稱、電話
- 付款項目明細
- 帳號後五碼
- 付款日期
- 備註
- 總金額

**函數**：`sendPaymentNotificationEmail()`

**狀態**：✅ 新增完成

---

### 3. 🆕 出貨通知（新增）
**觸發時機**：管理員填寫物流單號並更新時

**收件人**：客戶（需要有填寫 email）

**內容**：
- 出貨單號
- 物流單號
- 收件門市
- 出貨商品列表
- 7-11 物流查詢連結

**函數**：`sendShipmentNotificationEmail()`

**狀態**：✅ 新增完成

**特點**：
- 只有客戶有填寫 email 才會寄送
- 只有填寫了物流單號才會觸發
- Email 發送失敗不會影響物流單號更新

---

## 🔧 技術實現

### API 服務
使用 **Resend API** 寄送 email

**API Key**: `re_9eMazG8M_NZZGeeT4DTWXMCAs3UGyBQWS`

**寄件者**: `Ning Card Store <onboarding@resend.dev>`

### 相關函數

1. **sendOrderNotificationEmail()** - 訂單通知
   - 位置：worker.js line ~1158
   - 在 `handleAddOrders()` 中調用

2. **sendPaymentNotificationEmail()** - 付款通知 (NEW)
   - 位置：worker.js line ~1210
   - 在 `handleNotifyPaymentBulk()` 中調用

3. **sendShipmentNotificationEmail()** - 出貨通知 (NEW)
   - 位置：worker.js line ~1260
   - 在 `handleBatchUpdateTrackingNumbers()` 中調用

---

## 📝 使用流程

### 付款通知流程
1. 客戶在前台選擇未結清項目
2. 填寫付款資訊（帳號後五碼、金額、日期、備註）
3. 提交付款通知
4. 系統自動寄送 email 給商家 ✉️
5. 商家收到通知後登入後台確認

### 出貨通知流程
1. 商家在後台「出貨管理」建立出貨紀錄
2. 上傳 CSV 批次更新物流單號
3. 系統自動檢查：
   - ✅ 是否有填寫物流單號
   - ✅ 客戶是否有留 email
4. 符合條件則自動寄送出貨通知給客戶 ✉️
5. 客戶收到 email 可直接查詢物流

---

## 🔍 測試方法

### 測試付款通知 Email
1. 登入前台會員
2. 進入「會員付款」頁面
3. 選擇未結清項目
4. 填寫付款資訊並送出
5. 檢查商家信箱 (ningscard@gmail.com)

### 測試出貨通知 Email
1. 確保客戶資料有填寫 email
2. 在後台建立該客戶的出貨紀錄
3. 使用 CSV 批次更新功能
4. 上傳包含物流單號的 CSV
5. 檢查客戶信箱

---

## ⚠️ 注意事項

1. **Email 發送失敗不會影響主要功能**
   - 付款通知：即使 email 失敗，付款記錄仍會保存
   - 出貨通知：即使 email 失敗，物流單號仍會更新

2. **出貨通知條件**
   - 客戶必須有填寫 email（`users.email` 欄位）
   - 必須有填寫物流單號（`tracking_no` 不為空）
   - 兩個條件都滿足才會寄送

3. **Resend API 限制**
   - 免費方案：每月 3,000 封
   - 寄件者固定：`onboarding@resend.dev`
   - 如需自訂寄件者，需要驗證網域

4. **日誌追蹤**
   - 所有 email 發送都有 console.log
   - 可透過 `wrangler tail` 查看即時日誌

---

## 🎯 未來可擴充功能

- [ ] 訂單完成通知（付款確認後）
- [ ] 到貨通知（商品到貨時）
- [ ] 團拆開獎通知（抽籤完成時）
- [ ] 折扣活動通知
- [ ] 生日優惠通知

---

## 📞 相關資料

**Resend 文檔**: https://resend.com/docs

**API Endpoint**: https://api.resend.com/emails

**Dashboard**: https://resend.com/emails
