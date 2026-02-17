/**
 * 正式環境資料匯出 Apps Script（修正版）
 * 根據實際工作表欄位名稱修正
 * 
 * 部署說明：
 * 1. 在備份 Google Sheets 中打開「擴充功能」→「Apps Script」
 * 2. 將現有的 export_data.gs 內容全部替換為此檔案
 * 3. 儲存後點選「部署」→「管理部署作業」
 * 4. 點選現有部署右側的「鉛筆」圖示編輯
 * 5. 版本選「新版本」
 * 6. 點選「部署」
 */

// 工作表名稱對應
const SHEET_NAMES = {
  TOPPS_NOW: 'Topps_Now_訂購總表',
  LOTTERY: '每日抽籤紀錄',
  SHIPMENT_PENDING: '待出貨清單',
  USERS: '客戶資料',
  PRODUCTS: '下單商品',
  BREAKS: '團拆紀錄',
  PAYMENT_TEMP: '付款通知暫存',
  BREAK_CREDITS: '團拆金',
  MAIN_ORDERS: '主訂單',
  CARD_DETAILS: '卡片明細',
  PSA_PRICING: 'PSA鑑定價格',
  ECPAY_RECORDS: '綠界付款記錄',
  SHIPMENTS: '出貨紀錄',
  ORDER_HISTORY: '訂單歷史紀錄'
};

/**
 * Apps Script Web App 入口
 */
function doPost(e) {
  try {
    const params = JSON.parse(e.postData.contents);
    const action = params.action;
    
    let result;
    
    switch(action) {
      case 'exportAllUsers':
        result = exportAllUsers();
        break;
      case 'exportAllOrders':
        result = exportAllOrders();
        break;
      case 'exportAllProducts':
        result = exportAllProducts();
        break;
      case 'exportAllBreaks':
        result = exportAllBreaks();
        break;
      case 'exportAllBreakCredits':
        result = exportAllBreakCredits();
        break;
      case 'exportAllPayments':
        result = exportAllPayments();
        break;
      case 'exportAllPSAOrders':
        result = exportAllPSAOrders();
        break;
      case 'exportAllPSACards':
        result = exportAllPSACards();
        break;
      case 'exportAllShipments':
        result = exportAllShipments();
        break;
      case 'exportToppsNow':
        result = exportToppsNow();
        break;
      case 'exportLottery':
        result = exportLottery();
        break;
      case 'exportEcpayRecords':
        result = exportEcpayRecords();
        break;
      case 'exportOrderHistory':
        result = exportOrderHistory();
        break;
      default:
        result = {
          success: false,
          message: '未知的 action: ' + action
        };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
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

function doGet(e) {
  return ContentService
    .createTextOutput('Data Export API for Production')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * 取得工作表資料為陣列
 */
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`找不到工作表: ${sheetName}`);
  }
  
  const data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

/**
 * 1. 匯出用戶資料（客戶資料）
 * 欄位: 編號 | 群組暱稱 | 姓名 | 電話 | 生日 | LineID | ...
 */
function exportAllUsers() {
  try {
    const users = getSheetData(SHEET_NAMES.USERS);
    
    const formatted = users.map(user => ({
      phone: String(user['電話'] || '').trim(),
      nickname: String(user['群組暱稱'] || '').trim(),
      realName: String(user['姓名'] || '').trim(),
      email: String(user['email'] || '').trim(),
      address: String(user['收件用門市'] || '').trim(),
      birthday: user['生日'] || null,
      password: String(user['生日'] || '').trim().slice(-4),
      createdAt: new Date().toISOString()
    })).filter(u => u.phone);
    
    return {
      success: true,
      users: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 2. 匯出訂單資料（Topps_Now_訂購總表）
 * 欄位: 時間戳記 | 訂購人 | 聯絡方式 | 品項 | 卡號 | 單價 | 張數 | 總價 | 訂金 | 尾款 | 開單 | 寄出 | 結清 | 狀態 | 到貨狀態 | ...
 */
function exportAllOrders() {
  try {
    const orders = getSheetData(SHEET_NAMES.TOPPS_NOW);
    
    const formatted = orders.map(order => ({
      phone: String(order['聯絡方式'] || '').trim(),
      nickname: String(order['訂購人'] || '').trim(),
      itemName: String(order['品項'] || '').trim(),
      cardNo: String(order['卡號'] || '').trim(),
      quantity: Number(order['張數'] || 0),
      unitPrice: Number(order['單價'] || 0),
      totalFee: Number(order['總價'] || 0),
      deposit: Number(order['訂金'] || 0),
      balance: Number(order['尾款'] || 0),
      isNotified: parseBooleanField(order['開單']),
      isShipped: parseBooleanField(order['寄出']),
      isCleared: parseBooleanField(order['結清']),
      status: String(order['狀態'] || '').trim(),
      arrivalStatus: String(order['到貨狀態'] || '').trim(),
      orderDate: order['時間戳記'] || new Date().toISOString(),
      paymentMethod: String(order['付款方式'] || '').trim(),
      merchantTradeNo: String(order['綠界訂單號'] || '').trim(),
      paymentDate: order['付款時間'] || null,
      notes: String(order['備註'] || '').trim()
    })).filter(o => o.phone || o.nickname);
    
    return {
      success: true,
      orders: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 3. 匯出商品資料（下單商品）
 * 欄位: 品項 | 卡號 | 單價 | 門檻價 | 優惠門檻 | 最低開團張數 | ... | 是否開放 | 圖片連結_1 | 圖片連結_2 | ... | 到貨狀況 | ...
 */
function exportAllProducts() {
  try {
    const products = getSheetData(SHEET_NAMES.PRODUCTS);
    
    const formatted = products.map(product => ({
      itemName: String(product['品項'] || '').trim(),
      cardNo: String(product['卡號'] || '').trim(),
      price: Number(product['單價'] || 0),
      thresholdPrice: Number(product['門檻價'] || 0),
      discountThreshold: Number(product['優惠門檻'] || 0),
      minGroupQuantity: Number(product['最低開團張數'] || 0),
      canDrawSP: product['可抽_SP'] === 'Y' || product['可抽_SP'] === true,
      canDrawSignature: product['可抽_簽名'] === 'Y' || product['可抽_簽名'] === true,
      canDrawRelic: product['可抽_Relic'] === 'Y' || product['可抽_Relic'] === true,
      canDrawAutoRelic: product['可抽_auto_relic'] === 'Y' || product['可抽_auto_relic'] === true,
      isAvailable: product['是否開放'] === 'Y' ? 'Y' : 'N',
      imageUrl1: String(product['圖片連結_1'] || '').trim(),
      imageUrl2: String(product['圖片連結_2'] || '').trim(),
      imageUrl3: String(product['圖片連結_3'] || '').trim(),
      imageUrl4: String(product['圖片連結_4'] || '').trim(),
      stockStatus: String(product['到貨狀況'] || 'P').trim(),
      isBoxPreorder: product['卡盒預購'] === 'Y' || product['卡盒預購'] === true,
      canDirectOrder: product['是否可直接訂購'] === 'Y' || product['是否可直接訂購'] === true,
      remainingStock: Number(product['剩餘數量'] || 0),
      description: String(product['說明'] || '').trim(),
      orderedQuantity: Number(product['已訂單卡張數'] || 0),
      scheduledListTime: product['預定上架時間'] || null,
      scheduledDelistTime: product['預定下架時間'] || null,
      isArrivalNotified: product['已通知到貨'] === 'Y' || product['已通知到貨'] === true,
      category: String(product['分類'] || '').trim()
    })).filter(p => p.itemName);
    
    return {
      success: true,
      products: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 4. 匯出團拆記錄
 * 欄位: 訂購人 | 團拆編號 | 種類 | 團名 | 團拆形式 | 購買品項 | 總團費 | 已付金額 | 是否已拆 | 卡片是否寄出 | ... | 狀態 | 付款方式 | 綠界訂單號 | 付款時間
 */
function exportAllBreaks() {
  try {
    const breaks = getSheetData(SHEET_NAMES.BREAKS);
    
    const formatted = breaks.map(breakRecord => ({
      nickname: String(breakRecord['訂購人'] || '').trim(),
      breakId: String(breakRecord['團拆編號'] || '').trim(),
      category: String(breakRecord['種類'] || '').trim(),
      breakName: String(breakRecord['團名'] || '').trim(),
      format: String(breakRecord['團拆形式'] || '').trim(),
      itemName: String(breakRecord['購買品項'] || '').trim(),
      totalFee: Number(breakRecord['總團費'] || 0),
      paid: Number(breakRecord['已付金額'] || 0),
      isOpened: parseBooleanField(breakRecord['是否已拆']),
      isShipped: parseBooleanField(breakRecord['卡片是否寄出']),
      status: String(breakRecord['狀態'] || '').trim(),
      paymentMethod: String(breakRecord['付款方式'] || '').trim(),
      merchantTradeNo: String(breakRecord['綠界訂單號'] || '').trim(),
      paymentDate: breakRecord['付款時間'] || null
    })).filter(b => b.nickname && b.breakId);
    
    return {
      success: true,
      breaks: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 5. 匯出團拆金記錄
 * 欄位: 暱稱 | 團拆金 | 取得方式 | 是否使用 | 使用的團拆 | 已使用金額
 */
function exportAllBreakCredits() {
  try {
    const credits = getSheetData(SHEET_NAMES.BREAK_CREDITS);
    
    const formatted = credits.map(credit => ({
      nickname: String(credit['暱稱'] || '').trim(),
      amount: Number(credit['團拆金'] || 0),
      source: String(credit['取得方式'] || '').trim(),
      isUsed: parseBooleanField(credit['是否使用']),
      usedBreakIds: String(credit['使用的團拆'] || '').trim(),
      usedAmount: Number(credit['已使用金額'] || 0)
    })).filter(c => c.nickname);
    
    return {
      success: true,
      breakCredits: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 6. 匯出付款記錄（綠界付款記錄）
 * 欄位: 付款單號 | 客戶電話 | 暱稱 | 訂單編號 | 金額 | 商品名稱 | 狀態 | 建立時間 | 付款時間 | 綠界交易編號 | 回傳訊息 | 更新時間 | 訂單明細 | 付款類型
 */
function exportAllPayments() {
  try {
    const payments = getSheetData(SHEET_NAMES.ECPAY_RECORDS);
    
    const formatted = payments.map(payment => ({
      merchantTradeNo: String(payment['付款單號'] || '').trim(),
      phone: String(payment['客戶電話'] || '').trim(),
      nickname: String(payment['暱稱'] || '').trim(),
      orderNo: String(payment['訂單編號'] || '').trim(),
      tradeNo: String(payment['綠界交易編號'] || '').trim(),
      paymentDate: payment['付款時間'] || null,
      paymentType: String(payment['付款類型'] || '').trim(),
      tradeAmt: Number(payment['金額'] || 0),
      productName: String(payment['商品名稱'] || '').trim(),
      status: String(payment['狀態'] || '').trim(),
      rtnMsg: String(payment['回傳訊息'] || '').trim(),
      createdAt: payment['建立時間'] || new Date().toISOString(),
      orderDetails: String(payment['訂單明細'] || '').trim()
    })).filter(p => p.merchantTradeNo || p.phone);
    
    return {
      success: true,
      payments: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 7. 匯出 PSA 主訂單（主訂單）
 * 欄位: 時間戳記 | 訂單 ID | 姓名 | 暱稱 | Email | 手機號碼 | 寄送方式 | 總卡片張數 | 總金額 | 主要狀態 | 狀態更新時間
 */
function exportAllPSAOrders() {
  try {
    const orders = getSheetData(SHEET_NAMES.MAIN_ORDERS);
    
    const formatted = orders.map(order => ({
      orderId: String(order['訂單 ID'] || '').trim(),
      phone: String(order['手機號碼'] || '').trim(),
      nickname: String(order['暱稱'] || '').trim(),
      realName: String(order['姓名'] || '').trim(),
      email: String(order['Email'] || '').trim(),
      shippingMethod: String(order['寄送方式'] || '').trim(),
      totalCards: Number(order['總卡片張數'] || 0),
      totalAmount: Number(order['總金額'] || 0),
      status: String(order['主要狀態'] || '').trim(),
      createdAt: order['時間戳記'] || new Date().toISOString(),
      updatedAt: order['狀態更新時間'] || null
    })).filter(o => o.orderId);
    
    return {
      success: true,
      psaOrders: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 8. 匯出 PSA 卡片明細（卡片明細）
 * 欄位: 時間戳記 | 訂單 ID | 卡片編號 | 年份 | 球員 | 簽名 | 用品卡 | 鑑定類型 | 單張價格 | 限量 | 限量編號 | 品牌 | 卡號 | 主要狀態 | 正面圖片 | 反面圖片
 */
function exportAllPSACards() {
  try {
    const cards = getSheetData(SHEET_NAMES.CARD_DETAILS);
    
    const formatted = cards.map(card => ({
      orderId: String(card['訂單 ID'] || '').trim(),
      cardNumber: Number(card['卡片編號'] || 0),
      year: String(card['年份'] || '').trim(),
      player: String(card['球員'] || '').trim(),
      isSignature: parseBooleanField(card['簽名']),
      isRelic: parseBooleanField(card['用品卡']),
      gradingType: String(card['鑑定類型'] || '').trim(),
      price: Number(card['單張價格'] || 0),
      limited: String(card['限量'] || '').trim(),
      limitedNum: String(card['限量編號'] || '').trim(),
      brand: String(card['品牌'] || '').trim(),
      cardNo: String(card['卡號'] || '').trim(),
      status: String(card['主要狀態'] || '').trim(),
      frontImage: String(card['正面圖片'] || '').trim(),
      backImage: String(card['反面圖片'] || '').trim(),
      createdAt: card['時間戳記'] || new Date().toISOString()
    })).filter(c => c.orderId);
    
    return {
      success: true,
      psaCards: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 9. 匯出出貨紀錄
 * 欄位: 出貨編號 | 出貨日期 | 群組暱稱 | 姓名 | 電話 | 收件門市 | 711店號 | 商品明細 | 物流單號 | 備註 |
 */
function exportAllShipments() {
  try {
    const shipments = getSheetData(SHEET_NAMES.SHIPMENTS);
    
    const formatted = shipments.map(shipment => ({
      shipmentNo: String(shipment['出貨編號'] || '').trim(),
      phone: String(shipment['電話'] || '').trim(),
      nickname: String(shipment['群組暱稱'] || '').trim(),
      trackingNo: String(shipment['物流單號'] || '').trim(),
      shippingMethod: '7-11店到店',
      shippedDate: shipment['出貨日期'] || new Date().toISOString(),
      receiverName: String(shipment['姓名'] || '').trim(),
      receiverPhone: String(shipment['電話'] || '').trim(),
      receiverAddress: String(shipment['收件門市'] || '').trim(),
      items: String(shipment['商品明細'] || '').trim(),
      status: shipment['物流單號'] ? 'shipped' : 'pending',
      notes: String(shipment['備註'] || '').trim()
    })).filter(s => s.phone);
    
    return {
      success: true,
      shipments: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 10. 匯出 Topps Now 訂購總表（已在 exportAllOrders 處理）
 */
function exportToppsNow() {
  return exportAllOrders();
}

/**
 * 11. 匯出每日抽籤紀錄
 * 欄位: 手機號碼 | 暱稱 | 抽籤日期 | 抽籤時間 | 運勢結果
 */
function exportLottery() {
  try {
    const data = getSheetData(SHEET_NAMES.LOTTERY);
    
    const formatted = data.map(item => ({
      phone: String(item['手機號碼'] || '').trim(),
      nickname: String(item['暱稱'] || '').trim(),
      lotteryDate: item['抽籤日期'] || new Date().toISOString(),
      lotteryTime: String(item['抽籤時間'] || '').trim(),
      result: String(item['運勢結果'] || '').trim()
    })).filter(i => i.phone);
    
    return {
      success: true,
      data: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 12. 匯出綠界付款記錄（已在 exportAllPayments 處理）
 */
function exportEcpayRecords() {
  return exportAllPayments();
}

/**
 * 13. 匯出訂單歷史紀錄
 * 欄位: 下單時間 | 訂購人 | 品項 | 卡號 | 張數
 */
function exportOrderHistory() {
  try {
    const data = getSheetData(SHEET_NAMES.ORDER_HISTORY);
    
    const formatted = data.map(item => ({
      nickname: String(item['訂購人'] || '').trim(),
      itemName: String(item['品項'] || '').trim(),
      cardNo: String(item['卡號'] || '').trim(),
      quantity: Number(item['張數'] || 0),
      orderDate: item['下單時間'] || new Date().toISOString()
    })).filter(i => i.nickname || i.itemName);
    
    return {
      success: true,
      data: formatted,
      count: formatted.length
    };
  } catch (error) {
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 輔助函數：解析布林值欄位
 */
function parseBooleanField(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toUpperCase();
    return v === 'Y' || v === 'YES' || v === 'TRUE' || v === '是' || v === '已付款' || v === '已出貨' || v === 'V' || v === '✓';
  }
  return false;
}
