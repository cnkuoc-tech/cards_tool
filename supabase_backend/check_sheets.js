/**
 * 檢查 Google Sheets 工作表資料
 * 用於診斷為什麼某些表匯出為空
 */

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwBvS9IKETukD6HkwyJnzp-svpN1LepM7Vxo9r2xkMzVRm01RRHkrikdhol5CoudfFh/exec';

async function checkSheetData(action) {
  console.log(`\n📋 檢查 ${action}...`);
  
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      console.log(`❌ 失敗: ${data.message}`);
      return;
    }
    
    // 取得資料陣列
    const key = Object.keys(data).find(k => Array.isArray(data[k]));
    const items = data[key] || [];
    
    console.log(`✅ 成功取得 ${data.count || items.length} 筆`);
    
    if (items.length > 0) {
      console.log('📄 第一筆資料範例:');
      console.log(JSON.stringify(items[0], null, 2));
    }
    
  } catch (error) {
    console.log(`❌ 錯誤: ${error.message}`);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   Google Sheets 資料檢查工具        ║');
  console.log('╚══════════════════════════════════════╝');
  
  await checkSheetData('exportAllUsers');
  await checkSheetData('exportAllOrders');
  await checkSheetData('exportAllProducts');
  await checkSheetData('exportAllBreaks');
  await checkSheetData('exportAllBreakCredits');
  await checkSheetData('exportAllPayments');
  await checkSheetData('exportAllPSAOrders');
  await checkSheetData('exportAllPSACards');
  await checkSheetData('exportAllShipments');
  await checkSheetData('exportToppsNow');
  await checkSheetData('exportLottery');
  await checkSheetData('exportOrderHistory');
}

main();
