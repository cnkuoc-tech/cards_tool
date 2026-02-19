# 🔥 用戶識別改進 - 電話號碼優先匹配

## 變更摘要

優先使用 **電話號碼** 而不是 **暱稱** 進行用戶識別，確保團拆支付時更新正確的用戶記錄。

## 問題背景

在多用戶共同訂購同一團拆（同一 break_id）的情況下，後端之前使用暱稱進行用戶查詢，但如果系統中存在多個相同暱稱的用戶，可能導致：
1. 查詢返回錯誤的 user_id
2. 無法精確匹配 break_id + user_id
3. 不得不使用備用方案（fallback strategy），更新了錯誤用戶的團拆狀態

## 解決方案

### 前端修改 ✅
**文件**: `separated/frontend/index.html`

#### 修改 1: 添加 phone 到團拆付款明細
```javascript
// 第 4615-4626 行
orderDetails.push({
  nickname: user.nickname,
  phone: user.phone,  // 🔥 新增：用於精確識別用戶
  breakId: breakId,
  breakName: breakItem.name || breakItem['團名'] || '',
  balance: balance
});
```

**影響**: 團拆支付時，前端現在會同時傳送用戶電話號碼給後端。

### 後端修改 ✅
**文件**: `backend/worker.js`

#### 修改 1: updateBreakStatusToPending() - 優先使用 phone
```javascript
// 第 1966-1982 行
for (const detail of details) {
  const { nickname, phone, breakId } = detail;  // 解構 phone
  
  // 🔥 優先使用 phone 查詢用戶 ID
  let userId = null;
  if (phone) {
    // 按電話查詢用戶 ID
    const usersUrl = `...users?select=id&phone=eq.${encodeURIComponent(phone)}`;
    // 查詢邏輯...
    userId = users[0].id;
  }
  
  // 如果沒有 phone 或查詢失敗，再試 nickname（備用）
  if (!userId && nickname) {
    // 按暱稱查詢...
  }
}
```

**改進點**:
- ✅ 優先使用電話號碼（最可靠的識別方式）
- ✅ 在電話查詢失敗時降級到暱稱
- ✅ 保留診斷日誌

#### 修改 2: handleUpdateOrderStatusToFailed() - 相同邏輯
```javascript
// 第 2210-2215 行
// 🔥 優先使用 phone 查詢用戶 ID
if (phone) {
  const usersUrl = `...users?select=id&phone=eq.${encodeURIComponent(phone)}`;
  // 查詢邏輯...
}

// 備用方案：暱稱查詢
if (!userId && nickname) {
  // 查詢邏輯...
}
```

**影響**: 支付失敗時，現在也優先使用電話進行用戶匹配。

#### 修改 3: handlePaymentNotification() - 已使用 phone ✅
該函數已經使用 `phone` 進行用戶查詢，無需修改。

## 測試計劃

### 測試場景 1: 單用戶團拆支付（簡單情況）✅
```
用戶: A (phone: 0912345678, nickname: Alice)
團拆: Ning-088 (只有 A 一個人)
支付: 尾款 500 元

預期:
1. 前端發送: {phone: "0912345678", nickname: "Alice", breakId: "Ning-088"}
2. 後端用 phone 查詢到 user_id = UUID_A
3. 精確匹配 Ning-088 + UUID_A 成功 ✅
4. 更新該記錄狀態為「付款確認中」
5. 日誌顯示: "🔥 使用 phone 找到 user_id: UUID_A"
```

### 測試場景 2: 多用戶同一團拆支付（複雜情況）⭐
```
用戶: A (phone: 0912345678, nickname: Alice)
用戶: B (phone: 0923456789, nickname: Alice)  // 相同暱稱！
團拆: Ning-024 (A 和 B 都訂購)
支付: B 支付尾款 500 元

舊邏輯問題:
1. 暱稱查詢: nickname = "Alice" → 可能返回 A 的 user_id
2. 無法匹配 Ning-024 + UUID_A（因為 B 訂購，不是 A）
3. 使用備用方案更新第一筆記錄（可能是 A 的）→ 錯誤！

新邏輯修復:
1. 前端發送: {phone: "0923456789", nickname: "Alice", breakId: "Ning-024"}
2. 後端用 phone 查詢到 user_id = UUID_B（精確！）
3. 精確匹配 Ning-024 + UUID_B 成功 ✅
4. 更新 B 的記錄，不會誤改 A
5. 日誌顯示: "🔥 使用 phone 找到 user_id: UUID_B"
```

### 測試場景 3: 支付失敗流程
```
預期: 與成功流程相同，使用 phone 進行精確匹配
日誌顯示: "🔥 使用 phone 找到用戶 ID: UUID_X"
```

## 驗證清單

### 後端日誌檢查
- [ ] 看到 `[UPDATE_BREAK] 🔥 使用 phone 找到 user_id: ...` → 電話匹配成功
- [ ] **不**看到使用備用方案的日誌 → 精確匹配成功
- [ ] 查詢結果顯示正確的 user_id

### 資料庫驗證
```sql
-- 檢查更新的記錄
SELECT break_id, user_id, status, updated_at 
FROM breaks 
WHERE break_id = 'Ning-088' 
ORDER BY updated_at DESC 
LIMIT 10;

-- 應看到:
-- break_id | user_id | status | updated_at
-- Ning-088 | UUID_B  | 付款確認中 | 2024-12-XX HH:MM:SS
```

### 多所有者團拆檢查
```sql
-- 查看有多個所有者的團拆
SELECT break_id, COUNT(*) as owner_count
FROM breaks
GROUP BY break_id
HAVING COUNT(*) > 1;

-- 對這些團拆進行支付測試，驗證各自獨立更新
```

## 部署步驟

1. **複製修改**
   ```bash
   cp backend/worker.js cloudflare-worker-complete.js
   ```

2. **上傳到 Cloudflare Worker Dashboard**
   - 打開 https://dash.cloudflare.com
   - 進入 Workers
   - 找到 `supabase_cnkuoc`
   - 貼上 `cloudflare-worker-complete.js` 的內容
   - 點擊「Save and Deploy」

3. **驗證部署**
   - 查看 Logs 標籤
   - 執行一次支付測試
   - 確認日誌中看到 `🔥 使用 phone 找到 user_id`

## 效果評估

### 改進點
- ✅ 消除了暱稱重複導致的錯誤匹配
- ✅ 提高了多用戶共同訂購場景的準確性
- ✅ 保留了備用方案作為安全網

### 向後相容性
- ✅ 如果前端沒有發送 phone（舊版本），系統自動降級到 nickname
- ✅ 現有代碼不會中斷

### 性能影響
- 💚 零性能影響（一個額外的 API 查詢被優先執行）

## 後續優化建議

1. **移除備用方案** (Phase 2)
   - 確保所有生產環境都使用新前端版本
   - 驗證無誤後，移除備用方案的 fallback 邏輯

2. **使用手機號碼驗證** (Phase 3)
   - 確保用戶註冊時提供有效手機號
   - 添加手機號碼驗證邏輯

3. **日誌分析** (Ongoing)
   - 監控是否有大量 fallback 觸發
   - 識別仍在使用舊前端的客戶端

## 相關代碼參考

### 使用 phone 的三個關鍵函數

1. **handleUpdateBreakStatusToPending()** - 支付成功時更新團拆
2. **handleUpdateOrderStatusToFailed()** - 支付失敗時更新
3. **handlePaymentNotification()** - 用戶手動提交支付通知
