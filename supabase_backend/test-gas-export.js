/**
 * 測試 GAS 導出 API
 * 用於驗證 gas_export.js 部署是否正常
 */

import dotenv from 'dotenv';

dotenv.config();

async function testGASExport() {
  const gasUrl = process.env.GAS_EXPORT_URL;
  
  if (!gasUrl) {
    console.error('❌ 請在 .env 設定 GAS_EXPORT_URL');
    process.exit(1);
  }
  
  console.log('🧪 測試 GAS 導出 API');
  console.log(`📍 URL: ${gasUrl}\n`);
  
  const tests = [
    { action: 'exportAllUsers', name: '用戶' },
    { action: 'exportAllOrders', name: '訂單' },
    { action: 'exportAllBreaks', name: '團拆' },
    { action: 'exportAllBreakCredits', name: '團拆金' },
    { action: 'exportAllPayments', name: '付款記錄' }
  ];
  
  for (const test of tests) {
    try {
      console.log(`\n📡 測試: ${test.name}`);
      
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: test.action })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        console.log(`  ✅ 成功! 數量: ${data.count}`);
        
        // 顯示第一筆資料範例
        const dataKey = test.action.replace('exportAll', '').toLowerCase();
        if (data[dataKey] && data[dataKey].length > 0) {
          console.log(`  📝 第一筆範例:`, JSON.stringify(data[dataKey][0], null, 2));
        }
      } else {
        console.log(`  ⚠️  ${data.message}`);
      }
      
    } catch (error) {
      console.error(`  ❌ 錯誤: ${error.message}`);
    }
  }
  
  console.log('\n✅ 測試完成');
}

testGASExport();
