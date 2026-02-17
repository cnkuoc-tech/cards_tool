/**
 * GAS 資料導出函數
 * 將這些函數加到 backend_test.js 的最後面
 */

// ============================================
// 導出所有用戶資料
// ============================================
function exportAllUsers() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = ss.getSheetByName('會員資料');
    
    if (!userSheet) {
      return { success: false, message: '找不到會員資料表' };
    }
    
    var data = userSheet.getDataRange().getValues();
    var headers = data[0];
    
    var users = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var user = {
        phone: String(row[headers.indexOf('手機')] || '').trim(),
        nickname: String(row[headers.indexOf('暱稱')] || '').trim(),
        birthday: row[headers.indexOf('生日')] || null,
        email: String(row[headers.indexOf('Email')] || '').trim(),
        address: String(row[headers.indexOf('地址')] || '').trim(),
        realName: String(row[headers.indexOf('真實姓名')] || '').trim()
      };
      
      // 轉換生日格式
      if (user.birthday instanceof Date) {
        user.birthday = Utilities.formatDate(user.birthday, 'GMT+8', 'yyyy-MM-dd');
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
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orderSheet = ss.getSheetByName('Topps_Now_訂購總表');
    
    if (!orderSheet) {
      return { success: false, message: '找不到訂單表' };
    }
    
    var data = orderSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var orders = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      
      var order = {
        phone: String(row[headers.indexOf('手機')] || '').replace(/^'/, '').trim(),
        nickname: String(row[headers.indexOf('訂購人')] || '').trim(),
        timestamp: row[headers.indexOf('時間戳記')] || null,
        item: String(row[headers.indexOf('品項')] || '').trim(),
        cardNo: String(row[headers.indexOf('卡號')] || '').trim(),
        quantity: parseInt(row[headers.indexOf('張數')] || 1),
        totalFee: parseFloat(row[headers.indexOf('總金額')] || 0),
        paid: parseFloat(row[headers.indexOf('已付金額')] || 0),
        status: String(row[headers.indexOf('狀態')] || '已通知').trim(),
        paymentMethod: String(row[headers.indexOf('付款方式')] || '').trim(),
        isNotified: String(row[headers.indexOf('已通知')] || '').trim(),
        isCleared: String(row[headers.indexOf('結清')] || '').trim(),
        remark: String(row[headers.indexOf('備註')] || '').trim()
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
      
      if (order.phone && order.item) {
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
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
        phone: String(row[headers.indexOf('手機')] || '').replace(/^'/, '').trim(),
        nickname: String(row[headers.indexOf('訂購人')] || '').trim(),
        breakId: String(row[headers.indexOf('團拆編號')] || '').trim(),
        name: String(row[headers.indexOf('團名')] || '').trim(),
        category: String(row[headers.indexOf('種類')] || '棒球').trim(),
        format: String(row[headers.indexOf('團拆形式')] || '隨機').trim(),
        item: String(row[headers.indexOf('購買品項')] || '').trim(),
        totalFee: parseFloat(row[headers.indexOf('總團費')] || 0),
        paid: parseFloat(row[headers.indexOf('已付金額')] || 0),
        status: String(row[headers.indexOf('狀態')] || '已通知').trim(),
        isOpened: String(row[headers.indexOf('是否已拆')] || '').trim(),
        isShipped: String(row[headers.indexOf('卡片是否寄出')] || '').trim(),
        isCleared: String(row[headers.indexOf('結清')] || '').trim(),
        paymentMethod: String(row[headers.indexOf('付款方式')] || '').trim(),
        remark: String(row[headers.indexOf('備註')] || '').trim()
      };
      
      if (breakItem.phone && breakItem.breakId) {
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
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
        merchantTradeNo: String(row[headers.indexOf('商店訂單編號')] || '').trim(),
        phone: String(row[headers.indexOf('手機')] || '').replace(/^'/, '').trim(),
        nickname: String(row[headers.indexOf('暱稱')] || '').trim(),
        amount: parseFloat(row[headers.indexOf('金額')] || 0),
        paymentType: String(row[headers.indexOf('付款類型')] || '').trim(),
        paymentMethod: String(row[headers.indexOf('付款方式')] || '綠界信用卡').trim(),
        status: String(row[headers.indexOf('付款狀態')] || 'pending').trim(),
        tradeNo: String(row[headers.indexOf('綠界交易編號')] || '').trim(),
        paymentDate: row[headers.indexOf('付款時間')] || null,
        orderDetails: String(row[headers.indexOf('訂單明細')] || '').trim()
      };
      
      // 轉換付款時間
      if (payment.paymentDate instanceof Date) {
        payment.paymentDate = payment.paymentDate.toISOString();
      }
      
      // 解析訂單明細 JSON
      if (payment.orderDetails) {
        try {
          payment.orderDetails = JSON.parse(payment.orderDetails);
        } catch (e) {
          payment.orderDetails = null;
        }
      }
      
      if (payment.merchantTradeNo) {
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
// 測試導出函數
// ============================================
function testExportFunctions() {
  Logger.log('=== 測試導出用戶 ===');
  var usersResult = exportAllUsers();
  Logger.log(JSON.stringify(usersResult));
  
  Logger.log('\n=== 測試導出訂單 ===');
  var ordersResult = exportAllOrders();
  Logger.log(JSON.stringify(ordersResult));
  
  Logger.log('\n=== 測試導出團拆 ===');
  var breaksResult = exportAllBreaks();
  Logger.log(JSON.stringify(breaksResult));
  
  Logger.log('\n=== 測試導出團拆金 ===');
  var creditsResult = exportAllBreakCredits();
  Logger.log(JSON.stringify(creditsResult));
  
  Logger.log('\n=== 測試導出付款記錄 ===');
  var paymentsResult = exportAllPayments();
  Logger.log(JSON.stringify(paymentsResult));
}
