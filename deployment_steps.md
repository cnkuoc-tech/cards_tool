# 建立新的 GAS 部署

由於更新現有部署似乎沒有生效，請建立全新的部署：

## 步驟：

1. 在 Apps Script 編輯器中，點選「部署」→「新增部署作業」

2. 選擇類型：
   - 點選「齒輪」圖示（選取類型）
   - 選擇「網頁應用程式」

3. 填寫說明：
   - 說明：Production Export API v2

4. 設定：
   - 執行身分：我 (cnkuoc@gmail.com)
   - 具有存取權的使用者：**所有人**

5. 點選「部署」

6. 授權（如果需要）：
   - 點選「授權存取權」
   - 選擇你的 Google 帳號
   - 點選「進階」
   - 點選「前往 [專案名稱]（不安全）」
   - 點選「允許」

7. **複製新的網址**（很重要！）
   格式：https://script.google.com/macros/s/[新的ID]/exec

8. 回到終端機，執行以下命令更新 .env：
   ```bash
   cd /Users/kuoch/NINGSCARDGASDEMO/supabase_backend
   nano .env
   ```
   
9. 將 GAS_EXPORT_URL 改為新的網址

10. 儲存（Ctrl+O, Enter, Ctrl+X）

11. 測試新 API：
    ```bash
    node check_sheets.js
    ```

12. 如果成功，執行遷移：
    ```bash
    npm run migrate
    ```
