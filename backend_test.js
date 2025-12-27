/********** Google Apps Script 後端 - 測試環境版本 **********/
const SPREADSHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();

/* ================================================================
💳 綠界金流設定 - 測試環境
================================================================ */
const ECPAY_CONFIG = {
  // ✅ 測試環境資料
  MerchantID: '3002607',                 // 測試環境特店編號
  HashKey: 'pwFHCqoQZGmho4w6',           // 測試環境 HashKey
  HashIV: 'EkRm7iFT261dpevs',            // 測試環境 HashIV
  
  // 測試環境 API 網址
  PaymentURL: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  QueryURL: 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
  
  // ⚠️ 回傳網址 - 請更新為您的測試環境 GAS URL
  ReturnURL: 'https://script.google.com/macros/s/AKfycbxU_5-Ent6tRov1vpHS9u1UD3CG_D2WMN4spZi4pTPl6KqrqYRP6B8Cj8wC7H6GKJOT/exec',
  
  // ⚠️ 付款完成後客戶瀏覽器要返回的網址 - 請更新為您的測試環境前端網址
  ClientBackURL: 'https://demo.cnkuoc.workers.dev/',
  
  // 付款方式設定
  ChoosePayment: 'Credit',  // Credit=只開放信用卡付款 (ALL=信用卡/ATM, ATM=只ATM轉帳)
  
  // 運費設定
  ShippingFee: 60,              // 基本運費
  FreeShippingThreshold: 3000   // 卡盒免運門檻
};

/* ================================================================
🌟 自動觸發函數：建立選單與監聽出貨勾選
================================================================ */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🎴 管理員功能')
      .addItem('📋 生成待出貨報表', 'generateShippingReport')
      .addItem('📦 建立出貨紀錄', 'processShipmentFromSheet')
      .addSeparator()
      .addItem('💰 手動補運費', 'addShippingFeeManual')
      .addSeparator()
      .addItem('📬 發送到貨通知', 'sendArrivalNotificationManual')
      .addSeparator()
      .addSubMenu(ui.createMenu('📧 郵件測試')
        .addItem('✅ 檢查郵件權限', 'checkEmailPermissions')
        .addItem('📬 測試到貨通知', 'testArrivalNotification')
        .addItem('📮 測試出貨通知', 'testShipmentNotification'))
      .addToUi();
  } catch (e) {
    console.log("⚠️ onOpen 是自動觸發函式，請直接重新整理 Google Sheet 網頁即可看到選單。");
  }
}

/* 🌟 自動觸發已停用 - 改為手動發送到貨通知 🌟 */
function onEdit(e) {
  // 自動到貨通知已停用
  // 請使用選單「🎴 管理員功能」→「📬 發送到貨通知」來手動發送
  return;
}

function doGet() {
  return HtmlService.createHtmlOutput('GAS Backend - JSON API Server')
    .setTitle('Ning\'s Card Store Backend')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    // 立即記錄收到請求
    Logger.log('========== doPost 被調用 ==========');
    
    if (!e || !e.postData) {
      Logger.log('錯誤: 沒有 postData');
      return ContentService.createTextOutput('0|No Data').setMimeType(ContentService.MimeType.TEXT);
    }
    
    Logger.log('原始請求體: ' + (e.postData.contents || 'empty'));
    Logger.log('e.parameter: ' + JSON.stringify(e.parameter || {}));
    Logger.log('e.parameters: ' + JSON.stringify(e.parameters || {}));
    
    // 判斷是綠界回調還是一般 API 請求
    var payload = {};
    var action = '';
    
    // 檢查是否為綠界回調（form data）
    if (e.parameter && e.parameter.MerchantTradeNo) {
      // 綠界回調使用 form-urlencoded 格式
      Logger.log('✅ 檢測到綠界付款回調');
      Logger.log('MerchantTradeNo: ' + e.parameter.MerchantTradeNo);
      var result = handleEcpayCallback(e.parameter);
      Logger.log('回調處理完成，回傳: ' + result.getContent());
      return result;
    } else if (e.parameters && e.parameters.MerchantTradeNo) {
      // 有些情況參數在 e.parameters 中
      Logger.log('✅ 檢測到綠界付款回調 (parameters)');
      var params = {};
      for (var key in e.parameters) {
        params[key] = e.parameters[key][0]; // parameters 是陣列格式
      }
      Logger.log('轉換後參數: ' + JSON.stringify(params));
      var result = handleEcpayCallback(params);
      Logger.log('回調處理完成，回傳: ' + result.getContent());
      return result;
    } else {
      // 一般 API 請求使用 JSON 格式
      payload = JSON.parse(e.postData.contents || '{}');
      action = payload.action || '';
      Logger.log('doPost 收到請求, action: ' + action);
    }
    
    switch(action) {
      case 'getOrderCatalog':
        return returnJSON(getOrderCatalog(payload.requestingUser));
      case 'getOrderInfo':
        console.log('getOrderInfo 參數: phone=', payload.phone, 'birthday=', payload.birthday);
        return returnJSON(getOrderInfo(payload.phone, payload.birthday));
      case 'addOrderEntriesToMain':
        return returnJSON(addOrderEntriesToMain(payload));
      case 'notifyPaymentBulk':
        return returnJSON(notifyPaymentBulk(payload));
      case 'getPendingPaymentKeys':
        return returnJSON(getPendingPaymentKeys(payload.nickname, payload.phone));
      case 'registerUser':
        return returnJSON(registerUser(payload));
      case 'processOrderSubmission':
        return returnJSON(processOrderSubmission(payload));
      case 'submitPsaOrder':
        return returnJSON(processOrderSubmission(payload));
      case 'lookupOrderStatus':
        return returnJSON(lookupOrderStatus(payload.query));
      case 'lookupPsaOrders':
        return returnJSON(lookupOrderStatus(payload.phone));
      case 'notifyProfileUpdate':
        return returnJSON(notifyProfileUpdate(payload));
      case 'submitPaymentNotification':
        return returnJSON(submitPaymentNotification(payload));
      case 'createShipmentRecord':
        return returnJSON(createShipmentRecord(payload));
      case 'getShipmentRecords':
        return returnJSON(getShipmentRecords(payload.phone));
      case 'createEcpayPayment':
        return returnJSON(createEcpayPayment(payload));
      case 'checkPaymentStatus':
        return returnJSON(checkPaymentStatus(payload.merchantTradeNo));
      case 'updateOrderStatusToPending':
        return returnJSON(updateOrderStatusToPending(payload.orderDetails, payload.merchantTradeNo));
      case 'updateBreakStatusToPending':
        return returnJSON(updateBreakStatusToPending(payload.breakDetails || payload.orderDetails, payload.merchantTradeNo));
      case 'checkDailyFortune':
        return returnJSON(checkDailyFortune(payload.phone));
      case 'saveDailyFortune':
        return returnJSON(saveDailyFortune(payload.phone, payload.nickname, payload.result));
      default:
        return returnJSON({ success: false, message: '未知的 action: ' + action });
    }
  } catch (err) {
    return returnJSON({ success: false, message: '系統錯誤: ' + err.toString() });
  }
}

function returnJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

const SpreadsheetManager = { 
  openSpreadsheet() { return SpreadsheetApp.openById(SPREADSHEET_ID); } 
};

function formatDate(date) {
  if (!date) return '';
  let s = '';
  if (date instanceof Date) {
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    s = m + d;
  } else {
    s = String(date).trim();
  }
  s = s.replace(/\D/g, '');
  if (s.length === 4) return s;
  if (s.length === 8) return s.substring(4);
  return s;
}

function colToA1_(col){
  let s = '';
  while (col > 0) {
    const m = (col - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    col = (col - 1 - m) / 26;
  }
  return s;
}

function getOrderCatalog(requestingUser) {
  const ss = SpreadsheetManager.openSpreadsheet();
  const sh = ss.getSheetByName('下單商品');
  if (!sh) return { success: true, items: [], allStats: [] };

  const vals = sh.getDataRange().getValues();
  if (!vals.length) return { success: true, items: [], allStats: [] };
  const h = vals[0];

  const idx = {
    item: h.indexOf('品項'), card: h.indexOf('卡號'), price: h.indexOf('單價'),
    open: h.indexOf('是否開放'), img1: h.indexOf('圖片連結_1'), img2: h.indexOf('圖片連結_2'),
    img3: h.indexOf('圖片連結_3'), img4: h.indexOf('圖片連結_4'), th: h.indexOf('優惠門檻'),
    full: h.indexOf('門檻價'), min: h.indexOf('最低開團張數'), sp: h.indexOf('可抽_SP'),
    sign: h.indexOf('可抽_簽名'), relic: h.indexOf('可抽_Relic'), ar: h.indexOf('可抽_auto_relic'),
    isBox: h.indexOf('卡盒預購'), isDirect: h.indexOf('是否可直接訂購'), stock: h.indexOf('剩餘數量'),
    arrival: h.indexOf('到貨狀況'), closeTime: h.indexOf('預定下架時間'), stat: h.indexOf('已訂單卡張數'),
    category: h.indexOf('分類')
  };

  const items = [];
  const allStats = [];

  for (let i = 1; i < vals.length; i++) {
    const r = vals[i];
    const openFlag = String(r[idx.open] || '').trim().toUpperCase();
    const isOpen = (openFlag === 'Y' || openFlag === 'YES' || openFlag === '是');

    allStats.push({ 
      item: r[idx.item] || '', 
      cardNo: r[idx.card] || '', 
      totalOrdered: idx.stat > -1 ? Number(r[idx.stat] || 0) : 0 
    });

    let closeTimeStr = '';
    if (idx.closeTime > -1 && r[idx.closeTime] instanceof Date) {
      closeTimeStr = r[idx.closeTime].toISOString();
    }

    items.push({
      item: r[idx.item] || '',
      cardNo: r[idx.card] || '',
      price: Number(r[idx.price] || 0) || 0,
      images: [idx.img1, idx.img2, idx.img3, idx.img4]
        .map(k => k > -1 ? (r[k] || '') : '')
        .filter(Boolean),
      threshold: idx.th > -1 ? Number(r[idx.th] || 0) : 0,
      fullPrice: idx.full > -1 ? Number(r[idx.full] || 0) : 0,
      minGroup: idx.min > -1 ? Number(r[idx.min] || 0) : 0,
      sp: idx.sp > -1 ? String(r[idx.sp] || '') : '',
      sign: idx.sign > -1 ? String(r[idx.sign] || '') : '',
      relic: idx.relic > -1 ? String(r[idx.relic] || '') : '',
      autoRelic: idx.ar > -1 ? String(r[idx.ar] || '') : '',
      isBox: idx.isBox > -1 ? String(r[idx.isBox] || '').toUpperCase() : '',
      isDirect: idx.isDirect > -1 ? String(r[idx.isDirect] || '').toUpperCase() : '',
      stock: idx.stock > -1 ? Number(r[idx.stock] || 0) : 0,
      arrivalStatus: idx.arrival > -1 ? String(r[idx.arrival] || '').trim().toUpperCase() : '',
      closeTime: closeTimeStr,
      isOpen: isOpen,
      category: idx.category > -1 ? String(r[idx.category] || '').trim() : ''
    });
  }

  return { success: true, items: items, allStats: allStats };
}

function getOrderInfo(phone, birthday) {
  console.log('getOrderInfo 被呼叫, phone:', phone, 'birthday:', birthday);
  
  try {
    const ss = SpreadsheetManager.openSpreadsheet();
    const cs = ss.getSheetByName('客戶資料');
    if (!cs) return { success: false, message: '找不到「客戶資料」頁籤' };

    const cData = cs.getDataRange().getValues();
    const cHead = cData[0].map(h => String(h).trim());
    
    // Debug: 輸出所有欄位名稱
    Logger.log('getOrderInfo - 客戶資料表所有欄位: ' + JSON.stringify(cHead));
    
    const cIdx = {
      phone: cHead.indexOf('電話'),
      birth: cHead.indexOf('生日'),
      nick: cHead.indexOf('群組暱稱'),
      name: cHead.indexOf('姓名'),
      addr: cHead.indexOf('7-11店到店門市'),
      shipStore: cHead.indexOf('收件用門市'),
      storeNum: cHead.indexOf('711店號'),
      email: cHead.findIndex(h => String(h).trim().toLowerCase() === 'email')
    };
    
    Logger.log('getOrderInfo - email欄位索引: ' + cIdx.email);

    if (cIdx.phone === -1 || cIdx.birth === -1 || cIdx.nick === -1) {
      return { success: false, message: '系統錯誤：客戶資料表缺少必要欄位' };
    }

    let info = null;
    const targetPhone = String(phone).replace(/\D/g, '');
    const targetBirth = String(birthday).replace(/\D/g, '');

    for (let i = 1; i < cData.length; i++) {
      const r = cData[i];
      const p = String(r[cIdx.phone] || '').replace(/\D/g, '');
      const b = formatDate(r[cIdx.birth]);
      if (p === targetPhone && b === targetBirth) {
        const emailValue = (cIdx.email > -1) ? String(r[cIdx.email] || '').trim() : '';
        Logger.log('getOrderInfo - 讀取到的email: [' + emailValue + ']');
        
        info = {
          nickname: String(r[cIdx.nick]).trim(),
          customerName: r[cIdx.name],
          phone: phone, // 使用傳入的原始電話號碼,保留開頭的 0
          address: (cIdx.addr > -1) ? r[cIdx.addr] : '',
          shipStore: (cIdx.shipStore > -1) ? r[cIdx.shipStore] : '',
          storeNumber: (cIdx.storeNum > -1) ? r[cIdx.storeNum] : '',
          email: emailValue
        };
        break;
      }
    }

    if (!info) {
      return { success: false, message: '找不到資料，請確認電話與生日是否正確。' };
    }

    // 讀取訂單
    // 🌟 強制刷新快取，確保讀取最新資料
    SpreadsheetApp.flush();
    const os = ss.getSheetByName('Topps_Now_訂購總表');
    let orders = [];
    if (os) {
      const oData = os.getDataRange().getValues();
      if (oData.length > 1) {
        const oHead = oData[0].map(h => String(h).trim());
        let boxColIdx = oHead.indexOf('卡盒訂單');
        if (boxColIdx === -1) boxColIdx = oHead.indexOf('卡盒預購');

        const h = {
          buyer: oHead.indexOf('訂購人'),
          item: oHead.indexOf('品項'),
          qty: oHead.indexOf('張數'),
          price: oHead.indexOf('單價'),
          total: oHead.indexOf('總價'),
          deposit: oHead.indexOf('訂金'),
          balance: oHead.indexOf('尾款'),
          shipped: oHead.indexOf('寄出'),
          cardNo: oHead.indexOf('卡號'),
          arrival: oHead.indexOf('到貨狀態'),
          imgUrl: oHead.indexOf('圖片連結'),
          timestamp: oHead.indexOf('時間戳記'),
          status: oHead.indexOf('狀態'),
          isBox: boxColIdx
        };

        if (h.buyer > -1) {
          const agg = new Map();
          for (let i = 1; i < oData.length; i++) {
            const r = oData[i];
            if (String(r[h.buyer]).trim() === info.nickname) {
              const item = String(r[h.item] || '');
              const cardNo = h.cardNo > -1 ? r[h.cardNo] : '';

              let isBoxFlag = 'N';
              let rawVal = h.isBox > -1 ? String(r[h.isBox] || '').trim().toUpperCase() : '';
              if (rawVal === 'Y' || rawVal === 'YES' || rawVal === '是') {
                isBoxFlag = 'Y';
              } else if (rawVal === 'N' || rawVal === 'NO' || rawVal === '否') {
                isBoxFlag = 'N';
              } else {
                const up = item.toUpperCase();
                if (up.includes('BOX') || up.includes('CASE') || up.includes('HOBBY') || 
                    up.includes('JUMBO') || up.includes('BREAKER') || up.includes('盒') || up.includes('箱')) {
                  isBoxFlag = 'Y';
                }
              }

              const key = `${item}||${cardNo}||${isBoxFlag}`;

              if (!agg.has(key)) {
                agg.set(key, {
                  item: item,
                  cardNo: cardNo,
                  price: h.price > -1 ? Number(r[h.price] || 0) : 0,
                  originalPrice: h.price > -1 ? Number(r[h.price] || 0) : 0, // 🔑 記錄第一筆的原始單價
                  quantity: 0,
                  total: 0,
                  deposit: 0,
                  balance: 0,
                  shipped: '',
                  arrival: '',
                  status: '',
                  imageUrl: h.imgUrl > -1 ? r[h.imgUrl] : '',
                  isBox: isBoxFlag,
                  timestamp: h.timestamp > -1 ? r[h.timestamp] : ''
                });
              }

              const acc = agg.get(key);
              const qty = Number(r[h.qty] || 0);
              const rowPrice = Number(r[h.price] || 0);
              
              acc.quantity += qty;
              // 🔑 只在第一次設定價格,之後不再覆蓋(避免被其他筆資料覆蓋)
              if (!acc.originalPrice) {
                acc.originalPrice = rowPrice;
              }
              acc.price = rowPrice; // 保留最後一筆的價格(用於顯示)
              acc.total += Number(r[h.total] || 0);
              acc.deposit += Number(r[h.deposit] || 0);
              acc.balance += Number(r[h.balance] || 0);
              
              // 更新時間戳記 (保留最早的)
              if (h.timestamp > -1 && r[h.timestamp]) {
                const currentTs = r[h.timestamp];
                if (!acc.timestamp || currentTs < acc.timestamp) {
                  acc.timestamp = currentTs;
                }
              }
              
              const shippedVal = String(r[h.shipped] || '').trim();
              if (shippedVal.toUpperCase().includes('Y') || shippedVal.includes('是') || shippedVal === 'Y') {
                acc.shipped = 'Y';
              }
              const arrivalVal = String(r[h.arrival] || '').trim();
              if (arrivalVal === 'V' || arrivalVal.toUpperCase().includes('V')) {
                acc.arrival = 'V';
              }
              
              // 更新狀態 (保留最新的非空狀態)
              if (h.status > -1) {
                const statusVal = String(r[h.status] || '').trim();
                if (statusVal) {
                  acc.status = statusVal;
                }
              }
            }
          }
          // 讀取商品目錄以檢查門檻價格
          const productSheet = ss.getSheetByName('下單商品');
          const productLookup = new Map();
          
          if (productSheet) {
            const productData = productSheet.getDataRange().getValues();
            if (productData.length > 1) {
              const productHeader = productData[0];
              const productIdx = {
                item: productHeader.indexOf('品項'),
                cardNo: productHeader.indexOf('卡號'),
                threshold: productHeader.indexOf('優惠門檻'),
                fullPrice: productHeader.indexOf('門檻價'),
                totalOrdered: productHeader.indexOf('已訂單卡張數')
              };
              
              for (let i = 1; i < productData.length; i++) {
                const row = productData[i];
                const item = String(row[productIdx.item] || '').trim();
                const cardNo = String(row[productIdx.cardNo] || '').trim();
                const threshold = productIdx.threshold > -1 ? Number(row[productIdx.threshold] || 0) : 0;
                const fullPrice = productIdx.fullPrice > -1 ? Number(row[productIdx.fullPrice] || 0) : 0;
                const totalOrdered = productIdx.totalOrdered > -1 ? Number(row[productIdx.totalOrdered] || 0) : 0;
                
                const key = item + '||' + cardNo;
                productLookup.set(key, { 
                  threshold: threshold, 
                  fullPrice: fullPrice,
                  totalOrdered: totalOrdered
                });
              }
            }
          }
          
          // 組合訂單狀態並檢查門檻價格
          orders = Array.from(agg.values()).map(order => {
            // arrivalStatus - 用於前端分類篩選(準備中-未到貨/準備中-已到貨/已寄出)
            // 根據實際欄位值推導: 寄出=Y → 已寄出, 到貨狀態=V → 準備中-已到貨, 其他 → 準備中-未到貨
            let arrivalStatus = '準備中-未到貨';
            if (order.shipped === 'Y') {
              arrivalStatus = '已寄出';
            } else if (order.arrival === 'V') {
              arrivalStatus = '準備中-已到貨';
            }
            
            // status - 直接從「狀態」欄位讀取(付款確認中、已結清等),用於前端顯示標籤
            // 注意:「到貨狀態」欄位仍維持原本的 V/0 值,不受影響
            const status = order.status || '';
            
            // 檢查全站累積是否達到門檻
            const productKey = String(order.item).trim() + '||' + String(order.cardNo).trim();
            const productInfo = productLookup.get(productKey);
            
            // 🌟 加入全站累積數量
            let totalOrdered = 0;
            if (productInfo) {
              totalOrdered = productInfo.totalOrdered || 0;
              
              if (productInfo.threshold > 0 && productInfo.fullPrice > 0) {
                // 使用全站累積張數判斷是否達到門檻
                if (totalOrdered >= productInfo.threshold) {
                  // 🔑 判斷是否為手動調整過的金額
                  // 使用 originalPrice (第一筆的原始單價) 來判斷,避免被聚合時覆蓋
                  const originalPrice = order.originalPrice || order.price;
                  const calculatedTotal = order.quantity * originalPrice;
                  const isManuallyAdjusted = Math.abs(order.total - calculatedTotal) > 0.01; // 允許小數點誤差
                  
                  if (!isManuallyAdjusted) {
                    // 未手動調整,使用門檻價重新計算
                    order.price = productInfo.fullPrice;
                    order.total = order.quantity * productInfo.fullPrice;
                    order.balance = order.total - order.deposit;
                  }
                  // 如果已手動調整,保留 Sheet 中的原始值 (不修改 price, total, balance)
                }
              }
            }
            
            return { 
              ...order, 
              arrivalStatus: arrivalStatus,  // 用於前端分類篩選(準備中-未到貨/準備中-已到貨/已寄出)
              status: status,                // 用於前端顯示標籤(付款確認中/已結清等)
              累積張數: totalOrdered 
            };
          });
        }
      }
    }

    // 讀取團拆
    // 🌟 強制刷新快取，確保讀取最新資料
    SpreadsheetApp.flush();
    const gs = ss.getSheetByName('團拆紀錄');
    let groupBreaks = [];
    if (gs) {
      const gData = gs.getDataRange().getValues();
      if (gData.length > 1) {
        const gHead = gData[0].map(h => String(h).trim());
        const gIdx = {
          buyer: gHead.indexOf('訂購人'),
          id: gHead.indexOf('團拆編號'),
          type: gHead.indexOf('種類'),
          name: gHead.indexOf('團名'),
          format: gHead.indexOf('團拆形式'),
          item: gHead.indexOf('購買品項'),
          totalFee: gHead.indexOf('總團費'),
          paid: gHead.indexOf('已付金額'),
          opened: gHead.indexOf('是否已拆'),
          shipped: gHead.indexOf('卡片是否寄出'),
          status: gHead.indexOf('狀態'),
          paymentMethod: gHead.indexOf('付款方式'),
          ecpayTradeNo: gHead.indexOf('綠界訂單號'),
          paymentTime: gHead.indexOf('付款時間')
        };

        if (gIdx.buyer > -1) {
          for (let i = 1; i < gData.length; i++) {
            const r = gData[i];
            if (String(r[gIdx.buyer]).trim() === info.nickname) {
              const totalFee = Number(r[gIdx.totalFee] || 0);
              const paid = Number(r[gIdx.paid] || 0);
              const balance = totalFee - paid;
              const statusText = gIdx.status > -1 ? String(r[gIdx.status] || '').trim() : '';
              
              groupBreaks.push({
                id: r[gIdx.id] || '',
                type: gIdx.type > -1 ? r[gIdx.type] : '',
                name: r[gIdx.name] || '',
                format: gIdx.format > -1 ? r[gIdx.format] : '',
                item: r[gIdx.item] || '',
                totalFee: totalFee,
                paid: paid,
                balance: balance,
                opened: String(r[gIdx.opened] || '').toUpperCase(),
                shipped: String(r[gIdx.shipped] || '').toUpperCase(),
                status: statusText,
                paymentMethod: gIdx.paymentMethod > -1 ? r[gIdx.paymentMethod] : '',
                ecpayTradeNo: gIdx.ecpayTradeNo > -1 ? r[gIdx.ecpayTradeNo] : '',
                paymentTime: gIdx.paymentTime > -1 ? r[gIdx.paymentTime] : ''
              });
            }
          }
        }
      }
    }

    // 檢查付款通知暫存,標記已通知的訂單和團拆
    try {
      const paymentNotificationSheet = ss.getSheetByName('付款通知暫存');
      if (paymentNotificationSheet) {
        const notificationData = paymentNotificationSheet.getDataRange().getValues();
        console.log('付款通知暫存資料行數:', notificationData.length);
        
        if (notificationData.length > 1) {
          const notificationHeader = notificationData[0];
          console.log('付款通知暫存標題:', notificationHeader);
          
          const notificationIdx = {
            nickname: notificationHeader.indexOf('Nickname'),
            phone: notificationHeader.indexOf('Phone'),
            item: notificationHeader.indexOf('Item'),
            cardNo: notificationHeader.indexOf('CardNo'),
            status: notificationHeader.indexOf('Status')
          };
          
          console.log('欄位索引:', notificationIdx);
          
          // 建立已通知訂單的 Set
          const notifiedOrderSet = new Set();
          const notifiedBreakSet = new Set(); // 團拆編號
          
          for (let i = 1; i < notificationData.length; i++) {
            const row = notificationData[i];
            const rowNickname = String(row[notificationIdx.nickname] || '').trim();
            const rowPhone = String(row[notificationIdx.phone] || '').replace(/\D/g, '');
            const targetPhone = String(info.phone).replace(/\D/g, '');
            const rowStatus = String(row[notificationIdx.status] || '').trim();
            
            // 檢查是否為當前用戶
            if (rowNickname === info.nickname || rowPhone === targetPhone) {
              const item = String(row[notificationIdx.item] || '').trim();
              const cardNo = String(row[notificationIdx.cardNo] || '').trim();
              
              if (rowStatus === 'break') {
                // 團拆付款通知,cardNo 欄位存的是團拆編號
                console.log('找到團拆付款通知:', cardNo);
                notifiedBreakSet.add(cardNo);
              } else {
                // 訂單付款通知
                // 🌟 將 '-' 視為空字串,統一處理卡盒訂單
                const normalizedCardNo = cardNo === '-' ? '' : cardNo;
                const orderKey = item + (normalizedCardNo ? ' #' + normalizedCardNo : '');
                console.log('找到訂單付款通知:', orderKey);
                notifiedOrderSet.add(orderKey);
              }
            }
          }
          
          console.log('已通知訂單集合:', Array.from(notifiedOrderSet));
          console.log('已通知團拆集合:', Array.from(notifiedBreakSet));
          
          // 標記訂單為已通知
          orders.forEach(order => {
            const orderCardNo = String(order.cardNo || '').trim();
            // 🌟 將 '-' 視為空字串,統一處理卡盒訂單
            const normalizedCardNo = orderCardNo === '-' ? '' : orderCardNo;
            const orderKey = (order.item || '') + (normalizedCardNo ? ' #' + normalizedCardNo : '');
            if (notifiedOrderSet.has(orderKey)) {
              order.paymentNotified = true;
              console.log('標記訂單為已通知:', orderKey);
            }
          });
          
          // 標記團拆為已通知
          groupBreaks.forEach(breakItem => {
            const breakId = String(breakItem.id || '').trim();
            if (notifiedBreakSet.has(breakId)) {
              breakItem.paymentNotified = true;
              console.log('標記團拆為已通知:', breakId);
            }
          });
          
          console.log('標記完成 - 訂單:', orders.filter(o => o.paymentNotified).length, '團拆:', groupBreaks.filter(b => b.paymentNotified).length);
        }
      } else {
        console.log('付款通知暫存 sheet 不存在');
      }
    } catch (e) {
      console.log('檢查付款通知暫存時發生錯誤:', e);
    }

    console.log('返回訂單總數:', orders.length, '已通知數:', orders.filter(o => o.paymentNotified).length);

    return {
      success: true,
      customerName: info.customerName,
      nickname: info.nickname,
      phone: info.phone,
      address: info.address,
      shipStore: info.shipStore,
      storeNumber: info.storeNumber,
      email: info.email,
      orders: orders,
      groupBreaks: groupBreaks
    };
  } catch (err) {
    return { success: false, message: '系統錯誤：' + err.toString() };
  }
}

function getPendingPaymentKeys(nickname, phone) {
  try {
    const ss = SpreadsheetManager.openSpreadsheet();
    let sh = ss.getSheetByName('付款通知暫存');
    if (!sh) return { success: true, keys: [] };

    const vals = sh.getDataRange().getValues();
    const header = vals && vals.length ? vals[0].map(h => String(h).trim()) : [];
    const idx = {
      Nickname: header.indexOf('Nickname') > -1 ? header.indexOf('Nickname') : 1,
      Phone: header.indexOf('Phone') > -1 ? header.indexOf('Phone') : 2,
      Key: header.indexOf('Key') > -1 ? header.indexOf('Key') : 3,
      Status: header.indexOf('Status') > -1 ? header.indexOf('Status') : 10
    };

    const normPhone = String(phone || '').replace(/\D/g, '');
    const keys = [];

    for (let i = 1; i < vals.length; i++) {
      const row = vals[i];
      try {
        const rowNick = String(row[idx.Nickname] || '').trim();
        const rowStatus = String(row[idx.Status] || '').trim().toLowerCase();
        const rowPhone = String(row[idx.Phone] || '').replace(/\D/g, '');

        if (rowStatus === 'pending' && String(rowNick) === String(nickname).trim()) {
          if (!normPhone || rowPhone === normPhone) {
            keys.push(String(row[idx.Key] || '').trim());
          }
        }
      } catch (e) { }
    }

    return { success: true, keys };
  } catch (e) {
    return { success: false, message: e.toString(), keys: [] };
  }
}

function notifyPaymentBulk(payload) {
  try {
    const to = 'ningscard@gmail.com';
    const subject = '【付款通知】' + payload.nickname + ' 提交付款資訊';
    const lines = (payload.orders || []).map(function(o, i) {
      let type = '[單卡]';
      const boxFlag = String(o.isBox || '').toUpperCase();
      
      if (boxFlag === 'Y') type = '[卡盒]';
      else if (boxFlag === 'GB') type = '[團拆]';
      
      return '  - [' + (i + 1) + '] ' + type + ' ' + (o.item || '-') + ' / 內容: ' + (o.cardNo || '-') +
             ' / 金額: ' + (o.total || '-');
    }).join('\n');
    
    const body =
      '暱稱：' + (payload.nickname || '') + '\n' +
      '姓名：' + (payload.customerName || '') + '\n' +
      '電話：' + (payload.phone || '') + '\n' +
      '金額：' + (payload.amount || '(未填寫)') + '\n' +
      '備註：' + (payload.remark || '(未填寫)') + '\n' +
      '項目：\n' + lines;

    MailApp.sendEmail({ to: to, subject: subject, body: body });

    const ss = SpreadsheetManager.openSpreadsheet();
    let sh = ss.getSheetByName('付款通知暫存');
    if (!sh) {
      sh = ss.insertSheet('付款通知暫存');
      sh.appendRow(['Timestamp', 'Nickname', 'Phone', 'Key', 'Item', 'CardNo', 'Quantity', 'Total', 'Amount', 'Remark', 'Status', 'isBox']);
    }

    const now = new Date();
    const rows = [];
    const disabledKeys = [];

    payload.orders.forEach(function(o) {
      const isBoxFlag = String(o.isBox || '').toUpperCase();
      const key = [payload.nickname, o.item, o.cardNo, o.quantity, o.total, (isBoxFlag === 'Y' ? 'Y' : isBoxFlag === 'GB' ? 'GB' : 'N')].join('||');
      disabledKeys.push(key);
      rows.push([now, payload.nickname, payload.phone, key, o.item, o.cardNo, o.quantity, o.total, payload.amount, payload.remark, 'pending', isBoxFlag]);
    });

    if (rows.length) {
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return { success: true, disabledKeys: disabledKeys };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function addOrderEntriesToMain(payload) {
  if (!payload || !payload.nickname || !payload.entries.length) {
    return { success: false, message: '資料不完整' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const ss = SpreadsheetManager.openSpreadsheet();
    const os = ss.getSheetByName('Topps_Now_訂購總表');

    if (!os) return { success: false, message: '找不到訂購表' };

    const oh = os.getRange(1, 1, 1, os.getLastColumn()).getValues()[0];
    const width = oh.length;
    const idx = {
      buyer: oh.indexOf('訂購人'),
      item: oh.indexOf('品項'),
      qty: oh.indexOf('張數'),
      price: oh.indexOf('單價'),
      total: oh.indexOf('總價'),
      deposit: oh.indexOf('訂金'),
      balance: oh.indexOf('尾款'),
      shipped: oh.indexOf('寄出'),
      cardNo: oh.indexOf('卡號'),
      arrival: oh.indexOf('到貨狀態') > -1 ? oh.indexOf('到貨狀態') : oh.indexOf('到貨狀況'),
      imgUrl: oh.indexOf('圖片連結'),
      timestamp: oh.indexOf('時間戳記'),
      isBox: oh.indexOf('卡盒訂單')
    };

    // 讀取「下單商品」表以查詢到貨狀況和圖片連結
    const productSheet = ss.getSheetByName('下單商品');
    const productLookup = new Map();
    const productLookupByItem = new Map(); // key: item (for boxes)
    
    // 🔒 庫存檢查 - 在處理訂單前先檢查卡盒庫存
    if (productSheet) {
      const productData = productSheet.getDataRange().getValues();
      if (productData.length > 1) {
        const productHeader = productData[0];
        const stockCheckIdx = {
          item: productHeader.indexOf('品項'),
          stock: productHeader.indexOf('剩餘數量'),
          isBox: productHeader.indexOf('卡盒預購')
        };
        
        if (stockCheckIdx.item > -1 && stockCheckIdx.stock > -1 && stockCheckIdx.isBox > -1) {
          // 建立庫存查詢表 (只記錄卡盒商品)
          const stockMap = new Map(); // key: item, value: current stock
          for (let i = 1; i < productData.length; i++) {
            const row = productData[i];
            const itemName = String(row[stockCheckIdx.item] || '').trim();
            const isBoxValue = String(row[stockCheckIdx.isBox] || '').trim().toUpperCase();
            const stock = Number(row[stockCheckIdx.stock] || 0);
            
            if ((isBoxValue === 'Y' || isBoxValue === 'YES') && itemName) {
              stockMap.set(itemName, stock);
            }
          }
          
          // 檢查本次下單的卡盒商品是否超過庫存
          for (let i = 0; i < payload.entries.length; i++) {
            const entry = payload.entries[i];
            const isBoxFlag = String(entry.isBox).toUpperCase() === 'Y';
            
            if (isBoxFlag) {
              const itemName = String(entry.item || '').trim();
              const orderQty = Number(entry.qty || 0);
              const currentStock = stockMap.get(itemName) || 0;
              
              if (orderQty > currentStock) {
                Logger.log('庫存不足: ' + itemName + ' 下單 ' + orderQty + ' 盒 > 庫存 ' + currentStock + ' 盒');
                return { 
                  success: false, 
                  message: '【' + itemName + '】庫存不足！\\n目前剩餘: ' + currentStock + ' 盒\\n您要下單: ' + orderQty + ' 盒\\n\\n請重新整理頁面後再試' 
                };
              }
            }
          }
        }
      }
    }
    
    if (productSheet) {
      const productData = productSheet.getDataRange().getValues();
      if (productData.length > 1) {
        const productHeader = productData[0];
        const productIdx = {
          item: productHeader.indexOf('品項'),
          cardNo: productHeader.indexOf('卡號'),
          imgUrl: productHeader.indexOf('圖片連結_1'), // 第13欄 (M欄)
          arrival: productHeader.indexOf('到貨狀況') > -1 ? productHeader.indexOf('到貨狀況') : productHeader.indexOf('到貨狀態'),    // 第17欄 (Q欄)
          threshold: productHeader.indexOf('優惠門檻'),
          fullPrice: productHeader.indexOf('門檻價'),
          isBox: productHeader.indexOf('卡盒預購')
        };
        
        Logger.log('下單商品表欄位索引 - 品項: ' + productIdx.item + ', 卡號: ' + productIdx.cardNo + ', 圖片: ' + productIdx.imgUrl + ', 到貨: ' + productIdx.arrival);
        
        // 建立兩種查詢表: 1. 卡號查詢(單卡) 2. 品項查詢(卡盒)
        
        for (let i = 1; i < productData.length; i++) {
          const row = productData[i];
          const itemName = productIdx.item > -1 ? String(row[productIdx.item] || '').trim() : '';
          const cardNo = productIdx.cardNo > -1 ? String(row[productIdx.cardNo] || '').trim() : '';
          const imgUrl = productIdx.imgUrl > -1 ? String(row[productIdx.imgUrl] || '') : '';
          const arrivalRaw = productIdx.arrival > -1 ? row[productIdx.arrival] : '';
          const arrival = arrivalRaw ? String(arrivalRaw).trim() : '';
          const threshold = productIdx.threshold > -1 ? Number(row[productIdx.threshold] || 0) : 0;
          const fullPrice = productIdx.fullPrice > -1 ? Number(row[productIdx.fullPrice] || 0) : 0;
          const isBoxValue = productIdx.isBox > -1 ? String(row[productIdx.isBox] || '').trim().toUpperCase() : '';
          
          const productInfo = {
            imgUrl: imgUrl,
            arrival: arrival,
            threshold: threshold,
            fullPrice: fullPrice
          };
          
          // 單卡: 用卡號作為key
          if (cardNo) {
            productLookup.set(cardNo, productInfo);
            if (i <= 3) {
              Logger.log('卡號 [' + cardNo + '] - 圖片: [' + imgUrl + '], 到貨: [' + arrival + ']');
            }
          }
          
          // 卡盒: 用品項作為key
          if ((isBoxValue === 'Y' || isBoxValue === 'YES') && itemName) {
            productLookupByItem.set(itemName, productInfo);
            if (i <= 3) {
              Logger.log('卡盒品項 [' + itemName + '] - 圖片: [' + imgUrl + '], 到貨: [' + arrival + ']');
            }
          }
        }
        
        Logger.log('建立了 ' + productLookup.size + ' 筆卡號查詢資料, ' + productLookupByItem.size + ' 筆卡盒品項查詢資料');
      }
    }

    const startRow = os.getLastRow() + 1;
    const rows = [];
    const timestamp = new Date(); // 取得當前時間

    // 讀取現有訂單以便合併
    const existingData = os.getDataRange().getValues();
    const existingOrders = new Map(); // key: buyer||item||cardNo||isBox, value: [{row, data}, ...]
    
    for (let i = 1; i < existingData.length; i++) {
      const row = existingData[i];
      const buyer = idx.buyer > -1 ? String(row[idx.buyer] || '').trim() : '';
      const item = idx.item > -1 ? String(row[idx.item] || '').trim() : '';
      const cardNo = idx.cardNo > -1 ? String(row[idx.cardNo] || '').trim() : '';
      const isBox = idx.isBox > -1 ? String(row[idx.isBox] || '').trim().toUpperCase() : 'N';
      
      if (buyer === payload.nickname) {
        const key = buyer + '||' + item + '||' + cardNo + '||' + isBox;
        if (!existingOrders.has(key)) {
          existingOrders.set(key, []);
        }
        existingOrders.get(key).push({ row: i + 1, data: row });
      }
    }

    const agg = new Map();
    payload.entries.forEach(e => {
      const key = [e.item, e.cardNo, e.price, e.isBox].join('||');
      if (!agg.has(key)) agg.set(key, { ...e, qty: 0 });
      agg.get(key).qty += Number(e.qty);
    });

    const updatesToExisting = []; // 需要更新的現有訂單
    const rowsToDelete = []; // 需要刪除的多餘訂單列

    Array.from(agg.values()).forEach((e, i) => {
      const isBoxFlag = String(e.isBox).toUpperCase() === 'Y' ? 'Y' : 'N';
      const cardNoStr = String(e.cardNo || '').trim();
      const itemName = String(e.item || '').trim();
      
      // 🌟 根據是否為卡盒,選擇不同的查詢方式
      let productInfo = null;
      if (isBoxFlag === 'Y') {
        // 卡盒: 用品項查詢
        productInfo = productLookupByItem.get(itemName);
      } else {
        // 單卡: 用卡號查詢
        productInfo = productLookup.get(cardNoStr);
      }
      
      // 檢查是否達到優惠門檻
      let finalPrice = e.price;
      if (productInfo && productInfo.threshold > 0 && productInfo.fullPrice > 0) {
        if (e.qty >= productInfo.threshold) {
          finalPrice = productInfo.fullPrice;
          Logger.log((isBoxFlag === 'Y' ? '品項 ' + itemName : '卡號 ' + cardNoStr) + ' 數量 ' + e.qty + ' 達到門檻 ' + productInfo.threshold + ',價格從 ' + e.price + ' 改為 ' + finalPrice);
        }
      }
      
      const mergeKey = payload.nickname + '||' + e.item + '||' + cardNoStr + '||' + isBoxFlag;
      
      // 檢查是否已有相同商品的訂單(可能有多筆)
      if (existingOrders.has(mergeKey)) {
        const existingList = existingOrders.get(mergeKey);
        
        // 計算所有現有訂單的總數量和總訂金
        let totalExistingQty = 0;
        let totalExistingDeposit = 0;
        
        existingList.forEach(existing => {
          totalExistingQty += idx.qty > -1 ? Number(existing.data[idx.qty] || 0) : 0;
          totalExistingDeposit += idx.deposit > -1 ? Number(existing.data[idx.deposit] || 0) : 0;
        });
        
        const newQty = totalExistingQty + e.qty;
        const newTotal = newQty * finalPrice;
        const newBalance = newTotal - totalExistingDeposit;
        
        // 更新第一筆訂單
        updatesToExisting.push({
          row: existingList[0].row,
          qty: newQty,
          price: finalPrice,
          total: newTotal,
          balance: newBalance,
          timestamp: timestamp
        });
        
        // 標記其他訂單要刪除
        for (let j = 1; j < existingList.length; j++) {
          rowsToDelete.push(existingList[j].row);
        }
        
        Logger.log('合併訂單: ' + mergeKey + ' 原有 ' + existingList.length + ' 筆共 ' + totalExistingQty + ' 張 + 新 ' + e.qty + ' 張 = ' + newQty + ' 張');
      } else {
        // 新增新訂單
        const row = new Array(width).fill('');
        
        if (idx.buyer > -1) row[idx.buyer] = payload.nickname;
        if (idx.item > -1) row[idx.item] = e.item;
        if (idx.qty > -1) row[idx.qty] = e.qty;
        if (idx.price > -1) row[idx.price] = finalPrice;
        if (idx.total > -1) row[idx.total] = e.qty * finalPrice;
        if (idx.deposit > -1) row[idx.deposit] = 0;
        if (idx.cardNo > -1) row[idx.cardNo] = e.cardNo;
        if (idx.isBox > -1) row[idx.isBox] = isBoxFlag;
        if (idx.balance > -1) row[idx.balance] = e.qty * finalPrice;
        if (idx.timestamp > -1) row[idx.timestamp] = timestamp;
        
        // 填入從下單商品表查詢到的資料
        if (productInfo) {
          if (idx.imgUrl > -1) {
            row[idx.imgUrl] = String(productInfo.imgUrl);
          }
          if (idx.arrival > -1 && idx.item > -1) {
            const rowNum = startRow + rows.length;
            const itemCol = colToA1_(idx.item + 1);
            const arrivalFormula = `=IFERROR(VLOOKUP(${itemCol}${rowNum},'下單商品'!A:Q,17,FALSE),"")`;
            row[idx.arrival] = arrivalFormula;
          }
        }
        
        rows.push(row);
      }
    });

    // 先刪除多餘的訂單列(從後往前刪,避免列號變動)
    if (rowsToDelete.length > 0) {
      rowsToDelete.sort((a, b) => b - a); // 降序排列
      rowsToDelete.forEach(rowNum => {
        os.deleteRow(rowNum);
      });
      Logger.log('刪除了 ' + rowsToDelete.length + ' 筆重複訂單');
    }

    // 再更新現有訂單
    if (updatesToExisting.length > 0) {
      updatesToExisting.forEach(u => {
        if (idx.qty > -1) os.getRange(u.row, idx.qty + 1).setValue(u.qty);
        if (idx.price > -1) os.getRange(u.row, idx.price + 1).setValue(u.price);
        if (idx.total > -1) os.getRange(u.row, idx.total + 1).setValue(u.total);
        if (idx.balance > -1) os.getRange(u.row, idx.balance + 1).setValue(u.balance);
        if (idx.timestamp > -1) os.getRange(u.row, idx.timestamp + 1).setValue(u.timestamp);
      });
      Logger.log('更新了 ' + updatesToExisting.length + ' 筆現有訂單');
    }

    // 最後新增新訂單
    if (rows.length) {
      os.getRange(startRow, 1, rows.length, width).setValues(rows);
      Logger.log('新增了 ' + rows.length + ' 筆新訂單');
    }

    // 記錄訂單歷史到獨立的 sheet
    let historySheet = ss.getSheetByName('訂單歷史紀錄');
    if (!historySheet) {
      historySheet = ss.insertSheet('訂單歷史紀錄');
      historySheet.appendRow(['下單時間', '訂購人', '品項', '卡號', '張數']);
      historySheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }
    
    const historyRows = [];
    payload.entries.forEach(e => {
      historyRows.push([
        timestamp,
        payload.nickname,
        e.item,
        e.cardNo,
        e.qty
      ]);
    });
    
    if (historyRows.length > 0) {
      historySheet.getRange(historySheet.getLastRow() + 1, 1, historyRows.length, 5).setValues(historyRows);
      Logger.log('記錄了 ' + historyRows.length + ' 筆訂單歷史');
    }
    
    // 發送下單通知 email
    try {
      const to = 'ningscard@gmail.com';
      const subject = '【新訂單通知】' + payload.nickname + ' 已下單';
      const orderLines = payload.entries.map(function(e, i) {
        const isBoxFlag = String(e.isBox).toUpperCase() === 'Y' ? '[卡盒]' : '[單卡]';
        return '  - [' + (i + 1) + '] ' + isBoxFlag + ' ' + (e.item || '-') + 
               ' / 卡號: ' + (e.cardNo || '-') + 
               ' / 數量: ' + e.qty + '張' +
               ' / 單價: $' + e.price +
               ' / 小計: $' + (e.qty * e.price);
      }).join('\n');
      
      const totalAmount = payload.entries.reduce(function(sum, e) {
        return sum + (e.qty * e.price);
      }, 0);
      
      const body =
        '訂購人：' + payload.nickname + '\n' +
        '下單時間：' + timestamp.toLocaleString('zh-TW') + '\n' +
        '訂單內容：\n' + orderLines + '\n' +
        '---\n' +
        '訂單總額：$' + totalAmount;
      
      MailApp.sendEmail({ to: to, subject: subject, body: body });
    } catch (emailErr) {
      Logger.log('發送下單通知失敗: ' + emailErr.toString());
    }

    SpreadsheetApp.flush();
    
    // 更新所有相同卡號訂單的價格(如果達到門檻)
    const allData = os.getDataRange().getValues();
    const updates = [];
    
    // 統計每個卡號的總數量
    const cardTotals = new Map();
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      const cardNo = idx.cardNo > -1 ? String(row[idx.cardNo] || '').trim() : '';
      const qty = idx.qty > -1 ? Number(row[idx.qty] || 0) : 0;
      if (cardNo) {
        cardTotals.set(cardNo, (cardTotals.get(cardNo) || 0) + qty);
      }
    }
    
    // 檢查每筆訂單是否需要更新價格
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      const cardNo = idx.cardNo > -1 ? String(row[idx.cardNo] || '').trim() : '';
      const currentPrice = idx.price > -1 ? Number(row[idx.price] || 0) : 0;
      const qty = idx.qty > -1 ? Number(row[idx.qty] || 0) : 0;
      
      if (cardNo && currentPrice > 0) {
        const productInfo = productLookup.get(cardNo);
        const totalQty = cardTotals.get(cardNo) || 0;
        
        if (productInfo && productInfo.threshold > 0 && productInfo.fullPrice > 0) {
          if (totalQty >= productInfo.threshold && currentPrice !== productInfo.fullPrice) {
            // 需要更新價格
            const newTotal = qty * productInfo.fullPrice;
            updates.push({
              row: i + 1,
              price: productInfo.fullPrice,
              total: newTotal,
              balance: newTotal
            });
            Logger.log('更新第' + (i + 1) + '列,卡號 ' + cardNo + ' 總量 ' + totalQty + ' 達門檻,價格 ' + currentPrice + ' → ' + productInfo.fullPrice);
          }
        }
      }
    }
    
    // 批次更新價格
    if (updates.length > 0) {
      updates.forEach(u => {
        if (idx.price > -1) os.getRange(u.row, idx.price + 1).setValue(u.price);
        if (idx.total > -1) os.getRange(u.row, idx.total + 1).setValue(u.total);
        if (idx.balance > -1) os.getRange(u.row, idx.balance + 1).setValue(u.balance);
      });
      Logger.log('共更新了 ' + updates.length + ' 筆訂單價格');
      SpreadsheetApp.flush();
    }

    // 🌟 更新「下單商品」表的庫存 (只針對卡盒商品)
    Logger.log('=== 開始更新庫存 ===');
    Logger.log('productSheet 存在:', !!productSheet);
    
    if (productSheet) {
      const stockUpdates = new Map(); // key: item (品項), value: totalQty
      
      // 統計本次下單各卡盒的總數量 (只處理 isBox = 'Y' 的商品)
      Logger.log('payload.entries 數量:', payload.entries.length);
      payload.entries.forEach(e => {
        const isBoxFlag = String(e.isBox).toUpperCase() === 'Y';
        const itemName = String(e.item || '').trim();
        Logger.log('處理訂單項目: item=' + itemName + ', qty=' + e.qty + ', isBox=' + isBoxFlag);
        
        if (isBoxFlag && itemName) {
          stockUpdates.set(itemName, (stockUpdates.get(itemName) || 0) + Number(e.qty || 0));
        }
      });
      
      Logger.log('需要更新庫存的卡盒品項:', Array.from(stockUpdates.keys()));
      
      if (stockUpdates.size > 0) {
        // 讀取下單商品表的最新資料
        const productData = productSheet.getDataRange().getValues();
        Logger.log('下單商品表資料行數:', productData.length);
        
        if (productData.length > 1) {
          const productHeader = productData[0];
          const stockColIdx = productHeader.indexOf('剩餘數量');
          const itemColIdx = productHeader.indexOf('品項');
          const isBoxColIdx = productHeader.indexOf('卡盒預購');
          
          Logger.log('剩餘數量欄位索引:', stockColIdx);
          Logger.log('品項欄位索引:', itemColIdx);
          Logger.log('卡盒預購欄位索引:', isBoxColIdx);
          
          if (stockColIdx > -1 && itemColIdx > -1) {
            let stockUpdateCount = 0;
            
            // 更新每個卡盒的庫存
            for (let i = 1; i < productData.length; i++) {
              const row = productData[i];
              const itemName = String(row[itemColIdx] || '').trim();
              const isBoxValue = isBoxColIdx > -1 ? String(row[isBoxColIdx] || '').trim().toUpperCase() : '';
              const isBoxItem = isBoxValue === 'Y' || isBoxValue === 'YES';
              
              // 只更新卡盒商品的庫存
              if (isBoxItem && stockUpdates.has(itemName)) {
                const orderQty = stockUpdates.get(itemName);
                const currentStock = Number(row[stockColIdx] || 0);
                const newStock = Math.max(0, currentStock - orderQty); // 庫存不能為負
                
                Logger.log('找到匹配卡盒: ' + itemName + ' 行號: ' + (i + 1));
                
                // 更新庫存
                productSheet.getRange(i + 1, stockColIdx + 1).setValue(newStock);
                stockUpdateCount++;
                
                Logger.log('更新庫存: 品項 ' + itemName + ' 下單 ' + orderQty + ' 盒, 庫存 ' + currentStock + ' → ' + newStock);
              }
            }
            
            if (stockUpdateCount > 0) {
              Logger.log('共更新了 ' + stockUpdateCount + ' 個卡盒的庫存');
              SpreadsheetApp.flush();
            } else {
              Logger.log('警告: 沒有找到任何匹配的卡盒需要更新庫存');
            }
          } else {
            Logger.log('錯誤: 找不到必要的欄位 - stockColIdx=' + stockColIdx + ', itemColIdx=' + itemColIdx);
          }
        } else {
          Logger.log('錯誤: 下單商品表沒有資料');
        }
      } else {
        Logger.log('本次下單沒有卡盒商品,跳過庫存更新');
      }
    } else {
      Logger.log('錯誤: 找不到下單商品表');
    }

    return { success: true, count: rows.length };
  } catch (e) {
    return { success: false, message: '下單錯誤: ' + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function registerUser(payload) {
  const ss = SpreadsheetManager.openSpreadsheet();
  const sheet = ss.getSheetByName('客戶資料');
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);
    const data = sheet.getDataRange().getValues();
    const idxPhone = data[0].indexOf('電話');

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idxPhone]).replace(/\D/g, '') === String(payload.phone).replace(/\D/g, '')) {
        return { success: false, message: '電話已註冊' };
      }
    }

    const headers = data[0];
    const newRow = headers.map(h => {
      const headerLower = String(h).toLowerCase();
      if (h === '群組暱稱') return payload.nickname;
      if (h === '姓名') return payload.name;
      if (h === '電話') return "'" + payload.phone;
      if (h === '生日') return "'" + payload.birthday;
      if (h === 'LineID') return payload.lineId || '';
      if (h === '7-11店到店門市') return payload.address || '';
      if (h === '收件用門市') return payload.address || ''; // 同時寫入收件用門市
      if (h === '711店號') return payload.storeNumber || '';
      if (headerLower === 'email') return payload.email || '';
      if (h === '時間戳記') return new Date();
      return '';
    });
    
    Logger.log('registerUser - 註冊email: ' + payload.email);

    sheet.appendRow(newRow);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/* =================================================================
   🌟 PSA 鑑定功能模組
   注意：需搭配 Google Sheet 頁籤「主訂單」與「卡片明細」使用
   ================================================================= */

/**
 * 根據卡片張數和寄送方式計算單價和總金額。
 */
function calculatePricing(totalCards, shippingMethod) {
  const cards = parseInt(totalCards);
  let pricePerCard = 0;

  if (isNaN(cards) || cards <= 0) {
    throw new Error("卡片張數無效，無法計算價格。");
  }

  if (shippingMethod === '團拆直送') {
    pricePerCard = 880;
  } else {
    if (cards >= 10) {
      pricePerCard = 880;
    } else if (cards >= 5) {
      pricePerCard = 920;
    } else if (cards >= 1) {
      pricePerCard = 950;
    } else {
      pricePerCard = 0;
    }
  }

  const totalAmount = cards * pricePerCard;
  return { unitPrice: pricePerCard, totalAmount: totalAmount };
}

/**
 * 生成基於日期的連續訂單 ID (YYYYMMDDXXX)。
 */
function generateSequentialOrderId(mainSheet) {
  const today = new Date();
  const ss = SpreadsheetManager.openSpreadsheet();
  const ssTimeZone = ss.getSpreadsheetTimeZone();
  const datePrefix = Utilities.formatDate(today, ssTimeZone, 'yyyyMMdd');
  
  const headers = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0];
  const orderIdColumnIndex = headers.indexOf('訂單 ID');
  
  if (orderIdColumnIndex === -1) {
    console.error("警告: '主訂單' 工作表標題列缺少 '訂單 ID'，將使用 UUID 代替。");
    return datePrefix + 'ERR-' + Utilities.getUuid().substring(0, 4);
  }
  
  const lastRow = mainSheet.getLastRow();
  const orderIds = lastRow > 1 
    ? mainSheet.getRange(2, orderIdColumnIndex + 1, lastRow - 1, 1).getValues().flat()
    : [];

  let maxSequence = 0;
  
  orderIds.forEach(id => {
    const idStr = String(id);
    if (idStr.startsWith(datePrefix)) {
      const sequenceStr = idStr.substring(datePrefix.length);
      const sequence = parseInt(sequenceStr, 10);
      if (!isNaN(sequence)) {
        maxSequence = Math.max(maxSequence, sequence);
      }
    }
  });

  const nextSequence = maxSequence + 1;
  const sequenceSuffix = String(nextSequence).padStart(3, '0');

  return datePrefix + sequenceSuffix;
}

function processOrderSubmission(formData) {
  const ss = SpreadsheetManager.openSpreadsheet();
  const mainSheet = ss.getSheetByName('主訂單');
  const detailSheet = ss.getSheetByName('卡片明細');
  
  if (!mainSheet) {
    return { success: false, message: "找不到名為 '主訂單' 的工作表，請聯繫管理員。" };
  }
  if (!detailSheet) {
    return { success: false, message: "找不到名為 '卡片明細' 的工作表，請聯繫管理員。" };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    const timestamp = new Date();
    const orderId = generateSequentialOrderId(mainSheet);
    const totalCards = parseInt(formData.totalCards);
    const shippingMethod = formData.shippingMethod;

    const pricing = calculatePricing(totalCards, shippingMethod);
    const unitPrice = pricing.unitPrice;
    const totalAmount = pricing.totalAmount;

    const initialStatus = "已提交 (待收卡)";
    const statusModifiedTime = timestamp;

    const customerPhoneFormatted = "'" + formData.customerPhone;

    const mainOrderRow = [
      timestamp,
      orderId,
      formData.customerRealName,
      formData.customerNickname || '',
      formData.customerEmail,
      customerPhoneFormatted,
      shippingMethod,
      totalCards,
      unitPrice,
      totalAmount,
      initialStatus,
      statusModifiedTime
    ];
    mainSheet.appendRow(mainOrderRow);
    
    for (let i = 1; i <= totalCards; i++) {
      const cardDetailRow = [
        timestamp,
        orderId,
        i,
        formData[`card_${i}_year`],
        formData[`card_${i}_player`],
        formData[`card_${i}_brand`] || '',
        formData[`card_${i}_cardno`] || '',
        formData[`card_${i}_signature`] === 'on' ? '是' : '否',
        formData[`card_${i}_relic`] === 'on' ? '是' : '否',
        formData[`card_${i}_gradingType`],
        formData[`card_${i}_limited`],
        formData[`card_${i}_limited_num`] || 'N/A',
        initialStatus
      ];
      detailSheet.appendRow(cardDetailRow);
    }
    
    SpreadsheetApp.flush();
    return { success: true, orderId: orderId };

  } catch (e) {
    Logger.log('Error processing order: ' + e.toString());
    return { success: false, message: e.message || "發生未預期錯誤，請聯繫客服。" };
  } finally {
    lock.releaseLock();
  }
}

function lookupOrderStatus(query) {
  const ss = SpreadsheetManager.openSpreadsheet();
  const mainSheet = ss.getSheetByName('主訂單');
  const detailSheet = ss.getSheetByName('卡片明細');

  if (!mainSheet || !detailSheet) return { success: true, data: [] };
  
  const mainValues = mainSheet.getDataRange().getValues();
  if (mainValues.length < 2) return { success: true, data: [] };
  const mainHeaders = mainValues.shift();
  
  const mainIndices = {
    timestamp: mainHeaders.indexOf('時間戳記'),
    orderId: mainHeaders.indexOf('訂單 ID'),
    customerRealName: mainHeaders.indexOf('姓名'),
    customerNickname: mainHeaders.indexOf('暱稱'),
    customerEmail: mainHeaders.indexOf('Email'),
    customerPhone: mainHeaders.indexOf('手機號碼'),
    shippingMethod: mainHeaders.indexOf('寄送方式'),
    totalAmount: mainHeaders.indexOf('總金額'),
    mainStatus: mainHeaders.indexOf('主要狀態')
  };

  if (mainIndices.orderId === -1) return { success: true, data: [] };

  const normalizedQuery = String(query).trim().toLowerCase();
  
  const mainOrderRows = mainValues.filter(row => {
    const orderId = String(row[mainIndices.orderId]||'').trim().toLowerCase();
    const email = String(row[mainIndices.customerEmail]||'').trim().toLowerCase();
    const rawPhone = String(row[mainIndices.customerPhone]||'');
    const cleanPhone = rawPhone.startsWith("'") ? rawPhone.substring(1) : rawPhone;

    return orderId === normalizedQuery 
      || email === normalizedQuery 
      || cleanPhone === normalizedQuery;
  });

  if (mainOrderRows.length === 0) return { success: true, data: [] };
  
  const detailValues = detailSheet.getDataRange().getValues();
  const detailHeaders = detailValues.shift();

  const detailIndices = {
    orderId: detailHeaders.indexOf('訂單 ID'),
    cardNum: detailHeaders.indexOf('卡片編號'),
    year: detailHeaders.indexOf('年份'),
    player: detailHeaders.indexOf('球員'),
    brand: detailHeaders.indexOf('品牌'),
    cardno: detailHeaders.indexOf('卡號'),
    signature: detailHeaders.indexOf('簽名'),
    relic: detailHeaders.indexOf('用品卡'),
    gradingType: detailHeaders.indexOf('鑑定類型'),
    limited: detailHeaders.indexOf('限量'),
    limitedNum: detailHeaders.indexOf('限量編號'),
    status: detailHeaders.indexOf('主要狀態'),
    imgFront: detailHeaders.indexOf('正面圖片'),
    imgBack: detailHeaders.indexOf('反面圖片')
  };

  const results = [];
  const ssTimeZone = ss.getSpreadsheetTimeZone();

  mainOrderRows.forEach(mainRow => {
    const orderIdToSearch = String(mainRow[mainIndices.orderId]);
    const cardDetails = [];
    
    const detailRows = detailValues.filter(detailRow => 
      String(detailRow[detailIndices.orderId]) === orderIdToSearch
    );
    
    detailRows.sort((a, b) => (a[detailIndices.cardNum] || 0) - (b[detailIndices.cardNum] || 0));

    detailRows.forEach(row => {
      const fImg = detailIndices.imgFront > -1 ? row[detailIndices.imgFront] : '';
      const bImg = detailIndices.imgBack > -1 ? row[detailIndices.imgBack] : '';

      cardDetails.push({
        cardNum: row[detailIndices.cardNum],
        year: row[detailIndices.year],
        player: row[detailIndices.player],
        brand: detailIndices.brand > -1 ? row[detailIndices.brand] : '',
        cardno: detailIndices.cardno > -1 ? row[detailIndices.cardno] : '',
        signature: row[detailIndices.signature],
        relic: row[detailIndices.relic],
        gradingType: detailIndices.gradingType > -1 ? row[detailIndices.gradingType] : '',
        limited: row[detailIndices.limited],
        limitedNum: row[detailIndices.limitedNum] || 'N/A',
        status: row[detailIndices.status] || mainRow[mainIndices.mainStatus],
        imgFront: fImg,
        imgBack: bImg
      });
    });

    results.push({
      submitTime: mainRow[mainIndices.timestamp] ? Utilities.formatDate(mainRow[mainIndices.timestamp], ssTimeZone, "yyyy-MM-dd HH:mm") : 'N/A',
      orderId: orderIdToSearch,
      customerRealName: mainRow[mainIndices.customerRealName],
      customerNickname: mainRow[mainIndices.customerNickname] || '',
      shippingMethod: mainRow[mainIndices.shippingMethod],
      totalAmount: mainRow[mainIndices.totalAmount],
      status: mainRow[mainIndices.mainStatus] || 'N/A',
      cards: cardDetails
    });
  });

  return { success: true, data: results };
}

function notifyProfileUpdate(payload) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const cs = ss.getSheetByName('客戶資料');
    
    if (!cs) {
      return { success: false, message: '找不到「客戶資料」工作表' };
    }
    
    const cData = cs.getDataRange().getValues();
    const cHead = cData[0].map(h => String(h).trim());
    
    const phoneIdx = cHead.indexOf('電話');
    const addrIdx = cHead.indexOf('7-11店到店門市');
    const shipStoreIdx = cHead.indexOf('收件用門市');
    const storeNumIdx = cHead.indexOf('711店號');
    const emailIdx = cHead.findIndex(h => h.toLowerCase() === 'email');
    
    Logger.log('notifyProfileUpdate - email欄位索引: ' + emailIdx + ', 傳入的email: ' + payload.email);
    
    if (phoneIdx === -1) {
      return { success: false, message: '找不到電話欄位' };
    }
    
    // 尋找該用戶的資料列
    const targetPhone = String(payload.phone).replace(/\D/g, '');
    let rowIndex = -1;
    
    for (let i = 1; i < cData.length; i++) {
      const p = String(cData[i][phoneIdx] || '').replace(/\D/g, '');
      if (p === targetPhone) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return { success: false, message: '找不到用戶資料' };
    }
    
    // 更新收件用門市
    if (shipStoreIdx > -1 && payload.shipStore) {
      cs.getRange(rowIndex, shipStoreIdx + 1).setValue(payload.shipStore);
    }
    
    // 更新711店號
    if (storeNumIdx > -1 && payload.storeNumber) {
      cs.getRange(rowIndex, storeNumIdx + 1).setValue(payload.storeNumber);
    }
    
    // 更新備註地址
    if (addrIdx > -1 && payload.address) {
      cs.getRange(rowIndex, addrIdx + 1).setValue(payload.address);
    }
    
    // 更新Email（允許清空）
    if (emailIdx > -1) {
      const emailValue = payload.email || '';
      cs.getRange(rowIndex, emailIdx + 1).setValue(emailValue);
      Logger.log('notifyProfileUpdate - 已更新email: ' + emailValue);
    }
    
    // 發送郵件通知
    const to = 'ningscard@gmail.com';
    const subject = '【會員配送資訊更新】' + payload.nickname;
    let body = '暱稱：' + payload.nickname + '\n' +
               '姓名：' + payload.name + '\n' +
               '電話：' + payload.phone + '\n\n' +
               '收件用門市：' + (payload.shipStore || '-') + '\n' +
               '711店號：' + (payload.storeNumber || '-') + '\n' +
               'Email：' + (payload.email || '-') + '\n' +
               '備註：' + (payload.address || '-');
    
    MailApp.sendEmail({ to: to, subject: subject, body: body });
    
    return { success: true, message: '資料已更新' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function submitPaymentNotification(payload) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('付款通知暫存');
    
    if (!sheet) {
      return { success: false, message: '找不到「付款通知暫存」工作表' };
    }
    
    // 取得當前時間戳記
    const timestamp = new Date();
    const paymentType = payload.type || 'order'; // 'order' 或 'break'
    
    // 🌟 拆分多筆項目 (用 || 分隔)
    const items = String(payload.item || '').split('||').map(s => s.trim()).filter(s => s);
    
    console.log('submitPaymentNotification: type=', paymentType, 'items=', items);
    
    // 每筆項目寫入一行
    const lastRow = sheet.getLastRow();
    let rowsAdded = 0;
    
    if (paymentType === 'break') {
      // 團拆付款通知
      const breakIds = String(payload.breakId || '').split('||').map(s => s.trim()).filter(s => s);
      
      for (let i = 0; i < items.length; i++) {
        const newRow = [
          timestamp,
          payload.nickname || '',
          "'" + (payload.phone || ''),
          payload.key || '',
          items[i], // 團名
          breakIds[i] || '', // 團拆編號存在 CardNo 欄位
          payload.quantity || 0,
          payload.total || 0,
          payload.amount || 0,
          payload.remark || '',
          'break' // Status 欄位標記為 'break'
        ];
        
        const newRowNumber = lastRow + 1 + rowsAdded;
        sheet.getRange(newRowNumber, 3, 1, 1).setNumberFormat('@');
        sheet.appendRow(newRow);
        rowsAdded++;
        
        console.log('已寫入團拆:', items[i], '編號:', breakIds[i]);
      }
      
    } else {
      // 訂單付款通知
      const cardNos = String(payload.cardNo || '').split('||').map(s => s.trim()).filter(s => s);
      
      for (let i = 0; i < items.length; i++) {
        const fullItem = items[i];
        const itemParts = fullItem.split(' #');
        const itemName = itemParts[0].trim();
        const cardNoFromItem = itemParts[1] || cardNos[i] || '';
        
        const newRow = [
          timestamp,
          payload.nickname || '',
          "'" + (payload.phone || ''),
          payload.key || '',
          itemName,
          cardNoFromItem,
          payload.quantity || 0,
          payload.total || 0,
          payload.amount || 0,
          payload.remark || '',
          payload.status || 'pending'
        ];
        
        const newRowNumber = lastRow + 1 + rowsAdded;
        sheet.getRange(newRowNumber, 3, 1, 1).setNumberFormat('@');
        sheet.appendRow(newRow);
        rowsAdded++;
        
        console.log('已寫入訂單:', itemName, '#', cardNoFromItem);
      }
    }
    
    // 📧 發送付款通知 email
    try {
      const to = 'ningscard@gmail.com';
      
      if (paymentType === 'break') {
        // 團拆付款通知
        const breakIds = String(payload.breakId || '').split('||').map(s => s.trim()).filter(s => s);
        const subject = '【團拆付款通知】' + payload.nickname + ' 已通知付款';
        const itemLines = items.map(function(item, idx) {
          return '  - [' + (idx + 1) + '] 團拆: ' + item + ' / 編號: ' + (breakIds[idx] || '-');
        }).join('\n');
        
        const body =
          '客戶暱稱：' + payload.nickname + '\n' +
          '手機：' + payload.phone + '\n' +
          '通知時間：' + timestamp.toLocaleString('zh-TW') + '\n' +
          '團拆項目：\n' + itemLines + '\n' +
          '---\n' +
          '付款方式：' + payload.key + '\n' +
          '付款金額：NT$ ' + payload.amount + '\n' +
          '備註：' + (payload.remark || '無');
        
        MailApp.sendEmail({ to: to, subject: subject, body: body });
        
      } else {
        // 訂單付款通知
        const subject = '【訂單付款通知】' + payload.nickname + ' 已通知付款';
        const itemLines = items.map(function(item, idx) {
          return '  - [' + (idx + 1) + '] ' + item;
        }).join('\n');
        
        const body =
          '客戶暱稱：' + payload.nickname + '\n' +
          '手機：' + payload.phone + '\n' +
          '通知時間：' + timestamp.toLocaleString('zh-TW') + '\n' +
          '訂單項目：\n' + itemLines + '\n' +
          '---\n' +
          '付款方式：' + payload.key + '\n' +
          '付款金額：NT$ ' + payload.amount + '\n' +
          '備註：' + (payload.remark || '無');
        
        MailApp.sendEmail({ to: to, subject: subject, body: body });
      }
      
      console.log('已發送付款通知email');
    } catch (emailErr) {
      console.log('發送email失敗:', emailErr.toString());
      // 不中斷流程,即使email失敗也要回傳成功
    }
    
    return { success: true, message: '付款通知已記錄 (' + rowsAdded + ' 筆)' };
  } catch (err) {
    return { success: false, message: '系統錯誤: ' + err.toString() };
  }
}

/* ================================================================
🌟 管理員功能：生成待出貨報表 (改良版 - 每項商品獨立勾選)
================================================================ */
function generateShippingReport() {
  var ss = SpreadsheetManager.openSpreadsheet();
  
  var orderSheet = ss.getSheetByName('Topps_Now_訂購總表');
  var groupSheet = ss.getSheetByName('團拆紀錄');
  var customerSheet = ss.getSheetByName('客戶資料');
  
  if (!orderSheet || !groupSheet || !customerSheet) {
    try {
      SpreadsheetApp.getUi().alert("❌ 找不到必要的資料表 (Topps_Now_訂購總表, 團拆紀錄, 客戶資料)");
    } catch(e) {
      console.log("找不到必要的資料表");
    }
    return;
  }

  // 取得欄位索引
  var oData = orderSheet.getDataRange().getValues();
  var oHead = oData[0];
  var oIdx = {
    buyer: oHead.indexOf('訂購人'),
    item:  oHead.indexOf('品項'),
    qty:   oHead.indexOf('張數'),
    isBox: oHead.indexOf('卡盒訂單'),
    arr:   oHead.indexOf('到貨狀態'),
    ship:  oHead.indexOf('寄出'),
    card:  oHead.indexOf('卡號'),
    balance: oHead.indexOf('尾款')
  };

  var gData = groupSheet.getDataRange().getValues();
  var gHead = gData[0];
  var gIdx = {
    buyer: gHead.indexOf('訂購人'),
    id:    gHead.indexOf('團拆編號'),
    name:  gHead.indexOf('團名'),
    item:  gHead.indexOf('購買品項'),
    open:  gHead.indexOf('是否已拆'),
    ship:  gHead.indexOf('卡片是否寄出'),
    total: gHead.indexOf('總團費'),
    paid:  gHead.indexOf('已付金額')
  };

  var cData = customerSheet.getDataRange().getValues();
  var cHead = cData[0];
  var cIdx = { 
    nick: cHead.indexOf('群組暱稱'), 
    name: cHead.indexOf('姓名'), 
    phone: cHead.indexOf('電話'), 
    addr: cHead.indexOf('7-11店到店門市'),
    shipStore: cHead.indexOf('收件用門市'),
    storeNum: cHead.indexOf('711店號')
  };

  // 初始化使用者資料
  var users = {};
  for (var i = 1; i < cData.length; i++) {
    var r = cData[i];
    var nick = String(r[cIdx.nick] || '').trim();
    if (nick) {
      users[nick] = {
        info: { 
          name: r[cIdx.name], 
          phone: r[cIdx.phone], 
          addr: r[cIdx.addr],
          shipStore: (cIdx.shipStore > -1) ? r[cIdx.shipStore] : '',
          storeNumber: (cIdx.storeNum > -1) ? r[cIdx.storeNum] : ''
        },
        items: [], // 改用陣列存放每個可出貨項目
        pendingCount: 0
      };
    }
  }

  var getUser = function(nick) {
    if (!nick) return null;
    if (!users[nick]) {
      users[nick] = { 
        info: { name: '-', phone: '-', addr: '-', shipStore: '-', storeNumber: '-' }, 
        items: [], 
        pendingCount: 0
      };
    }
    return users[nick];
  };

  // 掃描訂單
  for (var i = 1; i < oData.length; i++) {
    var r = oData[i];
    var shipped = String(r[oIdx.ship] || '').trim().toUpperCase();
    
    if (shipped === 'Y' || shipped === '是') continue;

    var buyer = String(r[oIdx.buyer] || '').trim();
    var user = getUser(buyer);
    if (!user) continue;

    var isBox = String(r[oIdx.isBox] || '').toUpperCase() === 'Y';
    var arrival = String(r[oIdx.arr] || '').trim().toUpperCase();
    
    if (arrival === 'V') {
      var cardNo = r[oIdx.card] ? '(Card:' + r[oIdx.card] + ')' : '';
      var qty = Number(r[oIdx.qty] || 0);
      var balance = Number(r[oIdx.balance] || 0);
      var isUnpaid = balance > 0;
      var debtStr = isUnpaid ? ' [未付:$' + balance + ']' : '';
      var itemType = isBox ? '[卡盒]' : '[單卡]';
      var itemStr = itemType + ' ' + r[oIdx.item] + ' ' + cardNo + ' x' + qty + debtStr;
      
      user.items.push({
        text: itemStr,
        qty: qty,
        isBox: isBox,
        unpaid: isUnpaid,
        sourceType: 'order',
        orderSheet: 'Topps_Now_訂購總表',
        orderRow: i + 1,
        shipCol: oIdx.ship + 1
      });
    } else {
      user.pendingCount++;
    }
  }

  // 掃描團拆
  for (var i = 1; i < gData.length; i++) {
    var r = gData[i];
    var shipped = String(r[gIdx.ship] || '').trim().toUpperCase();
    if (shipped === 'Y' || shipped === '是') continue;

    var buyer = String(r[gIdx.buyer] || '').trim();
    var user = getUser(buyer);
    if (!user) continue;

    var opened = String(r[gIdx.open] || '').trim().toUpperCase();
    
    if (opened === 'Y' || opened === '是') {
      var totalFee = Number(r[gIdx.total] || 0);
      var paidAmt = Number(r[gIdx.paid] || 0);
      var debt = totalFee - paidAmt;
      var isUnpaid = debt > 0;
      var debtStr = isUnpaid ? ' [未付:$' + debt + ']' : '';
      var itemStr = '[團拆] ' + r[gIdx.id] + ' ' + r[gIdx.name] + ' - ' + r[gIdx.item] + debtStr;
      
      user.items.push({
        text: itemStr,
        unpaid: isUnpaid,
        sourceType: 'group',
        groupSheet: '團拆紀錄',
        groupRow: i + 1,
        groupShipCol: gIdx.ship + 1
      });
    } else {
      user.pendingCount++;
    }
  }

  // 產生報表資料 (每個項目一列，同一買家合併)
  var outputRows = [];
  var mergeRanges = []; // 記錄需要合併的儲存格範圍

  var currentRow = 2; // 從第2列開始 (第1列是標題)

  for (var nick in users) {
    var data = users[nick];
    
    if (data.items.length === 0) continue;

    // 計算單卡總張數
    var singleQty = 0;
    var boxCount = 0;
    var breakCount = 0;
    
    for (var j = 0; j < data.items.length; j++) {
      var item = data.items[j];
      if (item.sourceType === 'order' && !item.isBox) {
        singleQty += item.qty || 0;
      } else if (item.sourceType === 'order' && item.isBox) {
        boxCount++;
      } else if (item.sourceType === 'group') {
        breakCount++;
      }
    }

    // 判斷符合的出貨原因
    var reasons = [];
    if (singleQty > 10) reasons.push('單卡累積超過10張(' + singleQty + '張)');
    if (boxCount > 0) reasons.push('卡盒到貨(' + boxCount + '盒)');
    if (breakCount > 0) reasons.push('團拆已拆(' + breakCount + '團)');
    if (data.pendingCount === 0) reasons.push('購買商品已全部到齊');

    // 只要符合任一條件，就列入報表
    if (reasons.length === 0) continue;

    var reasonText = reasons.join('、');
    
    // 使用收件用門市和711店號 (優先使用專門的收件欄位)
    var storeName = String(data.info.shipStore || data.info.addr || '');
    var storeNumber = String(data.info.storeNumber || '');

    var startRow = currentRow;

    // 每個項目一列
    for (var j = 0; j < data.items.length; j++) {
      var item = data.items[j];
      var metadata = JSON.stringify({
        orderSheet: item.orderSheet,
        orderRow: item.orderRow,
        shipCol: item.shipCol,
        groupSheet: item.groupSheet,
        groupRow: item.groupRow,
        groupShipCol: item.groupShipCol
      });

      outputRows.push([
        false, // Checkbox
        nick,
        data.info.name,
        "'" + data.info.phone, // 加上單引號前綴確保文字格式且保留開頭0
        data.info.addr,
        reasonText,
        item.text, // 單一商品項目
        item.unpaid ? '❌ 未付清' : '✅ 已付清',
        metadata,
        // 7-11 寄件格式欄位
        storeName,          // 收件門市
        "'" + storeNumber,  // 收件門市店號 (加上單引號)
        data.info.name,     // 收件人姓名 (請填寫證件姓名)
        "'" + data.info.phone, // 收件人電話 (加上單引號)
        ''                  // 收件人地址 (7-11通常不需要)
      ]);
      currentRow++;
    }

    // 不要合併儲存格,每一行都保留完整資料,方便程式讀取
    // 如果該買家有多個項目,只合併商品以外的顯示欄位(視覺上區分,但資料完整)
    /* 移除合併邏輯
    if (data.items.length > 1) {
      var endRow = currentRow - 1;
      // 合併: 暱稱(B), 姓名(C), 電話(D), 門市(E), 出貨原因(F), 7-11欄位(J-N)
      mergeRanges.push({
        startRow: startRow,
        endRow: endRow,
        columns: [2, 3, 4, 5, 6, 10, 11, 12, 13, 14] // B, C, D, E, F, J, K, L, M, N
      });
    }
    */
  }

  // 寫入 Sheet
  var targetSheet = ss.getSheetByName('待出貨清單');
  if (!targetSheet) {
    targetSheet = ss.insertSheet('待出貨清單');
  } else {
    targetSheet.clear();
  }

  var headers = [['確認出貨', '群組暱稱', '姓名', '電話', '7-11門市', '符合出貨原因', '商品項目', '付款狀態', 'Metadata', '收件門市', '收件門市店號', '收件人姓名\n(請填寫證件姓名)', '收件人電話', '收件人地址']];
  targetSheet.getRange(1, 1, 1, headers[0].length).setValues(headers)
    .setBackground('#0b3a5e').setFontColor('#ffffff').setFontWeight('bold');

  if (outputRows.length > 0) {
    // 先設定電話欄位為文字格式 (避免開頭的 0 消失)
    targetSheet.getRange(2, 4, outputRows.length, 1).setNumberFormat('@'); // 電話欄
    targetSheet.getRange(2, 11, outputRows.length, 1).setNumberFormat('@'); // 收件門市店號
    targetSheet.getRange(2, 13, outputRows.length, 1).setNumberFormat('@'); // 收件人電話欄
    
    // 再寫入資料
    targetSheet.getRange(2, 1, outputRows.length, headers[0].length).setValues(outputRows);
    targetSheet.getRange(2, 1, outputRows.length, 1).insertCheckboxes();
    
    // 不再執行儲存格合併,保留每一行的完整資料
    /* 移除合併邏輯
    for (var i = 0; i < mergeRanges.length; i++) {
      var range = mergeRanges[i];
      for (var j = 0; j < range.columns.length; j++) {
        var col = range.columns[j];
        try {
          targetSheet.getRange(range.startRow, col, range.endRow - range.startRow + 1, 1).mergeVertically();
        } catch(e) {
          // 如果合併失敗就跳過
        }
      }
    }
    */
    
    // 設定欄寬
    targetSheet.setColumnWidth(1, 50);   // 確認出貨
    targetSheet.setColumnWidth(2, 120);  // 群組暱稱
    targetSheet.setColumnWidth(3, 100);  // 姓名
    targetSheet.setColumnWidth(4, 110);  // 電話
    targetSheet.setColumnWidth(5, 180);  // 7-11門市
    targetSheet.setColumnWidth(6, 250);  // 符合出貨原因
    targetSheet.setColumnWidth(7, 350);  // 商品項目
    targetSheet.setColumnWidth(8, 100);  // 付款狀態
    targetSheet.setColumnWidth(10, 180); // 收件門市
    targetSheet.setColumnWidth(11, 100); // 收件門市店號
    targetSheet.setColumnWidth(12, 120); // 收件人姓名
    targetSheet.setColumnWidth(13, 110); // 收件人電話
    targetSheet.setColumnWidth(14, 200); // 收件人地址
    targetSheet.hideColumns(9); // 隱藏 Metadata
    
    // 設定格式
    targetSheet.getDataRange().setVerticalAlignment('middle');
    targetSheet.getDataRange().setHorizontalAlignment('left');
    targetSheet.getRange(2, 7, outputRows.length, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
    
    // 付款狀態欄位上色
    for (var i = 0; i < outputRows.length; i++) {
      var paymentStatus = outputRows[i][7];
      var cell = targetSheet.getRange(i + 2, 8);
      if (paymentStatus.indexOf('未付清') > -1) {
        cell.setBackground('#ffe6e6').setFontColor('#cc0000').setFontWeight('bold');
      } else {
        cell.setBackground('#e6ffe6').setFontColor('#006600');
      }
    }
    
    // 7-11 寄件欄位底色 (淺藍色區分)
    targetSheet.getRange(1, 10, outputRows.length + 1, 5).setBackground('#e3f2fd');
    targetSheet.getRange(1, 10, 1, 5).setBackground('#0b3a5e'); // 標題維持深藍色
    
    try { 
      SpreadsheetApp.getUi().alert('✅ 報表生成完畢！共 ' + outputRows.length + ' 個項目可供出貨選擇。\n\n💡 提示：\n- 同一買家的資料已合併儲存格\n- 電話號碼已設為文字格式\n- 最右側為 7-11 寄件格式欄位'); 
    } catch(e) {
      console.log('報表生成完畢');
    }
  } else {
    targetSheet.getRange(2, 1).setValue("目前沒有符合出貨條件的商品");
    try { 
      SpreadsheetApp.getUi().alert("⚠️ 目前沒有商品符合出貨條件。"); 
    } catch(e) {
      console.log('沒有符合出貨條件的商品');
    }
  }
}

/* ================================================================
🌟 出貨紀錄系統
================================================================ */

/**
 * 從待出貨清單處理出貨 (由選單觸發)
 */
function processShipmentFromSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('待出貨清單');
    
    if (!sheet) {
      SpreadsheetApp.getUi().alert('找不到「待出貨清單」工作表！請先生成待出貨報表。');
      return;
    }
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      SpreadsheetApp.getUi().alert('待出貨清單是空的！');
      return;
    }
    
    // 收集已勾選的項目
    var selectedItems = [];
    for (var i = 1; i < data.length; i++) {
      var isChecked = data[i][0]; // 第一欄是勾選框
      if (isChecked === true) {
        var item = {
          nickname: data[i][1],
          name: data[i][2],
          phone: data[i][3],
          shipStore: data[i][9],  // 收件門市 (第10欄)
          storeNumber: data[i][10], // 711店號 (第11欄)
          itemText: data[i][6],    // 商品項目
          metadata: data[i][8]     // Metadata
        };
        console.log('第' + i + '行:', JSON.stringify(item));
        selectedItems.push(item);
      }
    }
    
    console.log('收集到的項目數:', selectedItems.length);
    
    if (selectedItems.length === 0) {
      SpreadsheetApp.getUi().alert('請先勾選要出貨的項目！');
      return;
    }
    
    // 建立出貨紀錄
    var result = createShipmentRecord({ items: selectedItems });
    
    if (result.success) {
      // 發送出貨郵件通知
      sendShipmentEmails(selectedItems);
      
      // 刪除已勾選的項目 (從後往前刪除,避免索引錯亂)
      for (var i = data.length - 1; i >= 1; i--) {
        if (data[i][0] === true) {
          sheet.deleteRow(i + 1);
        }
      }
      
      SpreadsheetApp.getUi().alert(
        '✅ 出貨成功！\n\n' +
        '出貨編號: ' + (result.shipmentNumbers ? result.shipmentNumbers.join(', ') : '-') + '\n' +
        '客戶數: ' + result.count + ' 位\n\n' +
        '已建立出貨紀錄，並更新來源訂單為「已寄出」。\n' +
        '已勾選的項目已從待出貨清單中移除。'
      );
    } else {
      SpreadsheetApp.getUi().alert('❌ 出貨失敗: ' + result.message);
    }
    
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ 系統錯誤: ' + e.toString());
  }
}

/**
 * 建立出貨紀錄
 * @param {Object} payload - { items: [{nickname, name, phone, shipStore, storeNumber, itemText, metadata}] }
 */
function createShipmentRecord(payload) {
  try {
    var ss = SpreadsheetManager.openSpreadsheet();
    var shipmentSheet = ss.getSheetByName('出貨紀錄');
    
    // 如果工作表不存在,建立新的
    if (!shipmentSheet) {
      shipmentSheet = ss.insertSheet('出貨紀錄');
      var headers = [
        '出貨編號', '出貨日期', '群組暱稱', '姓名', '電話', 
        '收件門市', '711店號', '商品明細', '物流單號', '備註'
      ];
      shipmentSheet.getRange(1, 1, 1, headers.length).setValues([headers])
        .setBackground('#0b3a5e').setFontColor('#ffffff').setFontWeight('bold');
      
      // 設定欄寬
      shipmentSheet.setColumnWidth(1, 120);  // 出貨編號
      shipmentSheet.setColumnWidth(2, 110);  // 出貨日期
      shipmentSheet.setColumnWidth(3, 120);  // 群組暱稱
      shipmentSheet.setColumnWidth(4, 100);  // 姓名
      shipmentSheet.setColumnWidth(5, 110);  // 電話
      shipmentSheet.setColumnWidth(6, 180);  // 收件門市
      shipmentSheet.setColumnWidth(7, 100);  // 711店號
      shipmentSheet.setColumnWidth(8, 400);  // 商品明細
      shipmentSheet.setColumnWidth(9, 150);  // 物流單號
      shipmentSheet.setColumnWidth(10, 200); // 備註
    }
    
    if (!payload.items || payload.items.length === 0) {
      return { success: false, message: '沒有選擇要出貨的項目' };
    }
    
    var now = new Date();
    var dateStr = Utilities.formatDate(now, 'GMT+8', 'yyyyMMdd');
    
    console.log('開始分組,總項目數:', payload.items.length);
    
    // 按客戶分組 (使用電話號碼作為唯一識別)
    var customerGroups = {};
    for (var i = 0; i < payload.items.length; i++) {
      var item = payload.items[i];
      
      console.log('處理項目 ' + i + ':', 'nickname=' + item.nickname + ', phone=' + item.phone + ', itemText=' + item.itemText);
      
      // 使用電話號碼作為 key (移除所有非數字字元)
      var phoneKey = String(item.phone || '').replace(/\D/g, '');
      
      console.log('電話 key:', phoneKey);
      
      if (!phoneKey) {
        // 如果沒有電話號碼,使用 nickname 作為 fallback
        phoneKey = 'NOPHONE_' + (item.nickname || 'UNKNOWN_' + i);
        console.log('沒有電話,使用 fallback key:', phoneKey);
      }
      
      if (!customerGroups[phoneKey]) {
        console.log('建立新客戶群組:', phoneKey);
        customerGroups[phoneKey] = {
          nickname: item.nickname || '',
          name: item.name || '',
          phone: item.phone || '',
          shipStore: item.shipStore || '',
          storeNumber: item.storeNumber || '',
          items: []
        };
      } else {
        console.log('合併到現有群組:', phoneKey);
        // 如果客戶資訊是空的,用已有的資訊補充
        if (!item.nickname && customerGroups[phoneKey].nickname) {
          // 使用已存在的資訊
        } else if (item.nickname && !customerGroups[phoneKey].nickname) {
          customerGroups[phoneKey].nickname = item.nickname;
        }
        if (!item.name && customerGroups[phoneKey].name) {
          // 使用已存在的資訊
        } else if (item.name && !customerGroups[phoneKey].name) {
          customerGroups[phoneKey].name = item.name;
        }
        if (!item.shipStore && customerGroups[phoneKey].shipStore) {
          // 使用已存在的資訊
        } else if (item.shipStore && !customerGroups[phoneKey].shipStore) {
          customerGroups[phoneKey].shipStore = item.shipStore;
        }
        if (!item.storeNumber && customerGroups[phoneKey].storeNumber) {
          // 使用已存在的資訊
        } else if (item.storeNumber && !customerGroups[phoneKey].storeNumber) {
          customerGroups[phoneKey].storeNumber = item.storeNumber;
        }
      }
      
      customerGroups[phoneKey].items.push(item.itemText);
      console.log('當前群組商品數:', customerGroups[phoneKey].items.length);
      
      // 更新來源工作表的「寄出」狀態
      if (item.metadata) {
        try {
          var meta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
          
          if (meta.orderSheet && meta.orderRow && meta.shipCol) {
            var orderSheet = ss.getSheetByName(meta.orderSheet);
            if (orderSheet) {
              orderSheet.getRange(meta.orderRow, meta.shipCol).setValue('Y');
            }
          }
          
          if (meta.groupSheet && meta.groupRow && meta.groupShipCol) {
            var groupSheet = ss.getSheetByName(meta.groupSheet);
            if (groupSheet) {
              groupSheet.getRange(meta.groupRow, meta.groupShipCol).setValue('Y');
            }
          }
        } catch(e) {
          console.log('更新來源工作表錯誤:', e);
        }
      }
    }
    
    console.log('分組完成,客戶群組數:', Object.keys(customerGroups).length);
    
    // 為每個客戶建立一筆出貨紀錄,每個客戶有獨立的出貨編號
    var newRows = [];
    var shipmentNumbers = []; // 記錄所有出貨編號
    var customerIndex = 0;
    
    for (var key in customerGroups) {
      var group = customerGroups[key];
      var itemsText = group.items.join('\n');
      
      // 為每個客戶生成獨立的出貨編號
      var currentRow = shipmentSheet.getLastRow() + newRows.length;
      var shipmentNumber = 'SHIP-' + dateStr + '-' + String(currentRow).padStart(3, '0');
      shipmentNumbers.push(shipmentNumber);
      
      console.log('準備寫入客戶:', key, '出貨編號:', shipmentNumber, '商品數:', group.items.length, '商品內容:', itemsText);
      
      newRows.push([
        shipmentNumber, // 每個客戶有獨立的出貨編號
        now,
        group.nickname,
        group.name,
        "'" + group.phone, // 加上單引號前綴確保文字格式
        group.shipStore,
        "'" + group.storeNumber, // 加上單引號前綴確保文字格式
        itemsText,
        '', // 物流單號留空
        ''  // 備註留空
      ]);
      customerIndex++;
    }
    
    console.log('總共要寫入的行數:', newRows.length);
    
    // 寫入資料
    if (newRows.length > 0) {
      var startRow = shipmentSheet.getLastRow() + 1;
      
      // 先設定格式為文字
      shipmentSheet.getRange(startRow, 5, newRows.length, 1).setNumberFormat('@'); // 電話為文字
      shipmentSheet.getRange(startRow, 7, newRows.length, 1).setNumberFormat('@'); // 店號為文字
      shipmentSheet.getRange(startRow, 8, newRows.length, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
      
      // 再寫入資料
      shipmentSheet.getRange(startRow, 1, newRows.length, 10).setValues(newRows);
      
      // 設定對齊方式
      shipmentSheet.getRange(startRow, 1, newRows.length, 10).setVerticalAlignment('top');
      
      // 不需要合併儲存格,因為每個客戶已經是一行,商品明細用換行符分隔在同一個儲存格內
    }
    
    return { 
      success: true, 
      message: '出貨紀錄已建立',
      shipmentNumbers: shipmentNumbers, // 返回所有出貨編號
      count: newRows.length
    };
    
  } catch (e) {
    return { success: false, message: '建立出貨紀錄失敗: ' + e.toString() };
  }
}

/**
 * 查詢客戶的出貨紀錄
 * @param {String} phone - 客戶電話
 */
function getShipmentRecords(phone) {
  try {
    var ss = SpreadsheetManager.openSpreadsheet();
    var shipmentSheet = ss.getSheetByName('出貨紀錄');
    
    if (!shipmentSheet) {
      console.log('出貨紀錄 sheet 不存在');
      return { success: true, records: [], debug: 'sheet不存在' };
    }
    
    var data = shipmentSheet.getDataRange().getValues();
    console.log('出貨紀錄總行數:', data.length);
    
    if (data.length <= 1) {
      console.log('出貨紀錄沒有資料');
      return { success: true, records: [], debug: '沒有資料行數=' + data.length };
    }
    
    var headers = data[0];
    var phoneIdx = headers.indexOf('電話');
    
    console.log('標題列:', headers);
    console.log('電話欄位索引:', phoneIdx);
    
    if (phoneIdx === -1) {
      return { success: false, message: '找不到電話欄位', debug: '欄位索引=-1' };
    }
    
    var targetPhone = String(phone).replace(/\D/g, '');
    console.log('查詢電話號碼:', targetPhone);
    
    var records = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowPhone = String(row[phoneIdx] || '').replace(/\D/g, '');
      
      console.log('第' + i + '行電話:', rowPhone, '比對:', rowPhone === targetPhone);
      
      if (rowPhone === targetPhone) {
        records.push({
          shipmentNumber: row[0] || '',
          shipmentDate: row[1] ? Utilities.formatDate(new Date(row[1]), 'GMT+8', 'yyyy-MM-dd HH:mm') : '',
          nickname: row[2] || '',
          name: row[3] || '',
          phone: row[4] || '',
          shipStore: row[5] || '',
          storeNumber: row[6] || '',
          items: row[7] || '',
          trackingNumber: row[8] || '',
          note: row[9] || ''
        });
      }
    }
    
    console.log('找到紀錄數:', records.length);
    
    // 按日期降序排列 (最新的在前)
    records.sort(function(a, b) {
      return b.shipmentDate.localeCompare(a.shipmentDate);
    });
    
    return { success: true, records: records, debug: '查詢成功,共' + records.length + '筆' };
    
  } catch (e) {
    console.log('查詢出貨紀錄錯誤:', e);
    return { success: false, message: '查詢出貨紀錄失敗: ' + e.toString(), debug: e.toString() };
  }
}

// Google Apps Script Backend Code

/* ================================================================
📧 郵件通知功能
================================================================ */

/**
 * 查詢訂購特定商品的客戶電話清單
 * @param {String} itemName - 商品品項
 * @param {String} cardNo - 商品編號/卡號（不使用，保留參數以兼容）
 * @return {Array} 客戶電話清單
 */
function findCustomersForProduct(itemName, cardNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orderSheets = ['Topps_Now_訂購總表', '卡片明細'];
    var customerPhones = [];
    var nicknameSet = {}; // 用於去重（先收集群組暱稱）
    
    console.log('=== 開始查詢訂購客戶 ===');
    console.log('查詢條件 - 品項: [' + itemName + ']');
    
    // 步驟1: 從訂單表找出所有訂購該商品的「訂購人」（群組暱稱）
    var nicknames = [];
    
    for (var s = 0; s < orderSheets.length; s++) {
      var sheetName = orderSheets[s];
      var sheet = ss.getSheetByName(sheetName);
      
      if (!sheet) {
        console.log('找不到工作表: ' + sheetName);
        continue;
      }
      
      var data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        console.log(sheetName + ': 無資料');
        continue;
      }
      
      var headers = data[0].map(function(h) { return String(h).trim(); });
      
      var buyerIdx = headers.indexOf('訂購人');
      var itemIdx = headers.indexOf('品項');
      
      console.log(sheetName + ' - 欄位索引: 訂購人=' + buyerIdx + ', 品項=' + itemIdx);
      
      if (buyerIdx === -1 || itemIdx === -1) {
        console.log(sheetName + ' 缺少必要欄位 (訂購人或品項)');
        console.log('標題列: ' + JSON.stringify(headers));
        continue;
      }
      
      var matchCount = 0;
      
      // 掃描所有訂單，只比對品項
      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        var rowItem = String(row[itemIdx] || '').trim();
        var rowBuyer = String(row[buyerIdx] || '').trim();
        
        // 只比對品項，必須完全相符
        if (rowItem === itemName && rowBuyer) {
          if (!nicknameSet[rowBuyer]) {
            nicknameSet[rowBuyer] = true;
            nicknames.push(rowBuyer);
            matchCount++;
            console.log('✅ 找到訂購人 #' + matchCount + ': ' + rowBuyer + ' (工作表: ' + sheetName + ', 第' + (i+1) + '行)');
          }
        }
      }
      
      console.log(sheetName + ' 找到 ' + matchCount + ' 位不重複訂購人');
    }
    
    console.log('步驟1完成 - 共找到 ' + nicknames.length + ' 位不重複訂購人');
    
    if (nicknames.length === 0) {
      console.log('=== 查詢完成 ===');
      console.log('總共找到 0 位客戶');
      return [];
    }
    
    // 步驟2: 從客戶資料表查詢這些訂購人的電話
    var customerSheet = ss.getSheetByName('客戶資料');
    if (!customerSheet) {
      console.log('找不到「客戶資料」工作表');
      return [];
    }
    
    var customerData = customerSheet.getDataRange().getValues();
    if (customerData.length <= 1) {
      console.log('客戶資料表無資料');
      return [];
    }
    
    var customerHeaders = customerData[0].map(function(h) { return String(h).trim(); });
    var nicknameIdx = customerHeaders.indexOf('群組暱稱');
    var phoneIdx = customerHeaders.indexOf('電話');
    
    console.log('客戶資料表 - 欄位索引: 群組暱稱=' + nicknameIdx + ', 電話=' + phoneIdx);
    
    if (nicknameIdx === -1 || phoneIdx === -1) {
      console.log('客戶資料表缺少必要欄位');
      return [];
    }
    
    var phoneSet = {}; // 用於去重電話
    
    for (var i = 0; i < nicknames.length; i++) {
      var targetNickname = nicknames[i];
      
      for (var j = 1; j < customerData.length; j++) {
        var row = customerData[j];
        var rowNickname = String(row[nicknameIdx] || '').trim();
        var rowPhone = String(row[phoneIdx] || '').trim();
        
        if (rowNickname === targetNickname && rowPhone) {
          var normalizedPhone = rowPhone.replace(/\D/g, '');
          if (normalizedPhone && !phoneSet[normalizedPhone]) {
            phoneSet[normalizedPhone] = true;
            customerPhones.push(rowPhone);
            console.log('📞 訂購人 [' + targetNickname + '] -> 電話: ' + rowPhone);
          }
          break; // 找到就跳出
        }
      }
    }
    
    console.log('=== 查詢完成 ===');
    console.log('總共找到 ' + customerPhones.length + ' 位客戶電話');
    
    return customerPhones;
    
  } catch (e) {
    console.log('❌ 查詢客戶錯誤: ' + e);
    return [];
  }
}

/**
 * 手動發送到貨通知
 * 從選單執行：🎴 管理員功能 → 📬 發送到貨通知
 */
function sendArrivalNotificationManual() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ui = SpreadsheetApp.getUi();
    
    // 檢查郵件配額
    var emailQuota = MailApp.getRemainingDailyQuota();
    if (emailQuota === 0) {
      ui.alert('❌ 郵件配額已用完', '今日郵件發送已達上限，請明天再試。', ui.ButtonSet.OK);
      return;
    }
    
    // 讀取「下單商品」工作表
    var productSheet = ss.getSheetByName('下單商品');
    if (!productSheet) {
      ui.alert('❌ 錯誤', '找不到「下單商品」工作表', ui.ButtonSet.OK);
      return;
    }
    
    var data = productSheet.getDataRange().getValues();
    if (data.length <= 1) {
      ui.alert('⚠️ 提醒', '「下單商品」工作表沒有資料', ui.ButtonSet.OK);
      return;
    }
    
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var itemIdx = headers.indexOf('品項');
    var cardNoIdx = headers.indexOf('卡號'); // 下單商品表用「卡號」
    if (cardNoIdx === -1) {
      cardNoIdx = headers.indexOf('編號'); // 也可能叫「編號」
    }
    var arrivalIdx = -1;
    var notifiedIdx = -1;
    
    console.log('📋 下單商品表欄位索引: 品項=' + itemIdx + ', 卡號/編號=' + cardNoIdx);
    console.log('📋 標題列: ' + JSON.stringify(headers));
    
    // 找到「到貨狀況」或「到貨狀態」欄位
    for (var i = 0; i < headers.length; i++) {
      var header = headers[i];
      if (header === '到貨狀況' || header === '到貨狀態') {
        arrivalIdx = i;
      }
      if (header === '已通知到貨') {
        notifiedIdx = i;
      }
    }
    
    if (itemIdx === -1 || arrivalIdx === -1) {
      ui.alert('❌ 錯誤', '找不到必要欄位（品項、到貨狀況）', ui.ButtonSet.OK);
      return;
    }
    
    // 如果沒有「已通知到貨」欄位，建立它
    if (notifiedIdx === -1) {
      notifiedIdx = headers.length;
      productSheet.getRange(1, notifiedIdx + 1).setValue('已通知到貨');
      productSheet.getRange(1, notifiedIdx + 1).setBackground('#0b3a5e').setFontColor('#ffffff').setFontWeight('bold');
    }
    
    // 找出所有「到貨狀況 = V」且「尚未通知」的商品
    var arrivedProducts = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var arrivalStatus = String(row[arrivalIdx] || '').trim().toUpperCase();
      var notified = notifiedIdx < row.length ? String(row[notifiedIdx] || '').trim().toUpperCase() : '';
      
      // 只選擇：到貨狀況=V 且 尚未通知(不是Y或V)
      if (arrivalStatus === 'V' && notified !== 'Y' && notified !== 'V') {
        var itemName = String(row[itemIdx] || '').trim();
        var cardNo = cardNoIdx > -1 ? String(row[cardNoIdx] || '').trim() : '';
        var productName = itemName + (cardNo ? ' - ' + cardNo : '');
        
        arrivedProducts.push({
          name: productName,
          item: itemName,
          cardNo: cardNo,
          row: i + 1,
          sheetRow: i + 1
        });
      }
    }
    
    if (arrivedProducts.length === 0) {
      ui.alert('⚠️ 沒有需要通知的商品', '目前沒有「到貨狀況 = V」且「尚未通知」的商品。\n\n提示：\n• 請先在「下單商品」表中將商品的「到貨狀況」欄位設為 V\n• 已通知過的商品不會重複通知', ui.ButtonSet.OK);
      return;
    }
    
    // 顯示確認對話框
    var productList = arrivedProducts.map(function(p) { return '• ' + p.name; }).join('\n');
    var response = ui.alert(
      '📬 發送到貨通知',
      '找到 ' + arrivedProducts.length + ' 個新到貨商品（尚未通知）：\n\n' + productList + '\n\n是否發送到貨通知給所有訂購客戶？',
      ui.ButtonSet.YES_NO
    );
    
    if (response !== ui.Button.YES) {
      return;
    }
    
    // 發送通知
    var totalSent = 0;
    var totalCustomers = 0;
    var results = [];
    
    console.log('=== 開始發送到貨通知 ===');
    console.log('待處理商品數: ' + arrivedProducts.length);
    
    for (var i = 0; i < arrivedProducts.length; i++) {
      var product = arrivedProducts[i];
      
      console.log('\n--- 處理商品 ' + (i+1) + '/' + arrivedProducts.length + ' ---');
      console.log('商品顯示名稱: ' + product.name);
      console.log('品項值: [' + product.item + ']');
      console.log('卡號值: [' + product.cardNo + ']');
      
      var customers = findCustomersForProduct(product.item, product.cardNo);
      totalCustomers += customers.length;
      
      console.log('查詢結果: 找到 ' + customers.length + ' 位客戶');
      
      if (customers.length > 0) {
        var result = sendArrivalNotification(product.name, customers);
        if (result.success) {
          totalSent += result.sent;
          results.push('✅ ' + product.name + ': ' + result.sent + ' 位客戶');
          
          // 標記為已通知
          productSheet.getRange(product.sheetRow, notifiedIdx + 1).setValue('Y');
          console.log('✅ 已標記為已通知');
        } else {
          results.push('❌ ' + product.name + ': 發送失敗');
          console.log('❌ 郵件發送失敗');
        }
      } else {
        results.push('⚠️ ' + product.name + ': 無訂購客戶');
        // 即使沒有客戶，也標記為已通知，避免重複檢查
        productSheet.getRange(product.sheetRow, notifiedIdx + 1).setValue('Y');
        console.log('⚠️ 無客戶，已標記避免重複檢查');
      }
    }
    
    console.log('\n=== 發送完成 ===');
    
    // 顯示結果
    var resultMessage = '📧 到貨通知發送完成\n\n' +
                        '商品數量: ' + arrivedProducts.length + ' 個\n' +
                        '客戶總數: ' + totalCustomers + ' 位\n' +
                        '成功發送: ' + totalSent + ' 封郵件\n' +
                        '剩餘配額: ' + MailApp.getRemainingDailyQuota() + ' 封\n\n' +
                        '詳細結果：\n' + results.join('\n') + '\n\n' +
                        '✅ 已在「下單商品」表標記為「已通知到貨」';
    
    ui.alert('✅ 完成', resultMessage, ui.ButtonSet.OK);
    
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ 錯誤', '發送到貨通知失敗: ' + e.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * ⚠️ 重要：郵件發送權限設定
 * 
 * Google Apps Script 使用 MailApp 發送郵件時的注意事項：
 * 
 * 1. 發件人帳號：
 *    - 郵件會從「執行腳本的 Google 帳號」發送
 *    - 如果希望從 ningscard@gmail.com 發送，需要：
 *      a) 在 ningscard@gmail.com 帳號中開啟此腳本
 *      b) 或在該帳號中授權此腳本執行
 * 
 * 2. 每日發送限制：
 *    - 免費 Gmail 帳號：每天 100 封
 *    - Google Workspace 帳號：每天 1500 封
 * 
 * 3. 首次執行授權：
 *    - 第一次執行時 Google 會要求授權
 *    - 必須授權「傳送電子郵件」權限
 *    - 授權後才能正常發送郵件
 * 
 * 4. 測試建議：
 *    - 先執行 testArrivalNotification() 或 testShipmentNotification()
 *    - 確認可以正常發送後再正式使用
 */

/**
 * 發送商品到貨通知郵件
 * 當商品從「預購」變更為「現貨」時呼叫此函數
 * @param {String} productName - 商品名稱
 * @param {Array} customerPhones - 有訂購這個商品的客戶電話清單
 */
function sendArrivalNotification(productName, customerPhones) {
  try {
    // 檢查郵件配額
    var emailQuota = MailApp.getRemainingDailyQuota();
    console.log('📧 剩餘每日郵件配額: ' + emailQuota);
    
    if (emailQuota === 0) {
      console.log('❌ 已達每日郵件發送上限');
      return { success: false, message: '已達每日郵件發送上限，請明天再試' };
    }
    
    if (!productName || !customerPhones || customerPhones.length === 0) {
      console.log('無需發送到貨通知：沒有客戶資料');
      return { success: true, sent: 0 };
    }
    
    var ss = SpreadsheetManager.openSpreadsheet();
    var customerSheet = ss.getSheetByName('客戶資料');
    
    if (!customerSheet) {
      console.log('找不到客戶資料表');
      return { success: false, message: '找不到客戶資料表' };
    }
    
    var data = customerSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var phoneIdx = headers.indexOf('電話');
    var emailIdx = headers.findIndex(function(h) { return String(h).trim().toLowerCase() === 'email'; });
    var nicknameIdx = headers.indexOf('群組暱稱');
    
    if (phoneIdx === -1 || emailIdx === -1) {
      console.log('缺少必要欄位');
      return { success: false, message: '缺少必要欄位' };
    }
    
    var sentCount = 0;
    var emailsSent = [];
    
    // 正規化客戶電話清單
    var normalizedPhones = customerPhones.map(function(p) {
      return String(p).replace(/\D/g, '');
    });
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var customerPhone = String(row[phoneIdx] || '').replace(/\D/g, '');
      var customerEmail = String(row[emailIdx] || '').trim();
      var customerNickname = String(row[nicknameIdx] || '').trim();
      
      // 檢查是否在通知清單中且有 email
      if (normalizedPhones.indexOf(customerPhone) !== -1 && customerEmail) {
        // 避免重複發送
        if (emailsSent.indexOf(customerEmail) !== -1) {
          continue;
        }
        
        try {
          var subject = '📦 Ning\'s Card - 商品到貨通知: ' + productName;
          var body = '您好 ' + (customerNickname || '親愛的客戶') + '，\n\n' +
                     '您訂購的商品「' + productName + '」已經到貨囉！🎉\n\n' +
                     '請特別注意：\n' +
                     '✅ 請上線查看是否有尾款需要補繳\n' +
                     '✅ 請注意群組訊息，了解直播開箱時間\n' +
                     '✅ 如有任何問題歡迎聯繫\n\n' +
                     '感謝您的支持！\n\n' +
                     'Ning\'s Card Store\n' +
                     'Email: ningscard@gmail.com';
          
          MailApp.sendEmail({
            to: customerEmail,
            subject: subject,
            body: body,
            name: "Ning's Card Store"
          });
          
          emailsSent.push(customerEmail);
          sentCount++;
          console.log('✅ 已發送到貨通知給: ' + customerEmail + ' (剩餘配額: ' + MailApp.getRemainingDailyQuota() + ')');
          
        } catch (emailError) {
          console.log('❌ 發送郵件失敗給 ' + customerEmail + ': ' + emailError);
        }
      }
    }
    
    console.log('到貨通知完成，共發送 ' + sentCount + ' 封郵件');
    return { success: true, sent: sentCount, quota: MailApp.getRemainingDailyQuota() };
    
  } catch (e) {
    console.log('❌ 發送到貨通知錯誤: ' + e);
    return { success: false, message: e.toString() };
  }
}

/**
 * 發送出貨通知郵件
 * 當商品寄出時呼叫此函數
 * @param {Array} items - 出貨項目清單 [{phone, nickname, name, itemText, shipStore, storeNumber}]
 */
function sendShipmentEmails(items) {
  try {
    // 檢查郵件配額
    var emailQuota = MailApp.getRemainingDailyQuota();
    console.log('📧 剩餘每日郵件配額: ' + emailQuota);
    
    if (emailQuota === 0) {
      console.log('❌ 已達每日郵件發送上限');
      return { success: false, message: '已達每日郵件發送上限，請明天再試' };
    }
    
    if (!items || items.length === 0) {
      return { success: true, sent: 0 };
    }
    
    var ss = SpreadsheetManager.openSpreadsheet();
    var customerSheet = ss.getSheetByName('客戶資料');
    
    if (!customerSheet) {
      console.log('找不到客戶資料表');
      return { success: false, message: '找不到客戶資料表' };
    }
    
    var data = customerSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var phoneIdx = headers.indexOf('電話');
    var emailIdx = headers.findIndex(function(h) { return String(h).trim().toLowerCase() === 'email'; });
    
    if (phoneIdx === -1 || emailIdx === -1) {
      return { success: false, message: '缺少必要欄位' };
    }
    
    // 按電話號碼分組
    var customerGroups = {};
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var phoneKey = String(item.phone || '').replace(/\D/g, '');
      
      if (!phoneKey) continue;
      
      if (!customerGroups[phoneKey]) {
        customerGroups[phoneKey] = {
          nickname: item.nickname,
          name: item.name,
          shipStore: item.shipStore,
          storeNumber: item.storeNumber,
          items: []
        };
      }
      customerGroups[phoneKey].items.push(item.itemText);
    }
    
    var sentCount = 0;
    
    // 為每個客戶發送郵件
    for (var phoneKey in customerGroups) {
      var group = customerGroups[phoneKey];
      
      // 查找客戶 email
      var customerEmail = null;
      for (var i = 1; i < data.length; i++) {
        var rowPhone = String(data[i][phoneIdx] || '').replace(/\D/g, '');
        if (rowPhone === phoneKey) {
          customerEmail = String(data[i][emailIdx] || '').trim();
          break;
        }
      }
      
      if (!customerEmail) {
        console.log('客戶 ' + phoneKey + ' 沒有 email，跳過');
        continue;
      }
      
      try {
        var itemsList = group.items.join('\n');
        var subject = '🚚 Ning\'s Card - 出貨通知';
        var body = '您好 ' + (group.nickname || group.name || '親愛的客戶') + '，\n\n' +
                   '您的商品已經寄出囉！📦\n\n' +
                   '商品明細：\n' + itemsList + '\n\n' +
                   '收件資訊：\n' +
                   '門市：' + (group.shipStore || '-') + '\n' +
                   '店號：' + (group.storeNumber || '-') + '\n\n' +
                   '請留意簡訊通知，商品到達後請盡快取貨。\n' +
                   '如有任何問題歡迎聯繫！\n\n' +
                   '感謝您的支持！\n\n' +
                   'Ning\'s Card Store\n' +
                   'Email: ningscard@gmail.com';
        
        MailApp.sendEmail({
          to: customerEmail,
          subject: subject,
          body: body,
          name: "Ning's Card Store"
        });
        
        sentCount++;
        console.log('✅ 已發送出貨通知給: ' + customerEmail + ' (剩餘配額: ' + MailApp.getRemainingDailyQuota() + ')');
        
      } catch (emailError) {
        console.log('❌ 發送郵件失敗給 ' + customerEmail + ': ' + emailError);
      }
    }
    
    console.log('出貨通知完成，共發送 ' + sentCount + ' 封郵件');
    return { success: true, sent: sentCount, quota: MailApp.getRemainingDailyQuota() };
    
  } catch (e) {
    console.log('❌ 發送出貨通知錯誤: ' + e);
    return { success: false, message: e.toString() };
  }
}

/**
 * 檢查郵件發送權限和配額
 * 在 Google Apps Script 編輯器中執行此函數來檢查設定
 */
function checkEmailPermissions() {
  try {
    // 獲取當前執行腳本的帳號
    var userEmail = Session.getActiveUser().getEmail();
    var effectiveEmail = Session.getEffectiveUser().getEmail();
    
    // 檢查剩餘配額
    var quota = MailApp.getRemainingDailyQuota();
    
    var message = '📧 郵件發送權限檢查報告\n\n' +
                  '✅ 腳本執行帳號: ' + userEmail + '\n' +
                  '✅ 有效發件人: ' + effectiveEmail + '\n' +
                  '✅ 今日剩餘配額: ' + quota + ' 封\n\n';
    
    if (quota > 0) {
      message += '✅ 郵件發送權限正常！\n\n';
      message += '💡 提醒：\n';
      message += '- 郵件將從「' + effectiveEmail + '」發送\n';
      message += '- 如需從 ningscard@gmail.com 發送，請在該帳號中執行此腳本\n';
    } else {
      message += '❌ 今日配額已用完，請明天再試\n';
    }
    
    Logger.log(message);
    SpreadsheetApp.getUi().alert(message);
    
    return {
      success: true,
      userEmail: userEmail,
      effectiveEmail: effectiveEmail,
      quota: quota
    };
    
  } catch (e) {
    var errorMessage = '❌ 權限檢查失敗\n\n' +
                       '錯誤訊息: ' + e.toString() + '\n\n' +
                       '⚠️ 可能原因：\n' +
                       '1. 尚未授權「傳送電子郵件」權限\n' +
                       '2. 請執行測試函數並完成授權流程';
    
    Logger.log(errorMessage);
    SpreadsheetApp.getUi().alert(errorMessage);
    
    return {
      success: false,
      message: e.toString()
    };
  }
}

/**
 * 手動測試到貨通知
 * 在 Google Apps Script 編輯器中執行此函數來測試
 */
function testArrivalNotification() {
  try {
    // 先檢查權限
    Logger.log('=== 開始測試到貨通知 ===');
    
    var quota = MailApp.getRemainingDailyQuota();
    Logger.log('剩餘郵件配額: ' + quota);
    
    if (quota === 0) {
      SpreadsheetApp.getUi().alert('❌ 今日郵件配額已用完');
      return;
    }
    
    // 請修改為實際的商品名稱和客戶電話
    var productName = '測試商品 - 2024 Topps Chrome';
    var customerPhones = ['0975313096']; // ⚠️ 請修改為實際電話（必須是客戶資料中有 email 的電話）
    
    Logger.log('測試商品: ' + productName);
    Logger.log('測試電話: ' + customerPhones.join(', '));
    
    var result = sendArrivalNotification(productName, customerPhones);
    
    var message = '📧 測試結果\n\n' +
                  '成功: ' + (result.success ? '✅ 是' : '❌ 否') + '\n' +
                  '發送數量: ' + (result.sent || 0) + ' 封\n' +
                  '剩餘配額: ' + (result.quota || 0) + ' 封\n';
    
    if (!result.success) {
      message += '\n❌ 錯誤訊息: ' + (result.message || '未知錯誤');
    }
    
    if (result.sent === 0) {
      message += '\n⚠️ 注意：沒有發送郵件\n' +
                 '可能原因：\n' +
                 '1. 測試電話在客戶資料中沒有 email\n' +
                 '2. 電話號碼不存在於客戶資料表';
    }
    
    Logger.log('測試結果: ' + JSON.stringify(result));
    SpreadsheetApp.getUi().alert(message);
    
  } catch (e) {
    var errorMsg = '❌ 測試失敗: ' + e.toString();
    Logger.log(errorMsg);
    SpreadsheetApp.getUi().alert(errorMsg);
  }
}

/**
 * 手動測試出貨通知
 * 在 Google Apps Script 編輯器中執行此函數來測試
 */
function testShipmentNotification() {
  try {
    Logger.log('=== 開始測試出貨通知 ===');
    
    var quota = MailApp.getRemainingDailyQuota();
    Logger.log('剩餘郵件配額: ' + quota);
    
    if (quota === 0) {
      SpreadsheetApp.getUi().alert('❌ 今日郵件配額已用完');
      return;
    }
    
    // ⚠️ 請修改為實際的客戶資訊（必須是客戶資料中有 email 的客戶）
    var items = [{
      phone: '0975313096',
      nickname: '測試用戶',
      name: '王小明',
      itemText: '測試商品 x1',
      shipStore: '台北信義店',
      storeNumber: '123456'
    }];
    
    Logger.log('測試項目: ' + JSON.stringify(items));
    
    var result = sendShipmentEmails(items);
    
    var message = '📧 測試結果\n\n' +
                  '成功: ' + (result.success ? '✅ 是' : '❌ 否') + '\n' +
                  '發送數量: ' + (result.sent || 0) + ' 封\n' +
                  '剩餘配額: ' + (result.quota || 0) + ' 封\n';
    
    if (!result.success) {
      message += '\n❌ 錯誤訊息: ' + (result.message || '未知錯誤');
    }
    
    if (result.sent === 0) {
      message += '\n⚠️ 注意：沒有發送郵件\n' +
                 '可能原因：\n' +
                 '1. 測試電話在客戶資料中沒有 email\n' +
                 '2. 電話號碼不存在於客戶資料表';
    }
    
    Logger.log('測試結果: ' + JSON.stringify(result));
    SpreadsheetApp.getUi().alert(message);
    
  } catch (e) {
    var errorMsg = '❌ 測試失敗: ' + e.toString();
    Logger.log(errorMsg);
    SpreadsheetApp.getUi().alert(errorMsg);
  }
}
/* ================================================================
💰 運費管理功能
================================================================ */

/**
 * 計算客戶是否需要補運費
 * @param {String} phone - 客戶電話
 * @return {Object} { needShipping: Boolean, reason: String, amount: Number }
 */
function calculateShippingFee(phone) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var normalizedPhone = String(phone).replace(/\D/g, '');
    
    // 檢查卡盒訂單
    var boxTotal = 0;
    var boxSheet = ss.getSheetByName('卡盒訂單');
    if (boxSheet) {
      var boxData = boxSheet.getDataRange().getValues();
      if (boxData.length > 1) {
        var boxHeaders = boxData[0].map(function(h) { return String(h).trim(); });
        var phoneIdx = boxHeaders.indexOf('電話');
        var priceIdx = boxHeaders.indexOf('總價');
        var paidIdx = boxHeaders.indexOf('已付款');
        
        if (phoneIdx > -1 && priceIdx > -1) {
          for (var i = 1; i < boxData.length; i++) {
            var rowPhone = String(boxData[i][phoneIdx] || '').replace(/\D/g, '');
            var isPaid = paidIdx > -1 ? String(boxData[i][paidIdx] || '').toUpperCase() : '';
            
            if (rowPhone === normalizedPhone && (isPaid === 'Y' || isPaid === 'V')) {
              boxTotal += Number(boxData[i][priceIdx] || 0);
            }
          }
        }
      }
    }
    
    // 卡盒訂單 >= 3000 → 免運
    if (boxTotal >= ECPAY_CONFIG.FreeShippingThreshold) {
      return {
        needShipping: false,
        reason: '卡盒訂單滿 $' + ECPAY_CONFIG.FreeShippingThreshold + ' 免運',
        amount: 0
      };
    }
    
    // 檢查是否有團拆訂單
    var breakSheet = ss.getSheetByName('團拆紀錄');
    if (breakSheet) {
      var breakData = breakSheet.getDataRange().getValues();
      if (breakData.length > 1) {
        var breakHeaders = breakData[0].map(function(h) { return String(h).trim(); });
        var phoneIdx = breakHeaders.indexOf('電話');
        
        if (phoneIdx > -1) {
          for (var i = 1; i < breakData.length; i++) {
            var rowPhone = String(breakData[i][phoneIdx] || '').replace(/\D/g, '');
            if (rowPhone === normalizedPhone) {
              return {
                needShipping: false,
                reason: '有團拆訂單可併寄，免運',
                amount: 0
              };
            }
          }
        }
      }
    }
    
    // 檢查是否有 Topps Now 訂單
    var orderSheet = ss.getSheetByName('Topps_Now_訂購總表');
    if (orderSheet) {
      var orderData = orderSheet.getDataRange().getValues();
      if (orderData.length > 1) {
        var orderHeaders = orderData[0].map(function(h) { return String(h).trim(); });
        var buyerIdx = orderHeaders.indexOf('訂購人');
        
        if (buyerIdx > -1) {
          // 需要先找出該電話對應的群組暱稱
          var customerSheet = ss.getSheetByName('客戶資料');
          if (customerSheet) {
            var custData = customerSheet.getDataRange().getValues();
            var custHeaders = custData[0].map(function(h) { return String(h).trim(); });
            var custPhoneIdx = custHeaders.indexOf('電話');
            var nicknameIdx = custHeaders.indexOf('群組暱稱');
            
            if (custPhoneIdx > -1 && nicknameIdx > -1) {
              for (var i = 1; i < custData.length; i++) {
                var rowPhone = String(custData[i][custPhoneIdx] || '').replace(/\D/g, '');
                if (rowPhone === normalizedPhone) {
                  var nickname = String(custData[i][nicknameIdx] || '').trim();
                  
                  // 檢查該暱稱是否有 Topps Now 訂單
                  for (var j = 1; j < orderData.length; j++) {
                    var buyer = String(orderData[j][buyerIdx] || '').trim();
                    if (buyer === nickname) {
                      // 只有 Topps Now，需要運費
                      return {
                        needShipping: true,
                        reason: '僅 Topps Now 訂單需補運費',
                        amount: ECPAY_CONFIG.ShippingFee
                      };
                    }
                  }
                  break;
                }
              }
            }
          }
        }
      }
    }
    
    // 沒有任何訂單
    return {
      needShipping: false,
      reason: '無需出貨訂單',
      amount: 0
    };
    
  } catch (e) {
    console.log('計算運費錯誤: ' + e);
    return {
      needShipping: false,
      reason: '計算錯誤',
      amount: 0
    };
  }
}

/**
 * 手動補運費功能
 * 從選單執行：🎴 管理員功能 → 💰 手動補運費
 */
function addShippingFeeManual() {
  try {
    var ui = SpreadsheetApp.getUi();
    
    // 輸入客戶電話
    var response = ui.prompt(
      '💰 補運費',
      '請輸入客戶電話號碼：',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (response.getSelectedButton() !== ui.Button.OK) {
      return;
    }
    
    var phone = response.getResponseText().trim();
    if (!phone) {
      ui.alert('請輸入電話號碼');
      return;
    }
    
    // 計算是否需要運費
    var result = calculateShippingFee(phone);
    
    if (!result.needShipping) {
      ui.alert(
        '無需補運費',
        '客戶: ' + phone + '\n' + result.reason,
        ui.ButtonSet.OK
      );
      return;
    }
    
    // 確認補運費
    var confirm = ui.alert(
      '確認補運費',
      '客戶: ' + phone + '\n' +
      '原因: ' + result.reason + '\n' +
      '運費: $' + result.amount + '\n\n' +
      '是否新增運費訂單？',
      ui.ButtonSet.YES_NO
    );
    
    if (confirm !== ui.Button.YES) {
      return;
    }
    
    // 查詢客戶資料
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var customerSheet = ss.getSheetByName('客戶資料');
    if (!customerSheet) {
      ui.alert('找不到客戶資料表');
      return;
    }
    
    var custData = customerSheet.getDataRange().getValues();
    var custHeaders = custData[0].map(function(h) { return String(h).trim(); });
    var phoneIdx = custHeaders.indexOf('電話');
    var nicknameIdx = custHeaders.indexOf('群組暱稱');
    var normalizedPhone = phone.replace(/\D/g, '');
    var nickname = '';
    
    for (var i = 1; i < custData.length; i++) {
      var rowPhone = String(custData[i][phoneIdx] || '').replace(/\D/g, '');
      if (rowPhone === normalizedPhone) {
        nickname = String(custData[i][nicknameIdx] || '').trim();
        break;
      }
    }
    
    if (!nickname) {
      ui.alert('找不到客戶資料');
      return;
    }
    
    // 新增運費訂單到 Topps_Now_訂購總表
    var orderSheet = ss.getSheetByName('Topps_Now_訂購總表');
    if (!orderSheet) {
      ui.alert('找不到訂購總表');
      return;
    }
    
    var now = new Date();
    var newRow = [
      now,                    // 時間戳記
      nickname,               // 訂購人
      phone,                  // 聯絡方式
      '運費補繳',             // 品項
      '',                     // 卡號
      result.amount,          // 單價
      1,                      // 張數
      result.amount,          // 總價
      0,                      // 訂金
      result.amount,          // 尾款
      '',                     // 開單
      '',                     // 寄出
      '',                     // 結清
      '待付款',               // 狀態
      '',                     // 到貨狀態
      '',                     // 圖片連結
      '',                     // vlookup
      '',                     // 卡盒訂單
      '系統自動補運費'        // 備註
    ];
    
    orderSheet.appendRow(newRow);
    
    ui.alert(
      '✅ 運費已新增',
      '客戶: ' + nickname + '\n' +
      '電話: ' + phone + '\n' +
      '運費: $' + result.amount + '\n\n' +
      '已新增至訂購總表',
      ui.ButtonSet.OK
    );
    
  } catch (e) {
    SpreadsheetApp.getUi().alert('錯誤: ' + e.toString());
  }
}

/* ================================================================
💳 綠界金流整合
================================================================ */

/**
 * 測試 CheckMacValue 計算（用官方範例驗證）
 */
function testCheckMacValue() {
  // 官方文件範例
  var testParams = {
    ChoosePayment: 'ALL',
    EncryptType: 1,
    ItemName: 'Apple iphone 15',
    MerchantID: '3002607',
    MerchantTradeDate: '2023/03/12 15:30:23',
    MerchantTradeNo: 'ecpay20230312153023',
    PaymentType: 'aio',
    ReturnURL: 'https://www.ecpay.com.tw/receive.php',
    TotalAmount: 30000,
    TradeDesc: '促銷方案'
  };
  
  var checkMac = generateEcpayCheckMac(testParams);
  console.log('測試 CheckMacValue: ' + checkMac);
  console.log('官方範例應為: 6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840');
  
  return {
    calculated: checkMac,
    expected: '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840',
    match: checkMac === '6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840'
  };
}

/**
 * 建立綠界付款訂單
 * @param {Object} payload - { phone, nickname, orderIds, amount, itemName, orderDetails }
 */
function createEcpayPayment(payload) {
  try {
    // Debug: 記錄接收到的 payload
    Logger.log('========== createEcpayPayment 接收到的 payload ==========');
    Logger.log('payload 內容: ' + JSON.stringify(payload));
    
    if (ECPAY_CONFIG.MerchantID === 'YOUR_MERCHANT_ID') {
      return {
        success: false,
        message: '請先設定綠界金流資訊（MerchantID, HashKey, HashIV）'
      };
    }
    
    var phone = payload.phone;
    var nickname = payload.nickname || '';
    var orderIds = payload.orderIds || [];
    var amount = payload.amount;
    var itemName = payload.itemName || '商品訂單';
    var orderDetails = payload.orderDetails || [];
    var paymentType = payload.paymentType || 'order';  // 🌟 新增:記錄是訂單還是團拆
    
    Logger.log('解析後 orderDetails: ' + JSON.stringify(orderDetails));
    Logger.log('orderDetails 長度: ' + orderDetails.length);
    Logger.log('paymentType: ' + paymentType);
    
    // 驗證金額範圍（測試環境限制: 1-20000）
    if (amount < 1) {
      return {
        success: false,
        message: '付款金額不得小於 NT$ 1'
      };
    }
    
    if (amount > 20000) {
      return {
        success: false,
        message: '測試環境單筆金額上限為 NT$ 20,000（正式環境無此限制）'
      };
    }
    
    // 產生訂單編號（時間戳記）
    var merchantTradeNo = 'NC' + new Date().getTime();
    
    // TradeDesc 和 ItemName 需要確保格式正確
    // 移除特殊字符，避免 URL encode 問題
    var cleanItemName = itemName.substring(0, 200); // 綠界限制 200 字元
    var tradeDesc = 'NingsCard';  // 簡化，避免特殊字符
    
    // 建立綠界付款參數
    var ecpayParams = {
      MerchantID: ECPAY_CONFIG.MerchantID,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: Utilities.formatDate(new Date(), 'GMT+8', 'yyyy/MM/dd HH:mm:ss'),
      PaymentType: 'aio',
      TotalAmount: Math.round(amount),
      TradeDesc: tradeDesc,
      ItemName: cleanItemName,
      ReturnURL: ECPAY_CONFIG.ReturnURL,
      ClientBackURL: ECPAY_CONFIG.ClientBackURL,  // 不帶參數
      ChoosePayment: ECPAY_CONFIG.ChoosePayment,
      EncryptType: 1,
      // 自訂欄位：記錄電話和訂單ID
      CustomField1: phone,
      CustomField2: orderIds.join(',')
    };
    
    // 產生檢查碼
    var checkMacValue = generateEcpayCheckMac(ecpayParams);
    ecpayParams.CheckMacValue = checkMacValue;
    
    // Debug: 記錄完整參數
    console.log('=== 綠界付款參數 ===');
    console.log('MerchantID: ' + ecpayParams.MerchantID);
    console.log('MerchantTradeNo: ' + ecpayParams.MerchantTradeNo);
    console.log('MerchantTradeDate: ' + ecpayParams.MerchantTradeDate);
    console.log('TotalAmount: ' + ecpayParams.TotalAmount);
    console.log('TradeDesc: ' + ecpayParams.TradeDesc);
    console.log('ItemName: ' + ecpayParams.ItemName);
    console.log('CheckMacValue: ' + checkMacValue);
    console.log('====================');
    
    // 儲存付款記錄(包含訂單詳細資料)
    Logger.log('準備儲存付款記錄...');
    Logger.log('orderDetails 傳入 savePaymentRecord: ' + JSON.stringify(orderDetails));
    
    savePaymentRecord({
      merchantTradeNo: merchantTradeNo,
      phone: phone,
      nickname: nickname,
      orderIds: orderIds,
      amount: amount,
      itemName: itemName,
      orderDetails: orderDetails,
      paymentType: paymentType,  // 🌟 新增:儲存付款類型
      status: 'pending',
      createTime: new Date()
    });
    
    Logger.log('✅ 付款訂單建立完成');
    Logger.log('付款金額: ' + amount + ', 暮稱: ' + nickname);
    Logger.log('商品名稱: ' + itemName);
    Logger.log('訂單明細: ' + JSON.stringify(orderDetails));
    
    return {
      success: true,
      paymentUrl: ECPAY_CONFIG.PaymentURL,
      params: ecpayParams,
      merchantTradeNo: merchantTradeNo  // 返回付款單號給前端
    };
    
  } catch (e) {
    return {
      success: false,
      message: '建立付款訂單失敗: ' + e.toString()
    };
  }
}

/**
 * 查詢付款狀態
 * @param {string} merchantTradeNo - 付款單號
 * @return {Object} { success: true, status: 'pending'|'success'|'failed', paymentTime: Date }
 */
function checkPaymentStatus(merchantTradeNo) {
  try {
    if (!merchantTradeNo) {
      return { success: false, message: '缺少付款單號' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('綠界付款記錄');
    
    if (!sheet) {
      return { success: false, message: '找不到付款記錄' };
    }
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    
    var orderNoIdx = headers.indexOf('付款單號');
    var statusIdx = headers.indexOf('狀態');
    var paymentTimeIdx = headers.indexOf('付款時間');
    var tradeNoIdx = headers.indexOf('綠界交易編號');
    
    // 查找付款記錄
    for (var i = 1; i < data.length; i++) {
      if (data[i][orderNoIdx] === merchantTradeNo) {
        var status = data[i][statusIdx];
        var paymentTime = data[i][paymentTimeIdx];
        var tradeNo = data[i][tradeNoIdx];
        
        return {
          success: true,
          status: status,
          paymentTime: paymentTime ? paymentTime.toString() : null,
          tradeNo: tradeNo || null
        };
      }
    }
    
    return { success: false, message: '找不到付款記錄' };
    
  } catch (e) {
    return { success: false, message: '查詢失敗: ' + e.toString() };
  }
}

/**
 * 立即更新訂單狀態為「付款確認中」
 * @param {Array} orderDetails - 訂單明細
 * @param {string} merchantTradeNo - 付款單號
 */
function updateOrderStatusToPending(orderDetails, merchantTradeNo) {
  try {
    if (!orderDetails || orderDetails.length === 0) {
      return { success: false, message: '缺少訂單明細' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orderSheet = ss.getSheetByName('Topps_Now_訂購總表');
    
    if (!orderSheet) {
      return { success: false, message: '找不到訂購總表' };
    }
    
    var data = orderSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var nicknameIdx = headers.indexOf('訂購人');
    var timestampIdx = headers.indexOf('時間戳記');
    var itemIdx = headers.indexOf('品項');
    var cardNoIdx = headers.indexOf('卡號');
    var statusIdx = headers.indexOf('狀態');
    
    if (nicknameIdx === -1 || timestampIdx === -1 || statusIdx === -1) {
      return { success: false, message: '找不到必要欄位' };
    }
    
    var updatedCount = 0;
    
    // 遍歷訂單明細,更新狀態為「付款確認中」
    for (var d = 0; d < orderDetails.length; d++) {
      var detail = orderDetails[d];
      
      for (var i = 1; i < data.length; i++) {
        var rowNickname = String(data[i][nicknameIdx]).trim();
        var rowTimestamp = data[i][timestampIdx];
        var rowItem = String(data[i][itemIdx]).trim();
        var rowCardNo = data[i][cardNoIdx];
        
        // 轉換時間戳記為 GMT+8 日期
        var rowDateStr = '';
        var detailDateStr = '';
        
        if (rowTimestamp instanceof Date) {
          rowDateStr = Utilities.formatDate(rowTimestamp, 'GMT+8', 'yyyy-MM-dd');
        } else if (rowTimestamp) {
          try {
            rowDateStr = Utilities.formatDate(new Date(rowTimestamp), 'GMT+8', 'yyyy-MM-dd');
          } catch (e) {
            rowDateStr = String(rowTimestamp).substring(0, 10);
          }
        }
        
        if (detail.timestamp instanceof Date) {
          detailDateStr = Utilities.formatDate(detail.timestamp, 'GMT+8', 'yyyy-MM-dd');
        } else if (detail.timestamp) {
          try {
            var detailDate = new Date(detail.timestamp);
            detailDateStr = Utilities.formatDate(detailDate, 'GMT+8', 'yyyy-MM-dd');
          } catch (e) {
            var tsStr = String(detail.timestamp);
            detailDateStr = tsStr.indexOf('T') > -1 ? tsStr.split('T')[0] : tsStr.substring(0, 10);
          }
        }
        
        var timestampMatch = rowDateStr === detailDateStr;
        var cardNoMatch = String(rowCardNo) === String(detail.cardNo);
        
        if (rowNickname === detail.nickname &&
            timestampMatch &&
            rowItem === detail.item &&
            cardNoMatch) {
          
          var rowNum = i + 1;
          
          // 更新狀態為「付款確認中」
          orderSheet.getRange(rowNum, statusIdx + 1).setValue('付款確認中');
          updatedCount++;
          break;
        }
      }
    }
    
    return { 
      success: true, 
      message: '已更新 ' + updatedCount + ' 筆訂單狀態為「付款確認中」',
      updatedCount: updatedCount
    };
    
  } catch (e) {
    return { success: false, message: '更新失敗: ' + e.toString() };
  }
}

/**
 * 立即更新團拆狀態為「付款確認中」
 * @param {Array} breakDetails - 團拆明細
 * @param {string} merchantTradeNo - 付款單號
 */
function updateBreakStatusToPending(breakDetails, merchantTradeNo) {
  try {
    if (!breakDetails || breakDetails.length === 0) {
      return { success: false, message: '缺少團拆明細' };
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var breakSheet = ss.getSheetByName('團拆紀錄');
    
    if (!breakSheet) {
      return { success: false, message: '找不到團拆紀錄' };
    }
    
    var data = breakSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    var nicknameIdx = headers.indexOf('訂購人');
    var breakIdIdx = headers.indexOf('團拆編號');
    var statusIdx = headers.indexOf('狀態');
    
    if (nicknameIdx === -1 || breakIdIdx === -1 || statusIdx === -1) {
      return { success: false, message: '找不到必要欄位:訂購人/團拆編號/狀態' };
    }
    
    var updatedCount = 0;
    
    // 遍歷團拆明細,更新狀態為「付款確認中」
    for (var d = 0; d < breakDetails.length; d++) {
      var detail = breakDetails[d];
      
      for (var i = 1; i < data.length; i++) {
        var rowNickname = String(data[i][nicknameIdx]).trim();
        var rowBreakId = String(data[i][breakIdIdx]).trim();
        
        if (rowNickname === detail.nickname && rowBreakId === detail.breakId) {
          var rowNum = i + 1;
          
          // 更新狀態為「付款確認中」
          breakSheet.getRange(rowNum, statusIdx + 1).setValue('付款確認中');
          updatedCount++;
          break;
        }
      }
    }
    
    return { 
      success: true, 
      message: '已更新 ' + updatedCount + ' 筆團拆狀態為「付款確認中」',
      updatedCount: updatedCount
    };
    
  } catch (e) {
    return { success: false, message: '更新失敗: ' + e.toString() };
  }
}

/**
 * 產生綠界檢查碼
 */
function generateEcpayCheckMac(params) {
  var hashKey = ECPAY_CONFIG.HashKey;
  var hashIV = ECPAY_CONFIG.HashIV;
  
  // 1. 移除 CheckMacValue (如果存在)
  var cleanParams = {};
  for (var key in params) {
    if (key !== 'CheckMacValue') {
      cleanParams[key] = params[key];
    }
  }
  
  // 2. 排序參數（按照 A-Z 排序）
  var sortedKeys = Object.keys(cleanParams).sort();
  
  // 3. 組合參數字串
  var paramPairs = [];
  for (var i = 0; i < sortedKeys.length; i++) {
    var key = sortedKeys[i];
    paramPairs.push(key + '=' + cleanParams[key]);
  }
  var paramStr = paramPairs.join('&');
  
  // 4. 加上 HashKey 和 HashIV
  var rawStr = 'HashKey=' + hashKey + '&' + paramStr + '&HashIV=' + hashIV;
  
  console.log('步驟4 - 加上 HashKey/IV: ' + rawStr);
  
  // 5. URL Encode
  var encodedStr = encodeURIComponent(rawStr);
  
  console.log('步驟5 - URL Encode: ' + encodedStr);
  
  // 6. 轉小寫
  encodedStr = encodedStr.toLowerCase();
  
  console.log('步驟6 - 轉小寫: ' + encodedStr);
  
  // 7. 特殊字符還原（綠界的 .NET URL Encode 規則）
  encodedStr = encodedStr.replace(/%2d/g, '-');   // -
  encodedStr = encodedStr.replace(/%5f/g, '_');   // _
  encodedStr = encodedStr.replace(/%2e/g, '.');   // .
  encodedStr = encodedStr.replace(/%21/g, '!');   // !
  encodedStr = encodedStr.replace(/%2a/g, '*');   // *
  encodedStr = encodedStr.replace(/%28/g, '(');   // (
  encodedStr = encodedStr.replace(/%29/g, ')');   // )
  
  // 8. 空格轉換為 + (application/x-www-form-urlencoded 標準)
  encodedStr = encodedStr.replace(/%20/g, '+');
  
  console.log('步驟8 - 特殊字符還原完成: ' + encodedStr);
  
  // 9. SHA256 加密
  var hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    encodedStr,
    Utilities.Charset.UTF_8
  );
  
  // 10. 轉換為十六進制字串
  var checkMacValue = '';
  for (var j = 0; j < hash.length; j++) {
    var byte = hash[j];
    if (byte < 0) byte = byte + 256;
    var hex = byte.toString(16);
    if (hex.length == 1) hex = '0' + hex;
    checkMacValue += hex;
  }
  
  // 11. 轉大寫
  checkMacValue = checkMacValue.toUpperCase();
  
  console.log('步驟11 - 最終 CheckMacValue: ' + checkMacValue);
  
  return checkMacValue;
}

/**
 * 處理綠界付款回調
 */
function handleEcpayCallback(params) {
  try {
    var callbackReceivedTime = new Date();
    Logger.log('========== 綠界付款回調開始處理 ==========');
    Logger.log('🕐 Callback 接收時間: ' + Utilities.formatDate(callbackReceivedTime, 'GMT+8', 'yyyy-MM-dd HH:mm:ss'));
    Logger.log('訂單編號: ' + params.MerchantTradeNo);
    Logger.log('付款狀態: ' + params.RtnCode + ' (' + params.RtnMsg + ')');
    Logger.log('付款金額: ' + params.TradeAmt);
    Logger.log('綠界交易編號: ' + params.TradeNo);
    Logger.log('綠界回傳的付款時間: ' + params.PaymentDate);
    Logger.log('是否為模擬付款: ' + (params.SimulatePaid || '0'));
    
    // 檢查是否為模擬付款
    var isSimulated = params.SimulatePaid === '1';
    
    if (isSimulated) {
      Logger.log('⚠️ 這是模擬付款，不更新訂單狀態');
      Logger.log('✅ 模擬付款測試成功！ReturnURL 可以正常接收通知');
      return ContentService.createTextOutput('1|OK').setMimeType(ContentService.MimeType.TEXT);
    }
    
    // 驗證 CheckMacValue
    var receivedCheckMac = params.CheckMacValue;
    
    // 建立一個乾淨的參數副本用於驗證（移除 CheckMacValue）
    var paramsForValidation = {};
    for (var key in params) {
      if (key !== 'CheckMacValue') {
        paramsForValidation[key] = params[key];
      }
    }
    
    var calculatedCheckMac = generateEcpayCheckMac(paramsForValidation);
    
    if (receivedCheckMac !== calculatedCheckMac) {
      Logger.log('❌ CheckMacValue 驗證失敗!');
      Logger.log('收到: ' + receivedCheckMac);
      Logger.log('計算: ' + calculatedCheckMac);
      return ContentService.createTextOutput('0|CheckMacValue Error').setMimeType(ContentService.MimeType.TEXT);
    }
    
    Logger.log('✅ CheckMacValue 驗證成功!');
    
    var merchantTradeNo = params.MerchantTradeNo;
    var rtnCode = params.RtnCode;
    var phone = params.CustomField1;
    var orderIds = params.CustomField2 ? params.CustomField2.split(',') : [];
    var paymentAmount = Number(params.TradeAmt || 0);
    
    Logger.log('付款資訊: 電話=' + phone + ', 金額=' + paymentAmount);
    
    // 從付款記錄讀取 orderDetails 和 paymentType
    var paymentData = getOrderDetailsFromPaymentRecord(merchantTradeNo);
    var orderDetails = paymentData.orderDetails;
    var paymentType = paymentData.paymentType;
    
    Logger.log('========================================');
    Logger.log('📦 從付款記錄讀取的資料:');
    Logger.log('付款類型: ' + paymentType);
    Logger.log('訂單明細數量: ' + (orderDetails ? orderDetails.length : 0));
    Logger.log('訂單明細完整內容: ' + JSON.stringify(orderDetails));
    Logger.log('========================================');
    
    // 真實付款才更新記錄和訂單
    // 更新付款記錄
    updatePaymentRecord(merchantTradeNo, {
      status: rtnCode === '1' ? 'success' : 'failed',
      rtnCode: rtnCode,
      rtnMsg: params.RtnMsg,
      tradeNo: params.TradeNo,
      paymentDate: params.PaymentDate,
      updateTime: new Date()
    });
    
    Logger.log('✅ 付款記錄已更新');
    
    // 如果付款成功，根據付款類型更新對應的狀態
    if (rtnCode === '1') {
      var paymentMethod = params.PaymentType || '綠界金流';
      
      if (paymentType === 'break') {
        // 團拆付款
        updateBreakPaymentStatus(orderDetails, paymentMethod, params.TradeNo);
        Logger.log('✅ 團拆狀態已更新為已結清');
      } else {
        // 訂單付款
        updateOrderPaymentStatus(orderDetails, paymentMethod, params.TradeNo);
        Logger.log('✅ 訂單狀態已更新為已付款');
      }
    }
    
    Logger.log('========== 準備回傳 1|OK ==========');
    return ContentService.createTextOutput('1|OK').setMimeType(ContentService.MimeType.TEXT);
    
  } catch (e) {
    Logger.log('❌ 處理綠界回調錯誤: ' + e.toString());
    Logger.log('錯誤堆疊: ' + e.stack);
    return ContentService.createTextOutput('0|Error: ' + e.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * 儲存付款記錄
 */
function savePaymentRecord(record) {
  try {
    Logger.log('========== savePaymentRecord 開始 ==========');
    Logger.log('record.orderDetails: ' + JSON.stringify(record.orderDetails));
    Logger.log('record.orderDetails 型別: ' + typeof record.orderDetails);
    Logger.log('record.paymentType: ' + record.paymentType);
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('綠界付款記錄');
    
    if (!sheet) {
      sheet = ss.insertSheet('綠界付款記錄');
      var headers = [
        '付款單號', '客戶電話', '暱稱', '訂單編號', '金額', '商品名稱',
        '狀態', '建立時間', '付款時間', '綠界交易編號', '回傳訊息', '更新時間', '訂單明細', '付款類型'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
        .setBackground('#0b3a5e').setFontColor('#ffffff').setFontWeight('bold');
    }
    
    var orderDetailsJson = record.orderDetails ? JSON.stringify(record.orderDetails) : '';
    Logger.log('orderDetailsJson: ' + orderDetailsJson);
    Logger.log('orderDetailsJson 長度: ' + orderDetailsJson.length);
    
    // 產生訂單摘要（用於顯示）
    var orderSummary = '';
    if (record.orderDetails && record.orderDetails.length > 0) {
      if (record.paymentType === 'break') {
        // 團拆摘要
        var items = record.orderDetails.map(function(d) {
          return d.breakId || d.breakName;
        });
        orderSummary = items.join(', ');
      } else {
        // 訂單摘要
        var items = record.orderDetails.map(function(d) {
          return d.item + (d.cardNo ? ' ' + d.cardNo : '');
        });
        orderSummary = items.join(', ');
      }
    }
    
    var newRow = [
      record.merchantTradeNo,
      record.phone,
      record.nickname || '',
      orderSummary || record.orderIds.join(','),  // 顯示商品摘要而非索引
      record.amount,
      record.itemName,
      record.status,
      record.createTime,
      '',
      '',
      '',
      record.createTime,
      orderDetailsJson,
      record.paymentType || 'order'  // 🌟 儲存付款類型
    ];
    
    sheet.appendRow(newRow);
    
  } catch (e) {
    console.log('儲存付款記錄錯誤: ' + e);
  }
}

/**
 * 從付款記錄中讀取 orderDetails 和 paymentType
 */
function getOrderDetailsFromPaymentRecord(merchantTradeNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('綠界付款記錄');
    
    if (!sheet) return { orderDetails: [], paymentType: 'order' };
    
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var detailsIdx = headers.indexOf('訂單明細');
    var paymentTypeIdx = headers.indexOf('付款類型');
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === merchantTradeNo) {
        var detailsJson = data[i][detailsIdx];
        var paymentType = paymentTypeIdx > -1 ? (data[i][paymentTypeIdx] || 'order') : 'order';
        
        var orderDetails = [];
        if (detailsJson) {
          try {
            orderDetails = JSON.parse(detailsJson);
          } catch (e) {
            Logger.log('解析 orderDetails JSON 失敗: ' + e);
          }
        }
        
        return {
          orderDetails: orderDetails,
          paymentType: paymentType
        };
      }
    }
    
    return { orderDetails: [], paymentType: 'order' };
    
  } catch (e) {
    Logger.log('讀取 orderDetails 錯誤: ' + e);
    return { orderDetails: [], paymentType: 'order' };
  }
}

/**
 * 更新付款記錄
 */
function updatePaymentRecord(merchantTradeNo, updateData) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('綠界付款記錄');
    
    if (!sheet) return;
    
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === merchantTradeNo) {
        if (updateData.status) sheet.getRange(i + 1, 7).setValue(updateData.status);
        if (updateData.paymentDate) sheet.getRange(i + 1, 9).setValue(updateData.paymentDate);
        if (updateData.tradeNo) sheet.getRange(i + 1, 10).setValue(updateData.tradeNo);
        if (updateData.rtnMsg) sheet.getRange(i + 1, 11).setValue(updateData.rtnMsg);
        if (updateData.updateTime) sheet.getRange(i + 1, 12).setValue(updateData.updateTime);
        break;
      }
    }
    
  } catch (e) {
    Logger.log('更新付款記錄錯誤: ' + e);
  }
}

/**
 * 更新訂單付款狀態
 * @param {Array} orderDetails - 訂單明細陣列 [{nickname, timestamp, item, cardNo, balance}, ...]
 * @param {string} paymentMethod - 付款方式
 * @param {string} tradeNo - 綠界交易編號
 */
function updateOrderPaymentStatus(orderDetails, paymentMethod, tradeNo) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var orderSheet = ss.getSheetByName('Topps_Now_訂購總表');
    
    if (!orderSheet) {
      Logger.log('找不到訂購總表');
      return;
    }
    
    if (!orderDetails || orderDetails.length === 0) {
      Logger.log('⚠️ 沒有訂單明細，無法更新');
      return;
    }
    
    var data = orderSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    // 輸出所有欄位名稱以便檢查
    Logger.log('========================================');
    Logger.log('訂購總表所有欄位: ' + JSON.stringify(headers));
    Logger.log('========================================');
    
    // 找到所有必要的欄位索引
    var nicknameIdx = headers.indexOf('訂購人');
    var timestampIdx = headers.indexOf('時間戳記');
    var itemIdx = headers.indexOf('品項');
    var cardNoIdx = headers.indexOf('卡號');
    var depositIdx = headers.indexOf('訂金');
    var balanceIdx = headers.indexOf('尾款');
    var statusIdx = headers.indexOf('狀態');
    var remarkIdx = headers.indexOf('備註');
    
    // 新增的欄位
    var paymentMethodIdx = headers.indexOf('付款方式');
    var ecpayNoIdx = headers.indexOf('綠界訂單號');
    var paymentTimeIdx = headers.indexOf('付款時間');
    
    Logger.log('欄位索引 - 訂購人:' + nicknameIdx + ', 時間戳記:' + timestampIdx + ', 訂金:' + depositIdx + ', 尾款:' + balanceIdx + ', 狀態:' + statusIdx);
    Logger.log('新欄位索引 - 付款方式:' + paymentMethodIdx + ', 綠界訂單號:' + ecpayNoIdx + ', 付款時間:' + paymentTimeIdx);
    
    // 檢查必要欄位是否存在
    if (nicknameIdx === -1) {
      Logger.log('❌ 找不到「訂購人」欄位！');
      return;
    }
    if (timestampIdx === -1) {
      Logger.log('❌ 找不到「時間戳記」欄位！');
      return;
    }
    if (depositIdx === -1) {
      Logger.log('❌ 找不到「訂金」欄位！');
      return;
    }
    
    var now = new Date();
    var updatedCount = 0;
    
    Logger.log('開始更新訂單');
    Logger.log('要更新的訂單數量: ' + orderDetails.length);
    
    // 遍歷每筆訂單明細，精確匹配對應的 Sheet 行
    for (var j = 0; j < orderDetails.length; j++) {
      var detail = orderDetails[j];
      Logger.log('========================================');
      Logger.log('處理訂單 #' + (j+1) + ':');
      Logger.log('  尋找條件 - 暱稱: "' + detail.nickname + '"');
      Logger.log('  尋找條件 - 時間: "' + detail.timestamp + '"');
      Logger.log('  尋找條件 - 品項: "' + detail.item + '"');
      Logger.log('  尋找條件 - 卡號: "' + detail.cardNo + '"');
      
      var matched = false;
      
      // 在 Sheet 中找到完全匹配的訂單
      for (var i = 1; i < data.length; i++) {
        var rowNickname = String(data[i][nicknameIdx] || '').trim();
        var rowTimestamp = data[i][timestampIdx];
        var rowItem = String(data[i][itemIdx] || '').trim();
        var rowCardNo = String(data[i][cardNoIdx] || '').trim();
        
        // 調試：只有當暱稱匹配時才顯示其他欄位
        if (rowNickname === detail.nickname) {
          Logger.log('  找到相同暱稱的行 ' + (i+1) + ':');
          
          // 顯示原始值
          Logger.log('    - Sheet時間戳記原始值: ' + (typeof rowTimestamp) + ' = "' + rowTimestamp + '"');
          Logger.log('    - 前端時間戳記原始值: ' + (typeof detail.timestamp) + ' = "' + detail.timestamp + '"');
          
          // 顯示轉換後的日期（GMT+8）
          var testRowDate = '';
          var testDetailDate = '';
          
          if (rowTimestamp instanceof Date) {
            testRowDate = Utilities.formatDate(rowTimestamp, 'GMT+8', 'yyyy-MM-dd');
          } else if (rowTimestamp) {
            try {
              testRowDate = Utilities.formatDate(new Date(rowTimestamp), 'GMT+8', 'yyyy-MM-dd');
            } catch (e) {
              testRowDate = String(rowTimestamp).substring(0, 10);
            }
          }
          
          if (detail.timestamp instanceof Date) {
            testDetailDate = Utilities.formatDate(detail.timestamp, 'GMT+8', 'yyyy-MM-dd');
          } else if (detail.timestamp) {
            try {
              testDetailDate = Utilities.formatDate(new Date(detail.timestamp), 'GMT+8', 'yyyy-MM-dd');
            } catch (e) {
              var tsStr = String(detail.timestamp);
              testDetailDate = tsStr.indexOf('T') > -1 ? tsStr.split('T')[0] : tsStr.substring(0, 10);
            }
          }
          
          Logger.log('    - 轉換為GMT+8日期: "' + testRowDate + '" vs "' + testDetailDate + '" → ' + (testRowDate === testDetailDate));
          Logger.log('    - 品項: "' + rowItem + '" vs "' + detail.item + '" → ' + (rowItem === detail.item));
          Logger.log('    - 卡號: "' + rowCardNo + '" vs "' + detail.cardNo + '" → ' + (String(rowCardNo) === String(detail.cardNo)));
        }
        
        // 精確匹配：暱稱 + 時間戳記 + 品項 + 卡號
        var timestampMatch = false;
        
        // 統一轉換為 GMT+8 的 yyyy-MM-dd 格式比較
        var rowDateStr = '';
        var detailDateStr = '';
        
        // 處理 Sheet 中的時間戳記
        if (rowTimestamp instanceof Date) {
          rowDateStr = Utilities.formatDate(rowTimestamp, 'GMT+8', 'yyyy-MM-dd');
        } else if (rowTimestamp) {
          // 如果是字串，嘗試轉為 Date 再格式化
          try {
            var d = new Date(rowTimestamp);
            rowDateStr = Utilities.formatDate(d, 'GMT+8', 'yyyy-MM-dd');
          } catch (e) {
            rowDateStr = String(rowTimestamp).substring(0, 10);
          }
        }
        
        // 處理前端傳來的時間戳記（可能是 ISO 格式字串）
        if (detail.timestamp instanceof Date) {
          detailDateStr = Utilities.formatDate(detail.timestamp, 'GMT+8', 'yyyy-MM-dd');
        } else if (detail.timestamp) {
          // ISO 格式 "2025-12-22T16:43:48.716Z" 需要轉為 Date 對象再格式化為 GMT+8
          try {
            var detailDate = new Date(detail.timestamp);
            detailDateStr = Utilities.formatDate(detailDate, 'GMT+8', 'yyyy-MM-dd');
          } catch (e) {
            // 備用方案：直接取日期部分
            var tsStr = String(detail.timestamp);
            detailDateStr = tsStr.indexOf('T') > -1 ? tsStr.split('T')[0] : tsStr.substring(0, 10);
          }
        }
        
        timestampMatch = rowDateStr === detailDateStr;
        
        // 卡號比對：轉換為字串後比較（因為 Sheet 中可能是字串或數字）
        var cardNoMatch = String(rowCardNo) === String(detail.cardNo);
        
        if (rowNickname === detail.nickname &&
            timestampMatch &&
            rowItem === detail.item &&
            cardNoMatch) {
          
          var rowNum = i + 1;
          Logger.log('✅ 找到匹配訂單，行號: ' + rowNum);
          
          // 🔑 讀取原本的訂金,累加本次付款金額
          var currentDeposit = Number(data[i][depositIdx] || 0);
          var newDeposit = currentDeposit + Number(detail.balance || 0);
          
          if (depositIdx > -1 && detail.balance) {
            orderSheet.getRange(rowNum, depositIdx + 1).setValue(newDeposit);
            Logger.log('  - 訂金更新: ' + currentDeposit + ' + ' + detail.balance + ' = ' + newDeposit);
          }
          
          // 🔑 重新計算尾款 (總價 - 新訂金)
          if (balanceIdx > -1) {
            var totalPrice = Number(data[i][headers.indexOf('總價')] || 0);
            var newBalance = totalPrice - newDeposit;
            orderSheet.getRange(rowNum, balanceIdx + 1).setValue(newBalance);
            Logger.log('  - 尾款更新: ' + totalPrice + ' - ' + newDeposit + ' = ' + newBalance);
          }
          
          // 更新狀態
          if (statusIdx > -1) {
            orderSheet.getRange(rowNum, statusIdx + 1).setValue('已結清');
            Logger.log('  - 狀態設為 已結清');
          }
          
          // 更新付款方式
          if (paymentMethodIdx > -1) {
            orderSheet.getRange(rowNum, paymentMethodIdx + 1).setValue('綠界');
            Logger.log('  - 付款方式設為 綠界');
          }
          
          // 更新綠界訂單號
          if (ecpayNoIdx > -1 && tradeNo) {
            orderSheet.getRange(rowNum, ecpayNoIdx + 1).setValue(tradeNo);
            Logger.log('  - 綠界訂單號: ' + tradeNo);
          }
          
          // 更新付款時間
          if (paymentTimeIdx > -1) {
            orderSheet.getRange(rowNum, paymentTimeIdx + 1).setValue(now);
            Logger.log('  - 付款時間: ' + now);
          }
          
          updatedCount++;
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        Logger.log('❌ 找不到匹配的訂單: ' + detail.item + ' ' + detail.cardNo);
      }
    }
    
    // 🌟 強制寫入所有變更
    SpreadsheetApp.flush();
    
    Logger.log('✅ 訂單付款狀態更新完成');
    Logger.log('共更新 ' + updatedCount + ' 筆訂單（應為 ' + orderDetails.length + ' 筆）');
    
  } catch (e) {
    Logger.log('❌ 更新訂單付款狀態錯誤: ' + e);
    Logger.log('錯誤堆疊: ' + e.stack);
  }
}

/**
 * 更新團拆付款狀態（綠界付款成功後呼叫）
 * @param {Array} breakDetails - 團拆明細 [{nickname, breakId, breakName, balance}]
 * @param {string} paymentMethod - 付款方式
 * @param {string} tradeNo - 綠界交易編號
 */
function updateBreakPaymentStatus(breakDetails, paymentMethod, tradeNo) {
  try {
    Logger.log('========================================');
    Logger.log('🔍 updateBreakPaymentStatus 被呼叫');
    Logger.log('輸入參數 - breakDetails: ' + JSON.stringify(breakDetails));
    Logger.log('輸入參數 - paymentMethod: ' + paymentMethod);
    Logger.log('輸入參數 - tradeNo: ' + tradeNo);
    Logger.log('========================================');
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var breakSheet = ss.getSheetByName('團拆紀錄');
    
    if (!breakSheet) {
      Logger.log('找不到團拆紀錄');
      return;
    }
    
    if (!breakDetails || breakDetails.length === 0) {
      Logger.log('⚠️ 沒有團拆明細，無法更新');
      return;
    }
    
    var data = breakSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    Logger.log('========================================');
    Logger.log('團拆紀錄所有欄位: ' + JSON.stringify(headers));
    Logger.log('========================================');
    
    // 找到所有必要的欄位索引
    var nicknameIdx = headers.indexOf('訂購人');
    var breakIdIdx = headers.indexOf('團拆編號');
    var totalFeeIdx = headers.indexOf('總團費');
    var paidIdx = headers.indexOf('已付金額');
    var statusIdx = headers.indexOf('狀態');
    var paymentMethodIdx = headers.indexOf('付款方式');
    var ecpayNoIdx = headers.indexOf('綠界訂單號');
    var paymentTimeIdx = headers.indexOf('付款時間');
    
    Logger.log('欄位索引 - 訂購人:' + nicknameIdx + ', 團拆編號:' + breakIdIdx + ', 總團費:' + totalFeeIdx + ', 已付金額:' + paidIdx + ', 狀態:' + statusIdx);
    Logger.log('新欄位索引 - 付款方式:' + paymentMethodIdx + ', 綠界訂單號:' + ecpayNoIdx + ', 付款時間:' + paymentTimeIdx);
    
    if (nicknameIdx === -1 || breakIdIdx === -1) {
      Logger.log('❌ 找不到必要欄位！');
      return;
    }
    
    var now = new Date();
    var updatedCount = 0;
    
    Logger.log('開始更新團拆');
    Logger.log('要更新的團拆數量: ' + breakDetails.length);
    
    // 遍歷每筆團拆明細
    for (var j = 0; j < breakDetails.length; j++) {
      var detail = breakDetails[j];
      Logger.log('========================================');
      Logger.log('處理團拆 #' + (j+1) + ':');
      Logger.log('  尋找條件 - 暱稱: "' + detail.nickname + '"');
      Logger.log('  尋找條件 - 團拆編號: "' + detail.breakId + '"');
      Logger.log('  付款金額: ' + detail.balance);
      
      var matched = false;
      
      // 在 Sheet 中找到完全匹配的團拆
      for (var i = 1; i < data.length; i++) {
        var rowNickname = String(data[i][nicknameIdx] || '').trim();
        var rowBreakId = String(data[i][breakIdIdx] || '').trim();
        
        if (rowNickname === detail.nickname && rowBreakId === detail.breakId) {
          var rowNum = i + 1;
          Logger.log('✅ 找到匹配團拆，行號: ' + rowNum);
          
          // 讀取總團費
          var totalFee = totalFeeIdx > -1 ? Number(data[i][totalFeeIdx] || 0) : 0;
          
          // 更新已付金額（累加）
          var newPaid = 0;
          if (paidIdx > -1 && detail.balance) {
            var currentPaid = Number(data[i][paidIdx] || 0);
            newPaid = currentPaid + detail.balance;
            breakSheet.getRange(rowNum, paidIdx + 1).setValue(newPaid);
            Logger.log('  - 已付金額: ' + currentPaid + ' + ' + detail.balance + ' = ' + newPaid);
          } else {
            Logger.log('  ⚠️ 無法更新已付金額 - paidIdx: ' + paidIdx + ', balance: ' + detail.balance);
          }
          
          // 更新狀態（只有在已付金額 >= 總團費時才設為「已結清」）
          if (statusIdx > -1) {
            if (newPaid >= totalFee && totalFee > 0) {
              breakSheet.getRange(rowNum, statusIdx + 1).setValue('已結清');
              Logger.log('  - 狀態設為 已結清 (已付: ' + newPaid + ' >= 總費用: ' + totalFee + ')');
            } else {
              // 保持原狀態或設為付款確認中
              var currentStatus = String(data[i][statusIdx] || '').trim();
              if (!currentStatus || currentStatus === '付款確認中') {
                breakSheet.getRange(rowNum, statusIdx + 1).setValue('付款確認中');
                Logger.log('  - 狀態保持為 付款確認中 (已付: ' + newPaid + ' < 總費用: ' + totalFee + ')');
              } else {
                Logger.log('  - 狀態保持為 ' + currentStatus);
              }
            }
          }
          
          // 更新付款方式
          if (paymentMethodIdx > -1) {
            breakSheet.getRange(rowNum, paymentMethodIdx + 1).setValue('綠界');
            Logger.log('  - 付款方式設為 綠界');
          }
          
          // 更新綠界訂單號
          if (ecpayNoIdx > -1 && tradeNo) {
            breakSheet.getRange(rowNum, ecpayNoIdx + 1).setValue(tradeNo);
            Logger.log('  - 綠界訂單號: ' + tradeNo);
          }
          
          // 更新付款時間
          if (paymentTimeIdx > -1) {
            breakSheet.getRange(rowNum, paymentTimeIdx + 1).setValue(now);
            Logger.log('  - 付款時間: ' + now);
          }
          
          updatedCount++;
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        Logger.log('❌ 找不到匹配的團拆: ' + detail.breakId);
      }
    }
    
    // 🌟 強制寫入所有變更
    SpreadsheetApp.flush();
    
    Logger.log('✅ 團拆付款狀態更新完成');
    Logger.log('共更新 ' + updatedCount + ' 筆團拆（應為 ' + breakDetails.length + ' 筆）');
    
  } catch (e) {
    Logger.log('❌ 更新團拆付款狀態錯誤: ' + e);
    Logger.log('錯誤堆疊: ' + e.stack);
  }
}

/**
 * 測試函數：手動測試最新的付款記錄並更新訂單
 * 使用方法：在 GAS 編輯器中選擇此函數並執行
 */
function testLatestPaymentUpdate() {
  try {
    Logger.log('========== 開始測試最新付款記錄 ==========');
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var paymentSheet = ss.getSheetByName('綠界付款記錄');
    
    if (!paymentSheet) {
      Logger.log('❌ 找不到「綠界付款記錄」表');
      return;
    }
    
    var data = paymentSheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('❌ 沒有付款記錄');
      return;
    }
    
    // 取最後一筆記錄
    var lastRow = data[data.length - 1];
    var headers = data[0];
    
    var merchantTradeNo = lastRow[0];
    var status = lastRow[headers.indexOf('狀態')];
    
    Logger.log('最新付款記錄: ' + merchantTradeNo);
    Logger.log('狀態: ' + status);
    
    // 讀取 orderDetails
    var orderDetails = getOrderDetailsFromPaymentRecord(merchantTradeNo);
    Logger.log('訂單明細數量: ' + orderDetails.length);
    Logger.log('訂單明細內容: ' + JSON.stringify(orderDetails));
    
    if (orderDetails.length === 0) {
      Logger.log('❌ 沒有訂單明細，無法測試');
      return;
    }
    
    // 執行更新
    Logger.log('========== 開始更新訂單 ==========');
    updateOrderPaymentStatus(orderDetails, '綠界測試', 'TEST123');
    
    Logger.log('========== 測試完成 ==========');
    
  } catch (e) {
    Logger.log('❌ 測試錯誤: ' + e);
    Logger.log('錯誤堆疊: ' + e.stack);
  }
}

/**
 * 🔧 修復綠界付款記錄表格 - 新增「付款類型」欄位
 * 使用方法：在 GAS 編輯器中執行此函數一次即可
 */
function fixPaymentRecordAddPaymentType() {
  try {
    Logger.log('========================================');
    Logger.log('🔧 修復綠界付款記錄表格');
    Logger.log('========================================');
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('綠界付款記錄');
    
    if (!sheet) {
      Logger.log('❌ 找不到「綠界付款記錄」表');
      return;
    }
    
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    Logger.log('📋 目前欄位數: ' + lastCol);
    Logger.log('📋 目前欄位: ' + JSON.stringify(headers));
    Logger.log('');
    
    // 檢查第 14 欄是否為空或沒有「付款類型」
    var paymentTypeIdx = headers.indexOf('付款類型');
    
    if (paymentTypeIdx === -1) {
      // 找不到「付款類型」欄位
      if (lastCol >= 14 && !headers[13]) {
        // 第 14 欄存在但標題為空
        Logger.log('⚠️ 第 14 欄標題為空，正在設定為「付款類型」...');
        sheet.getRange(1, 14)
          .setValue('付款類型')
          .setBackground('#0b3a5e')
          .setFontColor('#ffffff')
          .setFontWeight('bold')
          .setHorizontalAlignment('center');
        Logger.log('✅ 已將第 14 欄設定為「付款類型」');
      } else {
        // 需要新增欄位
        Logger.log('⚠️ 缺少「付款類型」欄位，正在新增到第 14 欄...');
        sheet.getRange(1, 14)
          .setValue('付款類型')
          .setBackground('#0b3a5e')
          .setFontColor('#ffffff')
          .setFontWeight('bold')
          .setHorizontalAlignment('center');
        Logger.log('✅ 已新增「付款類型」欄位到第 14 欄');
      }
    } else {
      Logger.log('✅ 「付款類型」欄位已存在於第 ' + (paymentTypeIdx + 1) + ' 欄');
    }
    
    // 重新讀取並顯示結果
    var newHeaders = sheet.getRange(1, 1, 1, 14).getValues()[0];
    Logger.log('');
    Logger.log('📋 更新後的欄位: ' + JSON.stringify(newHeaders));
    Logger.log('');
    Logger.log('========================================');
    Logger.log('✅ 修復完成！');
    Logger.log('========================================');
    
  } catch (e) {
    Logger.log('❌ 修復錯誤: ' + e);
    Logger.log('錯誤堆疊: ' + e.stack);
  }
}

/**
 * 修復綠界付款記錄表格結構
 * 確保有「訂單明細」欄位
 */
function fixPaymentTableStructure() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('綠界付款記錄');
    
    if (!sheet) {
      Logger.log('❌ 找不到「綠界付款記錄」表');
      return;
    }
    
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    Logger.log('現有欄位數: ' + lastCol);
    Logger.log('現有欄位: ' + headers.join(', '));
    
    // 檢查第13欄是否為空
    if (lastCol >= 13 && !headers[12]) {
      Logger.log('⚠️ 第13欄為空，正在設定為「訂單明細」...');
      sheet.getRange(1, 13)
        .setValue('訂單明細')
        .setBackground('#0b3a5e')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      Logger.log('✅ 已將第13欄設定為「訂單明細」');
    } else if (headers.indexOf('訂單明細') === -1) {
      Logger.log('⚠️ 缺少「訂單明細」欄位，正在新增...');
      sheet.getRange(1, lastCol + 1)
        .setValue('訂單明細')
        .setBackground('#0b3a5e')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      Logger.log('✅ 已新增「訂單明細」欄位');
    } else {
      Logger.log('✅ 「訂單明細」欄位已存在於第 ' + (headers.indexOf('訂單明細') + 1) + ' 欄');
    }
    
    // 顯示最終欄位
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    Logger.log('更新後欄位: ' + headers.join(', '));
    
  } catch (e) {
    Logger.log('❌ 修復表格錯誤: ' + e);
  }
}

/**
 * 檢查最近付款記錄的時間差
 */
function checkPaymentTimeDifference() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('綠界付款記錄');
    
    if (!sheet) {
      Logger.log('找不到綠界付款記錄表');
      return;
    }
    
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log('沒有付款記錄');
      return;
    }
    
    // 讀取最新 3 筆記錄
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var startRow = Math.max(2, lastRow - 2);
    var data = sheet.getRange(startRow, 1, lastRow - startRow + 1, sheet.getLastColumn()).getValues();
    
    var createTimeIdx = headers.indexOf('建立時間');
    var paymentTimeIdx = headers.indexOf('付款時間');
    var updateTimeIdx = headers.indexOf('更新時間');
    var statusIdx = headers.indexOf('狀態');
    var orderNoIdx = headers.indexOf('付款單號');
    
    Logger.log('===== 最近 ' + data.length + ' 筆付款記錄的時間分析 =====');
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var orderNo = row[orderNoIdx];
      var status = row[statusIdx];
      var createTime = row[createTimeIdx];
      var paymentTime = row[paymentTimeIdx];
      var updateTime = row[updateTimeIdx];
      
      Logger.log('\n訂單: ' + orderNo + ' (狀態: ' + status + ')');
      Logger.log('  建立時間: ' + createTime);
      Logger.log('  付款時間: ' + paymentTime);
      Logger.log('  更新時間: ' + updateTime);
      
      if (paymentTime && updateTime) {
        var paymentDate = new Date(paymentTime);
        var updateDate = new Date(updateTime);
        var diffSeconds = Math.round((updateDate - paymentDate) / 1000);
        
        Logger.log('  ⏱️  付款→更新延遲: ' + diffSeconds + ' 秒');
        
        if (diffSeconds > 60) {
          Logger.log('  ⚠️  延遲超過 1 分鐘!');
        }
      }
    }
    
  } catch (e) {
    Logger.log('檢查時間差錯誤: ' + e);
  }
}

/**
 * 🔍 檢查團拆記錄資料
 * 顯示指定訂購人的所有團拆資料，包含已付金額等詳細資訊
 * 使用方法：修改下方的 targetNickname 變數，然後在 GAS 編輯器中執行此函數
 */
function checkBreakRecords() {
  try {
    // ⚠️ 請修改這裡的暱稱來查詢不同使用者的團拆資料
    var targetNickname = 'Ning';  // 👈 改成要查詢的暱稱
    
    Logger.log('========================================');
    Logger.log('🔍 檢查團拆記錄 - 訂購人: ' + targetNickname);
    Logger.log('========================================');
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var breakSheet = ss.getSheetByName('團拆紀錄');
    
    if (!breakSheet) {
      Logger.log('❌ 找不到「團拆紀錄」表');
      return;
    }
    
    var data = breakSheet.getDataRange().getValues();
    var headers = data[0].map(function(h) { return String(h).trim(); });
    
    Logger.log('📋 所有欄位: ' + JSON.stringify(headers));
    Logger.log('');
    
    // 找到欄位索引
    var nicknameIdx = headers.indexOf('訂購人');
    var breakIdIdx = headers.indexOf('團拆編號');
    var nameIdx = headers.indexOf('團名');
    var totalFeeIdx = headers.indexOf('總團費');
    var paidIdx = headers.indexOf('已付金額');
    var statusIdx = headers.indexOf('狀態');
    var paymentMethodIdx = headers.indexOf('付款方式');
    var ecpayNoIdx = headers.indexOf('綠界訂單號');
    var paymentTimeIdx = headers.indexOf('付款時間');
    
    Logger.log('📊 欄位索引對照:');
    Logger.log('  訂購人: ' + nicknameIdx);
    Logger.log('  團拆編號: ' + breakIdIdx);
    Logger.log('  團名: ' + nameIdx);
    Logger.log('  總團費: ' + totalFeeIdx);
    Logger.log('  已付金額: ' + paidIdx);
    Logger.log('  狀態: ' + statusIdx);
    Logger.log('  付款方式: ' + paymentMethodIdx);
    Logger.log('  綠界訂單號: ' + ecpayNoIdx);
    Logger.log('  付款時間: ' + paymentTimeIdx);
    Logger.log('');
    
    if (nicknameIdx === -1) {
      Logger.log('❌ 找不到「訂購人」欄位');
      return;
    }
    
    // 查找該訂購人的所有團拆
    var foundCount = 0;
    Logger.log('🔎 查詢結果:');
    Logger.log('========================================');
    
    for (var i = 1; i < data.length; i++) {
      var rowNickname = String(data[i][nicknameIdx] || '').trim();
      
      if (rowNickname === targetNickname) {
        foundCount++;
        var breakId = breakIdIdx > -1 ? data[i][breakIdIdx] : '';
        var name = nameIdx > -1 ? data[i][nameIdx] : '';
        var totalFee = totalFeeIdx > -1 ? Number(data[i][totalFeeIdx] || 0) : 0;
        var paid = paidIdx > -1 ? Number(data[i][paidIdx] || 0) : 0;
        var balance = totalFee - paid;
        var status = statusIdx > -1 ? data[i][statusIdx] : '';
        var paymentMethod = paymentMethodIdx > -1 ? data[i][paymentMethodIdx] : '';
        var ecpayNo = ecpayNoIdx > -1 ? data[i][ecpayNoIdx] : '';
        var paymentTime = paymentTimeIdx > -1 ? data[i][paymentTimeIdx] : '';
        
        Logger.log('\n📦 團拆 #' + foundCount + ' (行號: ' + (i + 1) + ')');
        Logger.log('  團拆編號: ' + breakId);
        Logger.log('  團名: ' + name);
        Logger.log('  總團費: NT$ ' + totalFee.toLocaleString());
        Logger.log('  已付金額: NT$ ' + paid.toLocaleString() + (paidIdx === -1 ? ' ⚠️ 欄位不存在' : ''));
        Logger.log('  尾款: NT$ ' + balance.toLocaleString());
        Logger.log('  狀態: ' + status);
        Logger.log('  付款方式: ' + paymentMethod);
        Logger.log('  綠界訂單號: ' + ecpayNo);
        Logger.log('  付款時間: ' + paymentTime);
      }
    }
    
    Logger.log('');
    Logger.log('========================================');
    Logger.log('✅ 總共找到 ' + foundCount + ' 筆團拆記錄');
    Logger.log('========================================');
    
  } catch (e) {
    Logger.log('❌ 檢查團拆記錄錯誤: ' + e);
    Logger.log('錯誤堆疊: ' + e.stack);
  }
}

/**
 * 🧪 測試團拆付款更新功能
 * 模擬團拆付款成功後的更新流程
 * 使用方法：修改下方的測試資料，然後在 GAS 編輯器中執行此函數
 */
function testBreakPaymentUpdate() {
  try {
    Logger.log('========================================');
    Logger.log('🧪 測試團拆付款更新功能');
    Logger.log('========================================');
    
    // ⚠️ 請修改這裡的測試資料
    var testBreakDetails = [
      {
        nickname: 'Ning',           // 👈 改成實際的暱稱
        breakId: 'Ning-020',        // 👈 改成實際的團拆編號（使用實際存在的編號）
        breakName: '2024 bowman draft hobby jumbo *1 + 2025 bowman hobby box*1 mixer',
        balance: 500                // 👈 改成要支付的金額（部分付款測試）
      }
    ];
    
    var testPaymentMethod = '綠界';
    var testTradeNo = 'TEST' + new Date().getTime();
    
    Logger.log('📝 測試參數:');
    Logger.log('  團拆明細: ' + JSON.stringify(testBreakDetails));
    Logger.log('  付款方式: ' + testPaymentMethod);
    Logger.log('  交易編號: ' + testTradeNo);
    Logger.log('');
    
    // 先檢查更新前的狀態
    Logger.log('📊 更新前的狀態:');
    checkBreakRecords();
    Logger.log('');
    
    // 執行更新
    Logger.log('🔄 開始執行更新...');
    Logger.log('========================================');
    updateBreakPaymentStatus(testBreakDetails, testPaymentMethod, testTradeNo);
    Logger.log('========================================');
    Logger.log('');
    
    // 檢查更新後的狀態
    Logger.log('📊 更新後的狀態:');
    checkBreakRecords();
    
    Logger.log('');
    Logger.log('✅ 測試完成');
    
  } catch (e) {
    Logger.log('❌ 測試錯誤: ' + e);
    Logger.log('錯誤堆疊: ' + e.stack);
  }
}

/**
 * 🔍 檢查最新的綠界付款記錄
 * 顯示最新一筆付款記錄的完整資訊，包括訂單明細
 */
function checkLatestPaymentRecord() {
  try {
    Logger.log('========================================');
    Logger.log('🔍 檢查最新的綠界付款記錄');
    Logger.log('========================================');
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var paymentSheet = ss.getSheetByName('綠界付款記錄');
    
    if (!paymentSheet) {
      Logger.log('❌ 找不到「綠界付款記錄」表');
      return;
    }
    
    var data = paymentSheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('❌ 沒有付款記錄');
      return;
    }
    
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var lastRow = data[data.length - 1];
    
    Logger.log('📋 所有欄位: ' + JSON.stringify(headers));
    Logger.log('');
    
    // 找到欄位索引
    var merchantTradeNoIdx = 0;
    var nicknameIdx = headers.indexOf('暱稱');
    var orderSummaryIdx = headers.indexOf('商品摘要');
    var amountIdx = headers.indexOf('金額');
    var statusIdx = headers.indexOf('狀態');
    var createTimeIdx = headers.indexOf('建立時間');
    var paymentTimeIdx = headers.indexOf('付款時間');
    var orderDetailsIdx = headers.indexOf('訂單明細');
    var paymentTypeIdx = headers.indexOf('付款類型');
    
    Logger.log('📊 最新付款記錄 (第 ' + data.length + ' 列):');
    Logger.log('  付款單號: ' + lastRow[merchantTradeNoIdx]);
    Logger.log('  暱稱: ' + (nicknameIdx > -1 ? lastRow[nicknameIdx] : 'N/A'));
    Logger.log('  商品摘要: ' + (orderSummaryIdx > -1 ? lastRow[orderSummaryIdx] : 'N/A'));
    Logger.log('  金額: NT$ ' + (amountIdx > -1 ? Number(lastRow[amountIdx]).toLocaleString() : 'N/A'));
    Logger.log('  狀態: ' + (statusIdx > -1 ? lastRow[statusIdx] : 'N/A'));
    Logger.log('  建立時間: ' + (createTimeIdx > -1 ? lastRow[createTimeIdx] : 'N/A'));
    Logger.log('  付款時間: ' + (paymentTimeIdx > -1 ? lastRow[paymentTimeIdx] : 'N/A'));
    Logger.log('  付款類型: ' + (paymentTypeIdx > -1 ? lastRow[paymentTypeIdx] : 'N/A'));
    Logger.log('');
    
    // 解析訂單明細
    if (orderDetailsIdx > -1) {
      var orderDetailsJson = lastRow[orderDetailsIdx];
      Logger.log('📦 訂單明細 JSON:');
      Logger.log(orderDetailsJson);
      Logger.log('');
      
      if (orderDetailsJson) {
        try {
          var orderDetails = JSON.parse(orderDetailsJson);
          Logger.log('📦 訂單明細解析結果:');
          Logger.log('  項目數量: ' + orderDetails.length);
          Logger.log('');
          
          for (var i = 0; i < orderDetails.length; i++) {
            Logger.log('  項目 #' + (i + 1) + ':');
            Logger.log('    ' + JSON.stringify(orderDetails[i], null, 2));
          }
        } catch (e) {
          Logger.log('❌ 解析訂單明細失敗: ' + e);
        }
      } else {
        Logger.log('⚠️ 訂單明細為空');
      }
    } else {
      Logger.log('❌ 找不到「訂單明細」欄位 (索引: ' + orderDetailsIdx + ')');
    }
    
    Logger.log('');
    Logger.log('========================================');
    
  } catch (e) {
    Logger.log('❌ 檢查付款記錄錯誤: ' + e);
    Logger.log('錯誤堆疊: ' + e.stack);
  }
}

/**
 * 🗄️ 自動備份試算表
 * 將當前試算表複製到指定的 Google Drive 資料夾
 * 建議設定觸發器：每天執行一次
 * 
 * 使用方式：
 * 1. 在 GAS 編輯器中設定觸發器
 * 2. 選擇 autoBackupSheet 函數
 * 3. 時間型觸發器 → 每日定時器 → 選擇時間（例如：凌晨 2-3 點）
 */
function autoBackupSheet() {
  // 👇👇👇 請在這裡填入您想要存放備份的 Google Drive 資料夾 ID 👇👇👇
  // (如果不填，備份檔會直接出現在您的「我的雲端硬碟」根目錄)
  const BACKUP_FOLDER_ID = "1ZQttmfG9wj9sREUyWAseEX0UrMB3SeIS"; 
  
  try {
    const ss = SpreadsheetManager.openSpreadsheet();
    const originalFile = DriveApp.getFileById(ss.getId());
    const fileName = ss.getName() + "_Backup_" + Utilities.formatDate(new Date(), "GMT+8", "yyyyMMdd_HHmm");
    
    let backupFile;
    
    if (BACKUP_FOLDER_ID) {
      const folder = DriveApp.getFolderById(BACKUP_FOLDER_ID);
      backupFile = originalFile.makeCopy(fileName, folder);
    } else {
      backupFile = originalFile.makeCopy(fileName);
    }
    
    Logger.log("✅ 備份成功: " + backupFile.getUrl());
    console.log("✅ 備份成功: " + backupFile.getUrl());
    
  } catch (e) {
    Logger.log("❌ 備份失敗: " + e.toString());
    console.error("❌ 備份失敗: " + e.toString());
    // 如果備份失敗，寄信通知管理員
    MailApp.sendEmail("ningscard@gmail.com", "系統備份失敗通知", "錯誤原因: " + e.toString());
  }
}

// ===== 每日抽籤功能 =====
function checkDailyFortune(phone) {
  try {
    if (!phone) {
      Logger.log('❌ checkDailyFortune: 缺少手機號碼');
      return { success: false, message: '缺少手機號碼' };
    }
    
    // 🔑 確保電話號碼為字串格式
    const phoneStr = String(phone).trim();
    Logger.log('📱 checkDailyFortune: 檢查電話 ' + phoneStr);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let fortuneSheet = ss.getSheetByName('每日抽籤紀錄');
    
    // 如果工作表不存在,建立它
    if (!fortuneSheet) {
      Logger.log('📄 建立新的「每日抽籤紀錄」工作表');
      fortuneSheet = ss.insertSheet('每日抽籤紀錄');
      fortuneSheet.getRange('A1:E1').setValues([['手機號碼', '暱稱', '抽籤日期', '抽籤時間', '運勢結果']]);
      fortuneSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#4a90e2').setFontColor('#ffffff');
      // 🔑 設定第一欄為文字格式
      fortuneSheet.getRange('A:A').setNumberFormat('@');
    }
    
    const data = fortuneSheet.getDataRange().getValues();
    const today = Utilities.formatDate(new Date(), 'GMT+8', 'yyyy-MM-dd');
    Logger.log('📅 今天日期: ' + today);
    Logger.log('📋 紀錄總數: ' + (data.length - 1));
    
    // 檢查今天是否已抽過
    for (let i = 1; i < data.length; i++) {
      const rowPhone = String(data[i][0] || '').trim();
      const rowDate = String(data[i][2] || '').trim();
      
      Logger.log('  行' + i + ': 電話=' + rowPhone + ', 日期=' + rowDate);
      
      if (rowPhone === phoneStr && rowDate === today) {
        Logger.log('🚫 找到重複記錄! 電話: ' + phoneStr + ', 日期: ' + today);
        return { 
          success: true, 
          canDraw: false, 
          message: '今天已經抽過了,明天再來！',
          lastResult: data[i][4] || ''
        };
      }
    }
    
    Logger.log('✅ 今天尚未抽過,可以抽籤');
    return { success: true, canDraw: true, message: '可以抽籤' };
    
  } catch (e) {
    Logger.log('❌ checkDailyFortune 錯誤: ' + e.toString());
    return { success: false, message: '檢查失敗: ' + e.toString() };
  }
}

function saveDailyFortune(phone, nickname, result) {
  try {
    if (!phone || !result) {
      Logger.log('❌ saveDailyFortune: 缺少必要參數');
      return { success: false, message: '缺少必要參數' };
    }
    
    // 🔑 確保電話號碼為字串格式(保留開頭的0)
    const phoneStr = String(phone).trim();
    Logger.log('💾 saveDailyFortune: 儲存電話 ' + phoneStr);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let fortuneSheet = ss.getSheetByName('每日抽籤紀錄');
    
    if (!fortuneSheet) {
      Logger.log('📄 建立新的「每日抽籤紀錄」工作表');
      fortuneSheet = ss.insertSheet('每日抽籤紀錄');
      fortuneSheet.getRange('A1:E1').setValues([['手機號碼', '暱稱', '抽籤日期', '抽籤時間', '運勢結果']]);
      fortuneSheet.getRange('A1:E1').setFontWeight('bold').setBackground('#4a90e2').setFontColor('#ffffff');
    }
    
    // 🔑 強制設定第一欄為文字格式(每次都設定,確保生效)
    fortuneSheet.getRange('A:A').setNumberFormat('@');
    
    const now = new Date();
    const date = Utilities.formatDate(now, 'GMT+8', 'yyyy-MM-dd');
    const time = Utilities.formatDate(now, 'GMT+8', 'HH:mm:ss');
    
    // 🔑 找到下一個空白列
    const lastRow = fortuneSheet.getLastRow();
    const nextRow = lastRow + 1;
    
    // 🔑 使用 setValues 而非 appendRow,並在設定值之前先設定格式
    const targetRange = fortuneSheet.getRange(nextRow, 1, 1, 5);
    targetRange.setNumberFormats([['@', '@', '@', '@', '@']]); // 全部設為文字格式
    targetRange.setValues([[phoneStr, nickname || '', date, time, result]]);
    
    Logger.log('✅ 儲存成功: 行' + nextRow + ', 電話=' + phoneStr + ', 結果=' + result);
    
    return { success: true, message: '抽籤紀錄已儲存' };
    
  } catch (e) {
    Logger.log('saveDailyFortune 錯誤: ' + e.toString());
    return { success: false, message: '儲存失敗: ' + e.toString() };
  }
}