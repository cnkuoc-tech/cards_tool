/**
 * 列出 Google Sheets 中所有工作表名稱
 * 在 Google Sheets 的 Apps Script 中執行此函數
 */

function listAllSheetNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  console.log('工作表列表:');
  sheets.forEach((sheet, index) => {
    const name = sheet.getName();
    const rowCount = sheet.getLastRow();
    const colCount = sheet.getLastColumn();
    console.log(`${index + 1}. ${name} (${rowCount} 列 x ${colCount} 欄)`);
  });
  
  return sheets.map(s => ({
    name: s.getName(),
    rows: s.getLastRow(),
    cols: s.getLastColumn()
  }));
}

function doGet() {
  const sheetList = listAllSheetNames();
  
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      sheets: sheetList
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
