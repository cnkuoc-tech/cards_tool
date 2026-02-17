/**
 * 檢查工作表的欄位名稱（標題列）
 */

function checkSheetHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = [
    'Topps_Now_訂購總表',
    '每日抽籤紀錄',
    '客戶資料',
    '下單商品',
    '團拆紀錄',
    '團拆金',
    '主訂單',
    '卡片明細',
    '綠界付款記錄',
    '出貨紀錄',
    '訂單歷史紀錄'
  ];
  
  sheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      console.log(`❌ 找不到工作表: ${sheetName}`);
      return;
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const dataRowCount = sheet.getLastRow() - 1;
    
    console.log(`\n📋 ${sheetName} (${dataRowCount} 筆資料)`);
    console.log('欄位: ' + headers.join(' | '));
    
    // 顯示第一筆資料範例
    if (dataRowCount > 0) {
      const firstRow = sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
      console.log('第一筆: ' + firstRow.slice(0, 5).join(' | ') + '...');
    }
  });
}

/**
 * Web API 版本
 */
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetNames = [
      'Topps_Now_訂購總表',
      '團拆紀錄',
      '團拆金',
      '主訂單',
      '訂單歷史紀錄'
    ];
    
    const result = {};
    
    sheetNames.forEach(sheetName => {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const dataRowCount = sheet.getLastRow() - 1;
        
        result[sheetName] = {
          rows: dataRowCount,
          headers: headers,
          firstRow: dataRowCount > 0 ? sheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0] : []
        };
      }
    });
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        sheets: result
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
