const puppeteer = require('puppeteer');

(async () => {
  // 啟動瀏覽器
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox'] 
  });

  const page = await browser.newPage();
  
  // ★★★ 目標網址 ★★★
  const targetUrl = 'https://www.topps.com/products/2025-bowman-draft-baseball-mega-box';
  
  console.log(`正在前往: ${targetUrl}`);

  try {
      // 設定 60秒超時
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
      console.log("網頁載入稍微超時，繼續執行...");
  }

  // ==========================================
  // ★★★ 暫停 60 秒讓您手動驗證 ★★★
  // ==========================================
  console.log("------------------------------------------------");
  console.log("🚨 腳本暫停中！請您現在手動去點 Cloudflare 驗證勾勾 (60秒)");
  console.log("------------------------------------------------");

  await new Promise(r => setTimeout(r, 60000));

  console.log("🚀 時間到！繼續嘗試自動購買...");

  // 嘗試點擊購買
  try {
      const buttons = await page.$$('button');
      let clicked = false;
      for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent, button);
          if (text && text.toLowerCase().includes('add to cart')) {
              await button.click();
              clicked = true;
              console.log("✅ 已點擊 Add to Cart！");
              break;
          }
      }
      if (!clicked) {
          console.log("⚠️ 沒找到按鈕，請手動購買！");
      }
  } catch (error) {
      console.log("錯誤:", error);
  }
})();