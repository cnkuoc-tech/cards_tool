# Supabase 遷移指南

## 📋 遷移步驟

### 階段 1：建立 Supabase 專案

1. **註冊 Supabase**
   - 前往 https://supabase.com
   - 建立新專案（測試環境）
   - 記錄 Project URL 和 anon key

2. **執行 Schema**
   - 進入 Supabase Dashboard
   - SQL Editor → 貼上 `schema.sql`
   - 執行 SQL 建立所有資料表

3. **設定環境變數**
   ```bash
   export SUPABASE_URL="your-project-url"
   export SUPABASE_KEY="your-anon-key"
   export GAS_URL="your-gas-url"
   ```

### 階段 2：準備資料遷移

1. **在 GAS 後端新增資料導出端點**
   
   在 `backend_test.js` 新增以下函數：
   
   ```javascript
   // 導出所有用戶
   function getAllUsers() {
     var ss = SpreadsheetApp.getActiveSpreadsheet();
     var userSheet = ss.getSheetByName('會員資料');
     // ... 實作邏輯
   }
   
   // 導出所有訂單
   function getAllOrders() {
     var ss = SpreadsheetApp.getActiveSpreadsheet();
     var orderSheet = ss.getSheetByName('Topps_Now_訂購總表');
     // ... 實作邏輯
   }
   
   // 導出所有團拆
   function getAllBreaks() {
     var ss = SpreadsheetApp.getActiveSpreadsheet();
     var breakSheet = ss.getSheetByName('團拆紀錄');
     // ... 實作邏輯
   }
   ```

2. **執行資料遷移**
   ```bash
   npm install @supabase/supabase-js
   node data_migration.js
   ```

### 階段 3：部署新 API

1. **部署 Cloudflare Worker**
   ```bash
   npm install -g wrangler
   wrangler login
   wrangler init supabase-api
   # 將 api_worker.js 內容複製到 src/index.js
   wrangler publish
   ```

2. **設定環境變數**
   在 Cloudflare Workers Dashboard 設定：
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

### 階段 4：修改前端

1. **更新 API URL**
   在 `worker_test.js` 中：
   ```javascript
   // 舊的 GAS URL
   const GAS_URL_OLD = 'https://script.google.com/...';
   
   // 新的 Supabase API URL
   const SUPABASE_API_URL = 'https://your-worker.workers.dev';
   ```

2. **逐步切換 API**
   - 先切換簡單功能（如團拆金查詢）
   - 測試成功後再切換其他功能
   - 保留 GAS 作為備援

### 階段 5：測試與驗證

1. **功能測試清單**
   - [ ] 登入驗證
   - [ ] 訂單查詢
   - [ ] 團拆查詢
   - [ ] 團拆金查詢
   - [ ] 團拆金使用
   - [ ] 綠界付款
   - [ ] 訂單狀態更新

2. **效能測試**
   - 比對 GAS 和 Supabase 的響應時間
   - 測試併發請求

### 階段 6：正式環境部署

1. 建立正式 Supabase 專案
2. 執行相同的遷移流程
3. 更新 `worker.html` 的 API URL
4. 監控錯誤和效能

## 🔧 工具與資源

- **Supabase Dashboard**: 管理資料庫
- **Cloudflare Workers Dashboard**: 管理 API
- **Supabase Studio**: 視覺化查詢資料

## ⚠️ 注意事項

1. **資料備份**
   - 遷移前務必備份 Google Sheets
   - Supabase 也要定期備份

2. **RLS 安全性**
   - 確認 Row Level Security 設定正確
   - 測試各種權限情境

3. **API 金鑰安全**
   - 不要將 anon key 以外的金鑰暴露在前端
   - 使用環境變數管理敏感資訊

4. **漸進式遷移**
   - 不要一次性切換所有功能
   - 保留回退機制

## 📞 問題排查

- 查看 Supabase Logs
- 查看 Cloudflare Workers Logs
- 使用瀏覽器開發者工具追蹤 API 請求

## 📈 優勢

相比 GAS，Supabase 提供：
- ✅ 更快的響應速度
- ✅ 更好的並發處理
- ✅ 標準 SQL 查詢
- ✅ 即時訂閱功能
- ✅ 完整的 REST API
- ✅ 更好的開發體驗
