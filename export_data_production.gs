/**
 * 正式環境資料匯出 Apps Script
 * 部署說明：
 * 1. 在正式 Google Sheets 中打開「擴充功能」→「Apps Script」
 * 2. 新增檔案 export_data.gs，貼上此程式碼
 * 3. 點選「部署」→「新增部署作業」
 * 4. 類型：網頁應用程式
 * 5. 執行身分：我
 * 6. 具有存取權的使用者：所有人
 * 7. 複製網址更新到 .env 的 GAS_EXPORT_URL
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
    switch (action) {
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
        return sendJSON({ success: false, message: '未知的 action: ' + action });
    }
    
    return sendJSON(result);
  } catch (error) {
    return sendJSON({ 
      success: false, 
      message: error.toString(),
      stack: error.stack 
    });
  }
}

function doGet(e) {
  return ContentService.createTextOutput('Data Export API for Production');
}

function sendJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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
 */
function exportAllUsers() {
  try {
    const users = getSheetData(SHEET_NAMES.USERS);
    
    const formatted = users.map(user => ({
      phone: String(user['手機號碼'] || user['電話'] || '').trim(),
      nickname: String(user['暱稱'] || user['稱呼'] || '').trim(),
      realName: String(user['真實姓名'] || user['姓名'] || '').trim(),
      email: String(user['Email'] || user['電子郵件'] || '').trim(),
      address: String(user['地址'] || '').trim(),
      birthday: user['生日'] || null,
      createdAt: user['建立時間'] || user['註冊時間'] || new Date().toISOString()
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
 */
function exportAllProducts() {
  try {
    const products = getSheetData(SHEET_NAMES.PRODUCTS);
    
    const formatted = products.map(product => ({
      itemName: String(product['商品名稱'] || product['品項'] || '').trim(),
      cardNo: String(product['卡號'] || product['編號'] || '').trim(),
      price: Number(product['價格'] || product['單價'] || 0),
      thresholdPrice: Number(product['門檻價'] || product['折扣價'] || 0),
      isAvailable: product['是否開放'] === 'Y' || product['開放狀態'] === 'Y' ? 'Y' : 'N',
      category: String(product['分類'] || product['類別'] || '').trim(),
      stockStatus: String(product['庫存狀態'] || 'P').trim(),
      remainingStock: Number(product['剩餘庫存'] || product['庫存'] || 0),
      imageUrl1: String(product['圖片1'] || product['圖片網址1'] || '').trim(),
      imageUrl2: String(product['圖片2'] || product['圖片網址2'] || '').trim(),
      minGroupSize: Number(product['開團人數'] || product['最低開團'] || 0),
      discountThreshold: Number(product['折扣門檻'] || 0),
      closeTime: product['截止時間'] || null
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
 * 4. 匯出團拆紀錄
 */
function exportAllBreaks() {
  try {
    const breaks = getSheetData(SHEET_NAMES.BREAKS);
    
    const formatted = breaks.map(b => ({
      phone: String(b['手機號碼'] || b['電話'] || '').trim(),
      itemName: String(b['商品名稱'] || b['品項'] || '').trim(),
      cardNo: String(b['卡號'] || '').trim(),
      breakDate: b['團拆日期'] || b['拆封日期'] || new Date().toISOString(),
      breakResult: String(b['團拆結果'] || b['結果'] || '').trim(),
      videoUrl: String(b['影片連結'] || '').trim(),
      category: String(b['分類'] || '').trim(),
      notes: String(b['備註'] || '').trim()
    })).filter(b => b.phone);
    
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
 * 5. 匯出團拆金
 */
function exportAllBreakCredits() {
  try {
    const credits = getSheetData(SHEET_NAMES.BREAK_CREDITS);
    
    const formatted = credits.map(credit => ({
      phone: String(credit['手機號碼'] || credit['電話'] || '').trim(),
      amount: Number(credit['金額'] || 0),
      source: String(credit['來源'] || '').trim(),
      isUsed: parseBooleanField(credit['是否使用'] || credit['使用狀態']),
      createdAt: credit['建立時間'] || new Date().toISOString(),
      usedAt: credit['使用時間'] || null,
      notes: String(credit['備註'] || '').trim()
    })).filter(c => c.phone);
    
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
 */
function exportAllPayments() {
  try {
    const payments = getSheetData(SHEET_NAMES.ECPAY_RECORDS);
    
    const formatted = payments.map(payment => ({
      merchantTradeNo: String(payment['訂單編號'] || payment['MerchantTradeNo'] || '').trim(),
      tradeNo: String(payment['綠界交易編號'] || payment['TradeNo'] || '').trim(),
      paymentDate: payment['付款時間'] || payment['PaymentDate'] || new Date().toISOString(),
      paymentType: String(payment['付款方式'] || payment['PaymentType'] || '').trim(),
      tradeAmt: Number(payment['交易金額'] || payment['TradeAmt'] || 0),
      rtnCode: String(payment['回傳代碼'] || payment['RtnCode'] || '').trim(),
      rtnMsg: String(payment['回傳訊息'] || payment['RtnMsg'] || '').trim(),
      phone: String(payment['手機號碼'] || payment['電話'] || '').trim()
    })).filter(p => p.merchantTradeNo);
    
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
 * 7. 匯出 PSA 訂單（主訂單）
 */
function exportAllPSAOrders() {
  try {
    const orders = getSheetData(SHEET_NAMES.MAIN_ORDERS);
    
    // 篩選 PSA 相關訂單
    const psaOrders = orders.filter(order => {
      const itemName = String(order['商品名稱'] || '').trim();
      return itemName.includes('PSA') || itemName.includes('鑑定');
    });
    
    const formatted = psaOrders.map(order => ({
      phone: String(order['手機號碼'] || '').trim(),
      serviceType: String(order['商品名稱'] || '').trim(),
      quantity: Number(order['數量'] || 0),
      totalFee: Number(order['總金額'] || 0),
      deposit: Number(order['訂金'] || 0),
      isPaid: parseBooleanField(order['是否付款']),
      orderDate: order['訂購日期'] || new Date().toISOString(),
      status: String(order['到貨狀態'] || 'pending').trim(),
      notes: String(order['備註'] || '').trim()
    })).filter(o => o.phone);
    
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
 */
function exportAllPSACards() {
  try {
    const cards = getSheetData(SHEET_NAMES.CARD_DETAILS);
    
    const formatted = cards.map(card => ({
      phone: String(card['手機號碼'] || '').trim(),
      cardName: String(card['卡片名稱'] || card['品項'] || '').trim(),
      cardNo: String(card['卡號'] || '').trim(),
      psaGrade: String(card['PSA等級'] || card['等級'] || '').trim(),
      certNo: String(card['證書號碼'] || '').trim(),
      declaredValue: Number(card['申報價值'] || 0),
      serviceLevel: String(card['服務等級'] || 'regular').trim(),
      status: String(card['狀態'] || 'pending').trim(),
      receivedDate: card['收件日期'] || null,
      returnedDate: card['退件日期'] || null,
      notes: String(card['備註'] || '').trim()
    })).filter(c => c.phone);
    
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
 */
function exportAllShipments() {
  try {
    const shipments = getSheetData(SHEET_NAMES.SHIPMENTS);
    
    const formatted = shipments.map(shipment => ({
      phone: String(shipment['手機號碼'] || shipment['電話'] || '').trim(),
      trackingNo: String(shipment['物流單號'] || shipment['追蹤號碼'] || '').trim(),
      shippingMethod: String(shipment['物流方式'] || '').trim(),
      shippedDate: shipment['出貨日期'] || new Date().toISOString(),
      receiverName: String(shipment['收件人'] || '').trim(),
      receiverPhone: String(shipment['收件電話'] || '').trim(),
      receiverAddress: String(shipment['收件地址'] || '').trim(),
      items: String(shipment['商品明細'] || '').trim(),
      status: String(shipment['狀態'] || 'shipped').trim(),
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
 * 10. 匯出 Topps Now 訂購總表
 */
function exportToppsNow() {
  try {
    const data = getSheetData(SHEET_NAMES.TOPPS_NOW);
    
    const formatted = data.map(item => ({
      phone: String(item['手機號碼'] || '').trim(),
      itemName: String(item['商品名稱'] || '').trim(),
      cardNo: String(item['卡號'] || '').trim(),
      quantity: Number(item['數量'] || 0),
      orderDate: item['訂購日期'] || new Date().toISOString(),
      status: String(item['狀態'] || '').trim(),
      notes: String(item['備註'] || '').trim()
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
 * 11. 匯出每日抽籤紀錄
 */
function exportLottery() {
  try {
    const data = getSheetData(SHEET_NAMES.LOTTERY);
    
    const formatted = data.map(item => ({
      date: item['日期'] || new Date().toISOString(),
      phone: String(item['手機號碼'] || '').trim(),
      itemName: String(item['商品名稱'] || '').trim(),
      result: String(item['抽籤結果'] || '').trim(),
      notes: String(item['備註'] || '').trim()
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
    return v === 'Y' || v === 'YES' || v === 'TRUE' || v === '是' || v === '已付款' || v === '已出貨';
  }
  return false;
}
