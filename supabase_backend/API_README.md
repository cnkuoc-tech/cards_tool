# Supabase Backend API Server

完整實作所有 backend.js 的功能，使用 Supabase 作為資料庫。

## 功能列表

### ✅ 已實作的 API（22 個）

1. **login** - 用戶登入（電話 + 生日驗證）
2. **registerUser** - 新用戶註冊
3. **getOrderCatalog** - 獲取商品目錄
4. **getOrderInfo** - 獲取用戶訂單資訊
5. **addOrderEntriesToMain** - 新增訂單到主表
6. **getPendingPaymentKeys** - 獲取待付款項目
7. **notifyPaymentBulk** - 批量付款通知
8. **submitPaymentNotification** - 單筆付款通知
9. **notifyProfileUpdate** - 更新個人資料
10. **lookupOrderStatus** - 查詢訂單狀態
11. **getBreakCredit** - 獲取團拆金
12. **useBreakCredit** - 使用團拆金
13. **submitPsaOrder** - 提交 PSA 訂單
14. **lookupPsaOrders** - 查詢 PSA 訂單
15. **checkDailyFortune** - 檢查每日抽籤
16. **saveDailyFortune** - 儲存每日抽籤結果
17. **createShipmentRecord** - 建立出貨記錄
18. **getShipmentRecords** - 獲取出貨記錄
19. **createEcpayPayment** - 建立綠界付款（stub）
20. **checkPaymentStatus** - 檢查付款狀態
21. **updateOrderStatusToPending** - 更新訂單狀態為待確認
22. **updateBreakStatusToPending** - 更新團拆狀態為待確認

## 啟動伺服器

\`\`\`bash
cd /Users/kuoch/NINGSCARDGASDEMO/supabase_backend
npm start
\`\`\`

## 測試 API

\`\`\`bash
# 獲取商品目錄
curl -X POST http://localhost:3000/api -H "Content-Type: application/json" -d '{"action":"getOrderCatalog","requestingUser":"test"}'

# 用戶登入
curl -X POST http://localhost:3000/api -H "Content-Type: application/json" -d '{"action":"login","phone":"0975313096","birthday":"1998/09/27"}'
\`\`\`

## 資料遷移狀態

✅ 所有 10 個資料表已完成遷移（26,000+ 筆資料）
✅ user_id 關聯建立完成（>96% 關聯率）
