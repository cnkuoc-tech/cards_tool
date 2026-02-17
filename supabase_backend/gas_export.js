/**
 * GAS 資料導出專用檔案
 * 
 * 使用方法：
 * 1. 在 Google Apps Script 建立一個新的專案（例如：Data_Export）
 * 2. 複製此檔案內容到新專案
 * 3. 修改下方的 SPREADSHEET_ID
 * 4. 部署為 Web App
 * 5. 使用部署的 URL 來執行資料導出
 */

// ============================================
// 設定區 - 請修改為你的試算表 ID
// ============================================
// 從試算表網址取得 ID：
// https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
var SPREADSHEET_ID = '1CORDPqbkr0oKF2sKJ_PcdFmhGwJ1AaEjYMFy1a4jEhw';

// ============================================
// doPost 處理入口
// ============================================
function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action;
    
    switch (action) {
      case 'exportAllUsers':
        return returnJSON(exportAllUsers());
      case 'exportAllOrders':
        return returnJSON(exportAllOrders());
      case 'exportAllBreaks':
        return returnJSON(exportAllBreaks());
      case 'exportAllBreakCredits':
        return returnJSON(exportAllBreakCredits());
      case 'exportAllPayments':
        return returnJSON(exportAllPayments());
      case 'exportAllProducts':
        return returnJSON(exportAllProducts());
      case 'exportAllPsaOrders':
        return returnJSON(exportAllPsaOrders());
      case 'exportAllPsaCards':
        return returnJSON(exportAllPsaCards());
      case 'exportAllShipments':
        return returnJSON(exportAllShipments());
      default:
        return returnJSON({ success: false, message: '未知的 action: ' + action });
    }
  } catch (error) {
    return returnJSON({ success: false, message: error.toString() });
  }
}

// ============================================
// 返回 JSON 響應
// ============================================
function returnJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// 導出所有用戶資料
// ============================================
function exportAllUsers() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var userSheet = ss.getSheetByName('客戶資料');
    
    if (!userSheet) {
      return { success: false, message: '找不到客戶資料表' };
    }
    
    var data = userSheet.getDataRange().getValues();
    var headers = data[0];
    
    var users = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var birthdayRaw = row[4];
      var password = null;
      var birthday = null;
      
      // 處理生日/密碼欄位
      if (birthdayRaw instanceof Date) {
        // 完整的日期格式
        birthday = Utilities.formatDate(birthdayRaw, 'GMT+8', 'yyyy-MM-dd');
      } else if (birthdayRaw) {
        var bdayStr = String(birthdayRaw).trim();
        if (bdayStr.length === 4 && /^\d{4}$/.test(bdayStr)) {
          // MMDD 格式 -> 視為密碼
          password = bdayStr;
          birthday = null;
        } else if (bdayStr.length >= 8) {
          // 可能是 YYYY-MM-DD 或其他完整日期格式
          try {
            birthday = Utilities.formatDate(new Date(bdayStr), 'GMT+8', 'yyyy-MM-dd');
          } catch (e) {
            birthday = null;
          }
        }
      }
      
      var user = {
        phone: String(row[3] || '').trim(),        // D欄: 電話
        nickname: String(row[1] || '').trim(),      // B欄: 群組暱稱
        password: password,                         // E欄: 密碼 (MMDD)
        birthday: birthday,                         // E欄: 生日 (完整日期)
        email: String(row[10] || '').trim(),        // K欄: email
        address: String(row[6] || '').trim(),       // G欄: 7-11店到店門市
        realName: String(row[2] || '').trim()       // C欄: 姓名
      }
      
      if (user.phone) {
        users.push(user);
      }
    }
    
    Logger.log('導出用戶數量: ' + users.length);
    
    return {
      success: true,
      count: users.length,
      users: users
    };
    
  } catch (e) {
    Logger.log('導出用戶錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// ============================================
// 導出所有訂單資料
// ============================================
function exportAllOrders() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var orderSheet = ss.getSheetByName('Topps_Now_訂購總表');
    
    if (!orderSheet) {
      return { success: false, message: '找不到訂單表' };
    }
    
    var data = orderSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var orders = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      // 提取聯絡方式（可能包含手機）
      var contactInfo = String(row[headers.indexOf('聯絡方式')] || '').trim();
      
      var order = {
        phone: contactInfo,
        nickname: String(row[headers.indexOf('訂購人')] || '').trim(),
        timestamp: row[headers.indexOf('時間戳記')] || null,
        item: String(row[headers.indexOf('品項')] || '').trim(),
        cardNo: String(row[headers.indexOf('卡號')] || '').trim(),
        unitPrice: parseFloat(row[headers.indexOf('單價')] || 0),
        quantity: parseInt(row[headers.indexOf('張數')] || 1),
        totalFee: parseFloat(row[headers.indexOf('總價')] || 0),
        deposit: parseFloat(row[headers.indexOf('訂金')] || 0),
        balance: parseFloat(row[headers.indexOf('尾款')] || 0),
        isInvoiced: String(row[headers.indexOf('開單')] || '').trim(),
        isShipped: String(row[headers.indexOf('寄出')] || '').trim(),
        isCleared: String(row[headers.indexOf('結清')] || '').trim(),
        status: String(row[headers.indexOf('狀態')] || '').trim(),
        arrivalStatus: String(row[headers.indexOf('到貨狀態')] || '').trim(),
        imageUrl: String(row[headers.indexOf('圖片連結')] || '').trim(),
        boxOrder: String(row[headers.indexOf('卡盒訂單')] || '').trim(),
        remark: String(row[headers.indexOf('備註')] || '').trim(),
        paymentMethod: String(row[headers.indexOf('付款方式')] || '').trim(),
        merchantTradeNo: String(row[headers.indexOf('綠界訂單號')] || '').trim(),
        paymentDate: row[headers.indexOf('付款時間')] || null
      };
      
      // 轉換時間戳記
      if (order.timestamp instanceof Date) {
        order.timestamp = order.timestamp.toISOString();
      } else if (order.timestamp) {
        try {
          order.timestamp = new Date(order.timestamp).toISOString();
        } catch (e) {
          order.timestamp = null;
        }
      }
      
      // 轉換付款時間
      if (order.paymentDate instanceof Date) {
        order.paymentDate = order.paymentDate.toISOString();
      } else if (order.paymentDate) {
        try {
          order.paymentDate = new Date(order.paymentDate).toISOString();
        } catch (e) {
          order.paymentDate = null;
        }
      }
      
      // 只保留有品項的訂單
      if (order.item) {
        orders.push(order);
      }
    }
    
    Logger.log('導出訂單數量: ' + orders.length);
    
    return {
      success: true,
      count: orders.length,
      orders: orders
    };
    
  } catch (e) {
    Logger.log('導出訂單錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// ============================================
// 導出所有團拆資料
// ============================================
function exportAllBreaks() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var breakSheet = ss.getSheetByName('團拆紀錄');
    
    if (!breakSheet) {
      return { success: false, message: '找不到團拆紀錄表' };
    }
    
    var data = breakSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var breaks = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var breakItem = {
        nickname: String(row[headers.indexOf('訂購人')] || '').trim(),
        breakId: String(row[headers.indexOf('團拆編號')] || '').trim(),
        category: String(row[headers.indexOf('種類')] || '棒球').trim(),
        name: String(row[headers.indexOf('團名')] || '').trim(),
        format: String(row[headers.indexOf('團拆形式')] || '隨機').trim(),
        item: String(row[headers.indexOf('購買品項')] || '').trim(),
        totalFee: parseFloat(row[headers.indexOf('總團費')] || 0),
        paid: parseFloat(row[headers.indexOf('已付金額')] || 0),
        isOpened: String(row[headers.indexOf('是否已拆')] || '').trim(),
        isShipped: String(row[headers.indexOf('卡片是否寄出')] || '').trim(),
        status: String(row[headers.indexOf('狀態')] || '已通知').trim(),
        paymentMethod: String(row[headers.indexOf('付款方式')] || '').trim(),
        merchantTradeNo: String(row[headers.indexOf('綠界訂單號')] || '').trim(),
        paymentDate: row[headers.indexOf('付款時間')] || null
      };
      
      // 轉換付款時間
      if (breakItem.paymentDate instanceof Date) {
        breakItem.paymentDate = breakItem.paymentDate.toISOString();
      } else if (breakItem.paymentDate) {
        try {
          breakItem.paymentDate = new Date(breakItem.paymentDate).toISOString();
        } catch (e) {
          breakItem.paymentDate = null;
        }
      }
      
      if (breakItem.breakId) {
        breaks.push(breakItem);
      }
    }
    
    Logger.log('導出團拆數量: ' + breaks.length);
    
    return {
      success: true,
      count: breaks.length,
      breaks: breaks
    };
    
  } catch (e) {
    Logger.log('導出團拆錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// ============================================
// 導出所有團拆金資料
// ============================================
function exportAllBreakCredits() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var creditSheet = ss.getSheetByName('團拆金');
    
    if (!creditSheet) {
      return { success: true, count: 0, credits: [] };
    }
    
    var data = creditSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var credits = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var credit = {
        nickname: String(row[headers.indexOf('暱稱')] || '').trim(),
        amount: parseFloat(row[headers.indexOf('團拆金')] || 0),
        source: String(row[headers.indexOf('取得方式')] || '').trim(),
        isUsed: String(row[headers.indexOf('是否使用')] || '').trim() === 'Y',
        usedBreakIds: String(row[headers.indexOf('使用的團拆')] || '').trim(),
        usedAmount: parseFloat(row[headers.indexOf('已使用金額')] || 0)
      };
      
      // 轉換使用的團拆編號為陣列
      if (credit.usedBreakIds) {
        credit.usedBreakIds = credit.usedBreakIds.split(',').map(function(id) {
          return id.trim();
        }).filter(function(id) { return id; });
      } else {
        credit.usedBreakIds = [];
      }
      
      if (credit.nickname && credit.amount > 0) {
        credits.push(credit);
      }
    }
    
    Logger.log('導出團拆金數量: ' + credits.length);
    
    return {
      success: true,
      count: credits.length,
      credits: credits
    };
    
  } catch (e) {
    Logger.log('導出團拆金錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// ============================================
// 導出所有付款記錄
// ============================================
function exportAllPayments() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var paymentSheet = ss.getSheetByName('綠界付款記錄');
    
    if (!paymentSheet) {
      return { success: true, count: 0, payments: [] };
    }
    
    var data = paymentSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var payments = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var payment = {
        paymentNo: String(row[headers.indexOf('付款單號')] || '').trim(),
        phone: String(row[headers.indexOf('客戶電話')] || '').replace(/^'/, '').trim(),
        nickname: String(row[headers.indexOf('暱稱')] || '').trim(),
        orderNo: String(row[headers.indexOf('訂單編號')] || '').trim(),
        amount: parseFloat(row[headers.indexOf('金額')] || 0),
        productName: String(row[headers.indexOf('商品名稱')] || '').trim(),
        status: String(row[headers.indexOf('狀態')] || 'pending').trim(),
        createdAt: row[headers.indexOf('建立時間')] || null,
        paymentDate: row[headers.indexOf('付款時間')] || null,
        tradeNo: String(row[headers.indexOf('綠界交易編號')] || '').trim(),
        returnMessage: String(row[headers.indexOf('回傳訊息')] || '').trim(),
        updatedAt: row[headers.indexOf('更新時間')] || null,
        orderDetails: String(row[headers.indexOf('訂單明細')] || '').trim(),
        paymentType: String(row[headers.indexOf('付款類型')] || '').trim()
      };
      
      // 轉換建立時間
      if (payment.createdAt instanceof Date) {
        payment.createdAt = payment.createdAt.toISOString();
      } else if (payment.createdAt) {
        try {
          payment.createdAt = new Date(payment.createdAt).toISOString();
        } catch (e) {
          payment.createdAt = null;
        }
      }
      
      // 轉換付款時間
      if (payment.paymentDate instanceof Date) {
        payment.paymentDate = payment.paymentDate.toISOString();
      } else if (payment.paymentDate) {
        try {
          payment.paymentDate = new Date(payment.paymentDate).toISOString();
        } catch (e) {
          payment.paymentDate = null;
        }
      }
      
      // 轉換更新時間
      if (payment.updatedAt instanceof Date) {
        payment.updatedAt = payment.updatedAt.toISOString();
      } else if (payment.updatedAt) {
        try {
          payment.updatedAt = new Date(payment.updatedAt).toISOString();
        } catch (e) {
          payment.updatedAt = null;
        }
      }
      
      // 解析訂單明細 JSON
      if (payment.orderDetails) {
        try {
          payment.orderDetails = JSON.parse(payment.orderDetails);
        } catch (e) {
          payment.orderDetails = null;
        }
      }
      
      // 只保留有付款單號或訂單編號的記錄
      if (payment.paymentNo || payment.orderNo) {
        payments.push(payment);
      }
    }
    
    Logger.log('導出付款記錄數量: ' + payments.length);
    
    return {
      success: true,
      count: payments.length,
      payments: payments
    };
    
  } catch (e) {
    Logger.log('導出付款記錄錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// ============================================
// 導出所有商品目錄
// ============================================
function exportAllProducts() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var productSheet = ss.getSheetByName('下單商品');
    
    if (!productSheet) {
      return { success: false, message: '找不到下單商品表' };
    }
    
    var data = productSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var products = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var product = {
        itemName: String(row[headers.indexOf('品項')] || '').trim(),
        cardNo: String(row[headers.indexOf('卡號')] || '').trim(),
        price: parseFloat(row[headers.indexOf('單價')] || 0),
        thresholdPrice: parseFloat(row[headers.indexOf('門檻價')] || 0),
        discountThreshold: parseInt(row[headers.indexOf('優惠門檻')] || 0),
        minGroupQuantity: parseInt(row[headers.indexOf('最低開團張數')] || 0),
        canDrawSP: String(row[headers.indexOf('可抽_SP')] || '').trim(),
        canDrawSignature: String(row[headers.indexOf('可抽_簽名')] || '').trim(),
        canDrawRelic: String(row[headers.indexOf('可抽_Relic')] || '').trim(),
        canDrawAutoRelic: String(row[headers.indexOf('可抽_auto_relic')] || '').trim(),
        isAvailable: String(row[headers.indexOf('是否開放')] || '').trim(),
        imageUrl1: String(row[headers.indexOf('圖片連結_1')] || '').trim(),
        imageUrl2: String(row[headers.indexOf('圖片連結_2')] || '').trim(),
        imageUrl3: String(row[headers.indexOf('圖片連結_3')] || '').trim(),
        imageUrl4: String(row[headers.indexOf('圖片連結_4')] || '').trim(),
        stockStatus: String(row[headers.indexOf('到貨狀況')] || '').trim(),
        isBoxPreorder: String(row[headers.indexOf('卡盒預購')] || '').trim(),
        canDirectOrder: String(row[headers.indexOf('是否可直接訂購')] || '').trim(),
        remainingStock: parseInt(row[headers.indexOf('剩餘數量')] || 0),
        description: String(row[headers.indexOf('說明')] || '').trim(),
        orderedQuantity: parseInt(row[headers.indexOf('已訂單卡張數')] || 0),
        scheduledListTime: row[headers.indexOf('預定上架時間')] || null,
        scheduledDelistTime: row[headers.indexOf('預定下架時間')] || null,
        isArrivalNotified: String(row[headers.indexOf('已通知到貨')] || '').trim(),
        category: String(row[headers.indexOf('分類')] || '').trim()
      };
      
      // 轉換時間格式
      if (product.scheduledListTime instanceof Date) {
        product.scheduledListTime = product.scheduledListTime.toISOString();
      }
      if (product.scheduledDelistTime instanceof Date) {
        product.scheduledDelistTime = product.scheduledDelistTime.toISOString();
      }
      
      if (product.itemName) {
        products.push(product);
      }
    }
    
    Logger.log('導出商品數量: ' + products.length);
    
    return {
      success: true,
      count: products.length,
      products: products
    };
    
  } catch (e) {
    Logger.log('導出商品錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// ============================================
// 測試導出函數
// ============================================
function testExportFunctions() {
  Logger.log('=== 測試導出用戶 ===');
  var usersResult = exportAllUsers();
  Logger.log('用戶數量: ' + usersResult.count);
  if (usersResult.users && usersResult.users.length > 0) {
    Logger.log('第一筆範例: ' + JSON.stringify(usersResult.users[0]));
  }
  
  Logger.log('\n=== 測試導出訂單 ===');
  var ordersResult = exportAllOrders();
  Logger.log('訂單數量: ' + ordersResult.count);
  if (ordersResult.orders && ordersResult.orders.length > 0) {
    Logger.log('第一筆範例: ' + JSON.stringify(ordersResult.orders[0]));
  }
  
  Logger.log('\n=== 測試導出團拆 ===');
  var breaksResult = exportAllBreaks();
  Logger.log('團拆數量: ' + breaksResult.count);
  if (breaksResult.breaks && breaksResult.breaks.length > 0) {
    Logger.log('第一筆範例: ' + JSON.stringify(breaksResult.breaks[0]));
  }
  
  Logger.log('\n=== 測試導出團拆金 ===');
  var creditsResult = exportAllBreakCredits();
  Logger.log('團拆金數量: ' + creditsResult.count);
  if (creditsResult.credits && creditsResult.credits.length > 0) {
    Logger.log('第一筆範例: ' + JSON.stringify(creditsResult.credits[0]));
  }
  
  Logger.log('\n=== 測試導出付款記錄 ===');
  var paymentsResult = exportAllPayments();
  Logger.log('付款記錄數量: ' + paymentsResult.count);
  if (paymentsResult.payments && paymentsResult.payments.length > 0) {
    Logger.log('第一筆範例: ' + JSON.stringify(paymentsResult.payments[0]));
  }
}

// ============================================
// 導出所有 PSA 主訂單
// ============================================
function exportAllPsaOrders() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var psaOrderSheet = ss.getSheetByName('主訂單');
    
    if (!psaOrderSheet) {
      return { success: true, count: 0, psaOrders: [] };
    }
    
    var data = psaOrderSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var psaOrders = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var psaOrder = {
        timestamp: row[headers.indexOf('時間戳記')] || null,
        orderId: String(row[headers.indexOf('訂單 ID')] || '').trim(),
        realName: String(row[headers.indexOf('姓名')] || '').trim(),
        nickname: String(row[headers.indexOf('暱稱')] || '').trim(),
        email: String(row[headers.indexOf('Email')] || '').trim(),
        phone: String(row[headers.indexOf('手機號碼')] || '').replace(/^'/, '').trim(),
        shippingMethod: String(row[headers.indexOf('寄送方式')] || '').trim(),
        totalCards: parseInt(row[headers.indexOf('總卡片張數')] || 0),
        pricePerCard: parseFloat(row[headers.indexOf('單張價格')] || 0),
        totalAmount: parseFloat(row[headers.indexOf('總金額')] || 0),
        status: String(row[headers.indexOf('主要狀態')] || '已提交 (待收卡)').trim(),
        statusUpdatedAt: row[headers.indexOf('狀態更新時間')] || null
      };
      
      // 轉換時間戳記
      if (psaOrder.timestamp instanceof Date) {
        psaOrder.timestamp = psaOrder.timestamp.toISOString();
      } else if (psaOrder.timestamp) {
        try {
          psaOrder.timestamp = new Date(psaOrder.timestamp).toISOString();
        } catch (e) {
          psaOrder.timestamp = null;
        }
      }
      
      // 轉換狀態更新時間
      if (psaOrder.statusUpdatedAt instanceof Date) {
        psaOrder.statusUpdatedAt = psaOrder.statusUpdatedAt.toISOString();
      } else if (psaOrder.statusUpdatedAt) {
        try {
          psaOrder.statusUpdatedAt = new Date(psaOrder.statusUpdatedAt).toISOString();
        } catch (e) {
          psaOrder.statusUpdatedAt = null;
        }
      }
      
      // 只保留有訂單 ID 的記錄
      if (psaOrder.orderId) {
        psaOrders.push(psaOrder);
      }
    }
    
    Logger.log('導出 PSA 訂單數量: ' + psaOrders.length);
    
    return {
      success: true,
      count: psaOrders.length,
      psaOrders: psaOrders
    };
    
  } catch (e) {
    Logger.log('導出 PSA 訂單錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

// ============================================
// 導出所有 PSA 卡片明細
// ============================================
function exportAllPsaCards() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var psaCardSheet = ss.getSheetByName('卡片明細');
    
    if (!psaCardSheet) {
      return { success: true, count: 0, psaCards: [] };
    }
    
    var data = psaCardSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var psaCards = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var psaCard = {
        timestamp: row[headers.indexOf('時間戳記')] || null,
        orderId: String(row[headers.indexOf('訂單 ID')] || '').trim(),
        cardNumber: parseInt(row[headers.indexOf('卡片編號')] || 0),
        year: String(row[headers.indexOf('年份')] || '').trim(),
        player: String(row[headers.indexOf('球員')] || '').trim(),
        isSignature: String(row[headers.indexOf('簽名')] || '').trim(),
        isRelic: String(row[headers.indexOf('用品卡')] || '').trim(),
        gradingType: String(row[headers.indexOf('鑑定類型')] || '').trim(),
        limited: String(row[headers.indexOf('限量')] || '').trim(),
        limitedNum: String(row[headers.indexOf('限量編號')] || '').trim(),
        status: String(row[headers.indexOf('主要狀態')] || '').trim(),
        frontImageUrl: String(row[headers.indexOf('正面圖片')] || '').trim(),
        backImageUrl: String(row[headers.indexOf('反面圖片')] || '').trim()
      };
      
      // 轉換時間戳記
      if (psaCard.timestamp instanceof Date) {
        psaCard.timestamp = psaCard.timestamp.toISOString();
      } else if (psaCard.timestamp) {
        try {
          psaCard.timestamp = new Date(psaCard.timestamp).toISOString();
        } catch (e) {
          psaCard.timestamp = null;
        }
      }
      
      // 只保留有訂單 ID 的記錄
      if (psaCard.orderId) {
        psaCards.push(psaCard);
      }
    }
    
    Logger.log('導出 PSA 卡片數量: ' + psaCards.length);
    
    return {
      success: true,
      count: psaCards.length,
      psaCards: psaCards
    };
    
  } catch (e) {
    Logger.log('導出 PSA 卡片錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

/**
 * 導出所有出貨紀錄
 */
function exportAllShipments() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('出貨紀錄');
    
    if (!sheet) {
      return { success: false, message: '找不到「出貨紀錄」工作表' };
    }
    
    var data = sheet.getDataRange().getValues();
    var shipments = [];
    
    // 表頭：出貨編號(0) 出貨日期(1) 群組暱稱(2) 姓名(3) 電話(4) 收件門市(5) 711店號(6) 商品明細(7) 物流單號(8) 備註(9)
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var shipment = {
        shipmentNo: row[0] || '',           // 出貨編號
        shipmentDate: row[1] || '',          // 出貨日期
        nickname: row[2] || '',              // 群組暱稱
        realName: row[3] || '',              // 姓名
        phone: row[4] || '',                 // 電話
        shipStore: row[5] || '',             // 收件門市
        storeNumber: row[6] || '',           // 711店號
        items: row[7] || '',                 // 商品明細
        trackingNo: row[8] || '',            // 物流單號
        remark: row[9] || ''                 // 備註
      };
      
      // 處理出貨日期格式
      if (shipment.shipmentDate) {
        try {
          if (shipment.shipmentDate instanceof Date) {
            shipment.shipmentDate = Utilities.formatDate(shipment.shipmentDate, 'GMT+8', 'yyyy-MM-dd HH:mm:ss');
          } else {
            // 如果是字串，保持原樣
            shipment.shipmentDate = String(shipment.shipmentDate);
          }
        } catch (e) {
          shipment.shipmentDate = null;
        }
      }
      
      // 只保留有出貨編號的記錄
      if (shipment.shipmentNo) {
        shipments.push(shipment);
      }
    }
    
    Logger.log('導出出貨紀錄數量: ' + shipments.length);
    
    return {
      success: true,
      count: shipments.length,
      shipments: shipments
    };
    
  } catch (e) {
    Logger.log('導出出貨紀錄錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}
