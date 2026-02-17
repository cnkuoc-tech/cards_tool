# 綠界金流除錯檢查清單

## 🔧 已修復的問題

### 1. ✅ API_URL 修正
- **問題**: index.html 使用 `supabase.cnkuoc.workers.dev`（錯誤的 worker）
- **修正**: 改為 `supabase-api.cnkuoc.workers.dev`
- **位置**: index.html 第 1758 行

### 2. ✅ 資料表欄位對應
- **問題**: worker.js 使用的欄位名稱與 Supabase 表不符
- **修正**: 
  - `amount` → `trade_amt`
  - `item_name` → `item_name` (保持不變)
  - `custom_field_1` → `order_ids`
  - `custom_field_2` → (移除，使用 user_id 外鍵)
  - 新增: `user_id` 關聯到 users 表
- **位置**: worker.js 第 1685-1703 行

### 3. ✅ /ecpay-callback 路由
- **已新增**: 專用的回調處理路由
- **位置**: worker.js 第 2028-2056 行
- **功能**: 接收綠界 POST 回傳，驗證簽章，更新資料庫

### 4. ✅ ReturnURL 設定
- **設定值**: `https://supabase-api.cnkuoc.workers.dev/ecpay-callback`
- **位置**: worker.js 第 1671 行

---

## 🧪 測試步驟

### 前置準備
1. ✅ 部署 worker.js 到 `supabase-api.cnkuoc.workers.dev`
2. ✅ 部署 index.html 的修正版本
3. ⏳ 確認 Supabase `ecpay_records` 表欄位已重新命名

### 步驟 1: 驗證 API 連線
```javascript
// 在瀏覽器主控台執行
fetch('https://supabase-api.cnkuoc.workers.dev/api', {
  method: 'POST',
  body: JSON.stringify({ action: 'login', password: 'ning123' }),
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(console.log);
```
**期望結果**: `{ success: true, message: '登入成功', token: '...' }`

### 步驟 2: 驗證 createEcpayPayment
```javascript
// 準備參數
const payload = {
  action: 'createEcpayPayment',
  phone: '0912345678',  // 換成你的測試手機號
  nickname: '測試用戶',
  totalAmount: 100,     // NT$ 100
  itemName: '測試商品',
  orderIds: ['TEST001'],
  orderDetails: [],
  paymentType: 'order'
};

// 發送請求
fetch('https://supabase-api.cnkuoc.workers.dev/api', {
  method: 'POST',
  body: JSON.stringify(payload),
  headers: { 'Content-Type': 'application/json' }
}).then(r => r.json()).then(res => {
  console.log('Response:', res);
  if (res.success && res.paymentUrl) {
    console.log('✅ 支付表單準備成功');
    console.log('Payment URL:', res.paymentUrl);
    console.log('Params:', res.params);
  }
});
```
**期望結果**: 
- `success: true`
- `paymentUrl: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'`
- `params` 包含所有必要的綠界參數
- `params.CheckMacValue` 已生成

### 步驟 3: 驗證 ecpay_records 表
```sql
-- 在 Supabase SQL 編輯器執行
SELECT * FROM ecpay_records 
ORDER BY created_at DESC 
LIMIT 10;
```
**期望結果**: 應該看到新建立的付款記錄，包含：
- `merchant_trade_no` (格式: NC + 時間戳)
- `user_id` (UUID)
- `trade_amt` (100)
- `item_name` ('測試商品')
- `status` ('pending')

### 步驟 4: 綠界支付表單提交
1. 進入官網選擇商品結帳
2. 點「💳 信用卡(綠界)」
3. 應該會看到表單自動提交，進入綠界付款頁面
4. 輸入測試卡號 `4111-1111-1111-1111`（會成功）或 `4012-8888-8888-8888`（會失敗）

**可能的問題**:
- ❌ CSP 錯誤 → 這是綠界頁面的問題，不影響我們的邏輯
- ❌ 金額驗證失敗 → 檢查金額是否在 NT$1-20,000 範圍內
- ❌ CheckMacValue 錯誤 → 檢查 HashKey 和 HashIV 是否正確

### 步驟 5: 驗證付款回調
付款完成後，檢查：

```sql
-- 檢查 ecpay_records 是否已更新
SELECT * FROM ecpay_records 
WHERE status = 'success' 
ORDER BY payment_date DESC;

-- 檢查 notifications 是否已建立
SELECT * FROM notifications 
WHERE type = 'payment' 
ORDER BY created_at DESC;
```

**期望結果**:
- `ecpay_records.status` = 'success'
- `ecpay_records.trade_no` = 綠界交易編號
- `ecpay_records.payment_date` = 付款時間
- `notifications` 新增一筆支付通知

---

## 📋 完整的參數流程

### Frontend → Backend (createEcpayPayment)
```
index.html 發送:
{
  action: 'createEcpayPayment',
  phone: '使用者電話',
  nickname: '使用者暱稱',
  totalAmount: 金額,
  itemName: '商品名稱',
  orderIds: ['訂單1', '訂單2'],
  orderDetails: [{...}, {...}],
  paymentType: 'order' | 'break'
}

worker.js 回應:
{
  success: true,
  paymentUrl: '綠界付款 URL',
  params: {
    MerchantID: '3002607',
    MerchantTradeNo: 'NC1707xxx',
    TotalAmount: 金額,
    ItemName: '商品名稱',
    CheckMacValue: '簽章值',
    ReturnURL: 'https://supabase-api.cnkuoc.workers.dev/ecpay-callback',
    ClientBackURL: 'https://supabasedemo-dnd.pages.dev/',
    ... (其他綠界參數)
  },
  merchantTradeNo: 'NC1707xxx'
}
```

### Backend → Supabase (ECPay Payment Record)
```
ecpay_records 表:
{
  id: uuid,
  merchant_trade_no: 'NC1707xxx',
  user_id: uuid,              // ✅ 關聯到 users 表
  trade_amt: 金額,             // ✅ 金額
  item_name: '商品名稱',       // ✅ 商品
  status: 'pending',          // ✅ 狀態
  order_ids: 'ID1,ID2',       // ✅ 訂單編號
  order_details: JSON 字串,    // ✅ 明細
  payment_type: 'order',
  trade_date: '交易時間',
  created_at: '建立時間'
}
```

### ECPay Callback → Backend (回調處理)
```
綠界 POST 到 /ecpay-callback:
{
  MerchantTradeNo: 'NC1707xxx',
  RtnCode: '1' (成功) | '0' (失敗),
  RtnMsg: '交易成功',
  TradeNo: '綠界交易編號',
  Amt: '金額',
  PaymentDate: '付款時間',
  CheckMacValue: '簽章值',
  ... (其他參數)
}

worker.js 更新:
- ecpay_records 的 status, trade_no, payment_date, trade_amt
- 如果成功，新增 notifications 記錄
```

---

## 🚨 常見問題

### 問題 1: "缺少必要參數：phone 或 totalAmount"
**原因**: 前端沒有傳送 phone 或 totalAmount
**解決**: 檢查 processEcpayPayment() 是否正確構建 payload

### 問題 2: "測試環境金額範圍: NT$1 - NT$20,000"
**原因**: 金額小於 1 元或大於 20,000 元
**解決**: 確認選中的訂單/團拆金額正確

### 問題 3: "找不到該使用者"
**原因**: 該電話號碼的使用者不存在於 users 表
**解決**: 確認用戶已登入，phone 正確

### 問題 4: "CheckMacValue 驗證失敗"
**原因**: 簽章生成錯誤，通常是 HashKey/HashIV 不對
**解決**: 確認 worker.js 的 ECPAY_CONFIG 中 HashKey 和 HashIV 正確

### 問題 5: 綠界頁面顯示 CSP 錯誤
**原因**: 綠界頁面自己的 JavaScript 被 CSP 限制
**解決**: 這是綠界的問題，不影響我們的邏輯，應該可以正常進行支付

---

## ✅ 驗證清單 (部署前必檢)

- [ ] index.html API_URL 已改為 `supabase-api.cnkuoc.workers.dev`
- [ ] worker.js ReturnURL 設定為 `/ecpay-callback`
- [ ] Supabase ecpay_records 表欄位已重新命名
- [ ] worker.js 已部署到 `supabase-api.cnkuoc.workers.dev`
- [ ] 前端已部署最新版本
- [ ] 測試使用者已在 Supabase users 表建立
- [ ] 綠界測試帳號 HashKey 和 HashIV 正確

---

## 🔗 重要連結

- **Supabase Dashboard**: https://app.supabase.com
- **ECPay Test Gateway**: https://payment-stage.ecpay.com.tw
- **Cloudflare Workers**: https://dash.cloudflare.com
- **Test Card Success**: 4111-1111-1111-1111
- **Test Card Fail**: 4012-8888-8888-8888
