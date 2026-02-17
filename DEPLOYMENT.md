# Cloudflare Workers 部署指南

## 📌 使用檔案
**使用 `worker_supabase_integrated.js`**（完整版，包含所有功能）

## ✅ 功能清單
- ✅ 完整前端介面（7376 行）
- ✅ 動態累積張數計算（從訂單實時加總）
- ✅ 卡盒訂購功能
- ✅ 倒數計時器
- ✅ 18 個後端 API handlers
- ✅ Supabase 資料庫整合
- ✅ 購物車、會員系統、PSA 鑑定、團拆金

## 🚀 部署步驟

### 方法 1: Cloudflare Dashboard（推薦）

1. **登入 Cloudflare Dashboard**
   - 前往 https://dash.cloudflare.com/
   - 登入你的帳號

2. **建立 Worker**
   - 左側選單：Workers & Pages
   - 點擊「Create application」
   - 選擇「Create Worker」
   - 輸入 Worker 名稱（例如：`ningscards`）
   - 點擊「Deploy」

3. **貼上程式碼**
   - 點擊「Edit code」
   - 刪除預設程式碼
   - 複製 `worker_supabase_integrated.js` 的**完整內容**
   - 貼上到編輯器
   - 點擊「Save and deploy」

4. **設定環境變數**（重要！）
   - 回到 Worker 設定頁面
   - Settings → Variables
   - 新增以下環境變數：
   
   ```
   SUPABASE_URL = https://your-project.supabase.co
   SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. **測試**
   - 點擊 Worker URL（例如：https://ningscards.yourusername.workers.dev）
   - 應該會看到完整的網站介面

### 方法 2: Wrangler CLI

1. **安裝 Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **登入 Cloudflare**
   ```bash
   wrangler login
   ```

3. **建立 wrangler.toml**
   ```toml
   name = "ningscards"
   main = "worker_supabase_integrated.js"
   compatibility_date = "2024-01-01"

   [vars]
   # 在 Cloudflare Dashboard 設定 Secrets，不要寫在這裡
   ```

4. **設定 Secrets**
   ```bash
   wrangler secret put SUPABASE_URL
   # 輸入: https://your-project.supabase.co
   
   wrangler secret put SUPABASE_ANON_KEY
   # 輸入: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

5. **部署**
   ```bash
   wrangler deploy
   ```

## 🔧 取得 Supabase 環境變數

1. **登入 Supabase**
   - 前往 https://supabase.com/
   - 選擇你的專案

2. **取得憑證**
   - Settings → API
   - **Project URL**: 複製 `URL`（例如：https://xxxxx.supabase.co）
   - **anon/public key**: 複製 `anon public` 金鑰

## ⚠️ 常見問題

### Q: API 回應空白？
A: 確認環境變數已正確設定，檢查 Cloudflare Workers 控制台的 Logs。

### Q: 累積張數不正確？
A: `worker_supabase_integrated.js` 已修正此問題，會從 `orders` 資料表實時計算。

### Q: 卡盒訂單無法顯示？
A: 確認 `product_catalog` 資料表中有 `is_box_preorder = 'true'` 的商品。

### Q: 倒數計時器不顯示？
A: 確認商品有設定 `scheduled_delist_time` 欄位。

## 📊 資料庫結構需求

### 必要資料表

1. **users** (會員資料)
   - phone, nickname, birthday, real_name, email, address, ship_store

2. **product_catalog** (商品目錄)
   - item_name, card_no, price, threshold_price, discount_threshold
   - image_url_1, image_url_2, image_url_3, image_url_4
   - is_box_preorder, can_direct_order, is_available
   - stock_status, scheduled_delist_time

3. **orders** (訂單)
   - phone, item, card_no, quantity, price, total_fee
   - deposit, balance, status, arrival_status, payment_notified

4. **break_credits** (團拆金)
   - nickname, break_id, break_name, total_fee, balance, status

## 🎉 完成！

部署完成後，你的卡片商店就可以正常運作了！

網站 URL: `https://你的worker名稱.你的用戶名.workers.dev`
