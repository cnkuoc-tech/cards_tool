// ==================== 後端 API 處理 ====================

class SupabaseClient {
  constructor(url, apiKey) {
    this.url = url;
    this.apiKey = apiKey;
  }
  
  async query(table, options = {}) {
    const { select = '*', eq = {}, or = null, order = null, range = null, count = false } = options;
    let queryUrl = `${this.url}/rest/v1/${table}?select=${select}`;
    for (const [key, value] of Object.entries(eq)) {
      queryUrl += `&${key}=eq.${encodeURIComponent(value)}`;
    }
    if (or) queryUrl += `&or=(${or})`;
    if (order) queryUrl += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`;
    if (range) queryUrl += `&limit=${range[1] - range[0] + 1}&offset=${range[0]}`;
    const headers = {
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': count ? 'count=exact' : ''
    };
    const response = await fetch(queryUrl, { headers });
    return await response.json();
  }
  
  async insert(table, data) {
    const response = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': this.apiKey,
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
    return await response.json();
  }
  
  // 🌟 查詢所有資料（無限制），用於累積張數計算等
  async queryAll(table, options = {}) {
    const { select = '*', eq = {}, order = null } = options;

    const buildUrl = (selectValue, limit, offset) => {
      let queryUrl = `${this.url}/rest/v1/${table}?select=${selectValue}`;
      for (const [key, value] of Object.entries(eq)) {
        queryUrl += `&${key}=eq.${encodeURIComponent(value)}`;
      }
      if (order) queryUrl += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`;
      if (limit != null) queryUrl += `&limit=${limit}`;
      if (offset != null) queryUrl += `&offset=${offset}`;
      return queryUrl;
    };

    const headers = {
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'count=exact'
    };

    const pageSize = 1000;
    let offset = 0;
    let total = null;
    const allRows = [];

    while (true) {
      let response = await fetch(buildUrl(select, pageSize, offset), { headers });

      if (!response.ok && response.status === 400) {
        const errorText = await response.text();
        console.error('[queryAll] Bad Request:', errorText);
        const fallbackSelect = select !== '*' ? '*' : 'item,card_no,quantity';
        response = await fetch(buildUrl(fallbackSelect, pageSize, offset), { headers });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[queryAll] Error:', response.status, errorText);
        throw new Error(`Supabase queryAll failed: ${response.statusText}`);
      }

      const contentRange = response.headers.get('Content-Range');
      if (contentRange) {
        console.log('[queryAll] Content-Range:', contentRange);
        const totalMatch = contentRange.match(/\/(\d+)$/);
        if (totalMatch) total = parseInt(totalMatch[1], 10);
      }

      const rows = await response.json();
      if (Array.isArray(rows) && rows.length > 0) {
        allRows.push(...rows);
      }

      if (!Array.isArray(rows) || rows.length < pageSize) break;
      if (total != null && allRows.length >= total) break;

      offset += pageSize;
    }

    return allRows;
  }
}

function parseBoolValue(value) {
  if (value === true || value === false) return value;
  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === 'y' || text === 'yes' || text === '1' || text === '是';
}

// ==================== Supabase 預設設定 (測試用) ====================
const DEFAULT_SUPABASE_URL = 'https://hmqwcpstzkxfwabasqgx.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcXdjcHN0emt4ZndhYmFzcWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MTM1OTgsImV4cCI6MjA4NDk4OTU5OH0.UJWsWXL-1_L6cGsmoBVSlsYlEEGMSp1F_wyXAc1hB8E';

// ==================== 💳 綠界金流設定 (測試環境) ====================
const ECPAY_CONFIG = {
  MerchantID: '3002607',                 // 測試環境特店編號
  HashKey: 'pwFHCqoQZGmho4w6',           // 測試環境 HashKey
  HashIV: 'EkRm7iFT261dpevs',            // 測試環境 HashIV
  PaymentURL: 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
  QueryURL: 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5',
  ChoosePayment: 'Credit',               // 只開放信用卡付款
  EncryptType: 1
};

// ==================== 資料正規化工具 ====================
function normalizeText(value) {
  return String(value || '')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normalizeCardNo(value) {
  const text = normalizeText(value);
  if (!text) return '';
  if (/^\d+$/.test(text)) {
    return String(parseInt(text, 10));
  }
  const match = text.match(/\d+/);
  if (match && match[0]) {
    return String(parseInt(match[0], 10));
  }
  return text;
}

function buildKey(item, cardNo) {
  const itemKey = normalizeText(item);
  const cardKey = normalizeCardNo(cardNo);
  return itemKey + '||' + cardKey;
}

function buildItemKey(item) {
  return normalizeText(item);
}

async function fetchAllOrdersForAccumulation(supabase) {
  const sources = [
    { table: 'orders', select: 'item,card_no,quantity' }
  ];

  for (const source of sources) {
    try {
      const rows = await supabase.queryAll(source.table, { select: source.select });
      if (Array.isArray(rows) && rows.length > 0) {
        console.log('[ACCUM] 使用訂單來源:', source.table, '筆數:', rows.length);
        return { table: source.table, rows };
      }
      if (Array.isArray(rows)) {
        console.log('[ACCUM] 訂單來源無資料:', source.table);
      }
    } catch (error) {
      console.error('[ACCUM] 讀取訂單來源失敗:', source.table, error);
    }
  }

  return { table: null, rows: [] };
}

async function handleAPI(request, env) {
  try {
    const body = await request.json();
    const { action } = body;
    
    // 📊 記錄所有 action
    console.log('[API] 收到 action:', action);
    if (action === 'createEcpayPayment') {
      console.log('[API] ⭐ createEcpayPayment 已偵測！參數:', {
        phone: body.phone,
        totalAmount: body.totalAmount,
        itemName: body.itemName
      });
    }
    
    const supabaseUrl = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const supabaseKey = env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        message: '缺少 SUPABASE_URL 或 SUPABASE_ANON_KEY 環境變數'
      };
    }

    const supabase = new SupabaseClient(supabaseUrl, supabaseKey);
    
    let result;
    switch (action) {
      case 'login': result = await handleLogin(body, supabase); break;
      case 'registerUser': result = await handleRegisterUser(body, supabase); break;
      case 'getOrderCatalog':
      case 'getProducts': result = await handleGetProducts(body, supabase); break;
      case 'getOrderInfo': result = await handleGetOrderInfo(body, supabase); break;
      case 'addOrderEntriesToMain': result = await handleAddOrder(body, supabase); break;
      case 'getPendingPaymentKeys': result = await handleGetPendingPaymentKeys(body, supabase); break;
      case 'notifyPaymentBulk': result = await handleNotifyPaymentBulk(body, supabase); break;
      case 'submitPaymentNotification': result = await handlePaymentNotification(body, supabase); break;
      case 'notifyProfileUpdate': result = await handleNotifyProfileUpdate(body, supabase); break;
      case 'lookupOrderStatus': result = await handleLookupOrderStatus(body, supabase); break;
      case 'getBreakCredit': result = await handleGetBreakCredit(body, supabase); break;
      case 'useBreakCredit': result = await handleUseBreakCredit(body, supabase); break;
      case 'submitPsaOrder': result = await handleSubmitPsaOrder(body, supabase); break;
      case 'lookupPsaOrders': result = await handleLookupPsaOrders(body, supabase); break;
      case 'checkDailyFortune': result = await handleCheckDailyFortune(body, supabase); break;
      case 'saveDailyFortune': result = await handleSaveDailyFortune(body, supabase); break;
      case 'createShipmentRecord': result = await handleCreateShipmentRecord(body, supabase); break;
      case 'getShipmentRecords': result = await handleGetShipmentRecords(body, supabase); break;
      case 'createEcpayPayment': result = await handleCreateEcpayPayment(body, supabase); break;
      case 'checkPaymentStatus': result = await handleCheckPaymentStatus(body, supabase); break;
      case 'updateOrderStatusToPending': result = await handleUpdateOrderStatusToPending(body, supabase); break;
      case 'updateBreakStatusToPending': result = await handleUpdateBreakStatusToPending(body, supabase); break;
      case 'updateOrderStatusToFailed': result = await handleUpdateOrderStatusToFailed(body, supabase); break;
      case 'verifyData': result = await handleVerifyData(body, supabase); break;
      case 'debugAccum': result = await handleDebugAccum(body, supabase); break;
      // 🌟 後台管理 API
      case 'adminLogin': result = await handleAdminLogin(body, supabase); break;
      case 'getNotifications': result = await handleGetNotifications(body, supabase); break;
      case 'updateNotification': result = await handleUpdateNotification(body, supabase); break;
      case 'deleteNotification': result = await handleDeleteNotification(body, supabase); break;
      case 'searchOrders': result = await handleSearchOrders(body, supabase); break;
      case 'updateOrder': result = await handleUpdateOrder(body, supabase); break;
      case 'getAllBreaks': result = await handleGetAllBreaks(body, supabase); break;
      case 'updateBreak': result = await handleUpdateBreak(body, supabase); break;
      case 'getUsers': result = await handleGetUsers(body, supabase); break;
      case 'searchUsers': result = await handleSearchUsers(body, supabase); break;
      case 'updateUser': result = await handleUpdateUser(body, supabase); break;
      case 'addProduct': result = await handleAddProduct(body, supabase); break;
      case 'cleanupDuplicateUsers': result = await handleCleanupDuplicateUsers(body, supabase); break;
      default: result = { success: false, message: `未知的 action: ${action}` };
    }
    
    return new Response(JSON.stringify(result), {
      status: 200,  // 總是返回 200，由 result.success 決定邏輯成功或失敗
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    console.error('[API] 處理 action 時發生錯誤:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: error.message || '伺服器內部錯誤'
    }), {
      status: 200,  // 即使出錯也返回 200，讓前端能讀到錯誤訊息
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleDebugAccum(body, supabase) {
  const { item, cardNo } = body;
  if (!item) {
    return { success: false, message: '缺少 item' };
  }

  const { table, rows } = await fetchAllOrdersForAccumulation(supabase);
  const targetKey = buildKey(item, cardNo);
  const targetItemKey = buildItemKey(item);

  let accumulated = 0;
  let matchedRows = 0;
  const sampleRows = [];
  const sampleMatches = [];

  if (Array.isArray(rows)) {
    rows.forEach(order => {
      const orderItem = order.item || order.item_name || order.product_name || '';
      const orderCard = order.card_no || order.cardno || '';
      const key = buildKey(orderItem, orderCard);
      const itemKey = buildItemKey(orderItem);
      const qty = parseInt(order.quantity) || 0;

      if (qty <= 0) return;

      if (sampleRows.length < 3) {
        sampleRows.push({ item: orderItem, cardNo: orderCard, quantity: qty, key });
      }

      if (key === targetKey || itemKey === targetItemKey) {
        accumulated += qty;
        matchedRows += 1;
        if (sampleMatches.length < 3) {
          sampleMatches.push({ item: orderItem, cardNo: orderCard, quantity: qty, key });
        }
      }
    });
  }

  return {
    success: true,
    table: table || 'none',
    targetKey,
    targetItemKey,
    totalRows: Array.isArray(rows) ? rows.length : 0,
    accumulated,
    matchedRows,
    sampleRows,
    sampleMatches
  };
}

async function handleLogin(body, supabase) {
  const { phone, birthday } = body;
  console.log('[LOGIN] Attempt: phone=' + phone + ', birthday=' + birthday);
  
  const users = await supabase.query('users', { eq: { phone } });
  console.log('[LOGIN] Users query result:', JSON.stringify(users));
  
  if (!Array.isArray(users) || users.length === 0) {
    console.log('[LOGIN] ERROR: Phone not found: ' + phone);
    return { success: false, message: '電話號碼未註冊' };
  }
  
  const user = users[0];
  console.log('[LOGIN] User found:', JSON.stringify(user));
  
  // 詳細的字元分析
  const userBirthday = String(user.birthday || '').trim();
  const inputBirthday = String(birthday || '').trim();
  
  console.log('[LOGIN] ===== DETAILED BIRTHDAY COMPARISON =====');
  console.log('[LOGIN] User birthday RAW:', user.birthday);
  console.log('[LOGIN] User birthday TYPE:', typeof user.birthday);
  console.log('[LOGIN] User birthday STRING:', userBirthday);
  console.log('[LOGIN] User birthday LENGTH:', userBirthday.length);
  console.log('[LOGIN] User birthday BYTES:', Array.from(userBirthday).map(c => c.charCodeAt(0)).join(','));
  console.log('[LOGIN] Input birthday RAW:', birthday);
  console.log('[LOGIN] Input birthday TYPE:', typeof birthday);
  console.log('[LOGIN] Input birthday STRING:', inputBirthday);
  console.log('[LOGIN] Input birthday LENGTH:', inputBirthday.length);
  console.log('[LOGIN] Input birthday BYTES:', Array.from(inputBirthday).map(c => c.charCodeAt(0)).join(','));
  console.log('[LOGIN] Strict comparison (===):', userBirthday === inputBirthday);
  console.log('[LOGIN] Loose comparison (==):', userBirthday == inputBirthday);
  console.log('[LOGIN] =======================================');
  
  // 嘗試多種比較方式
  const match1 = userBirthday === inputBirthday;
  const match2 = user.birthday == birthday;
  const match3 = String(user.birthday) === String(birthday);
  
  if (!match1 && !match2 && !match3) {
    const errorMsg = 'Birthday mismatch: DB="' + userBirthday + '" (' + userBirthday.length + ' chars) vs Input="' + inputBirthday + '" (' + inputBirthday.length + ' chars)';
    console.log('[LOGIN] ERROR:', errorMsg);
    return { success: false, message: '生日驗證失敗: ' + errorMsg };
  }
  
  console.log('[LOGIN] SUCCESS for ' + phone);
  return { success: true, user };
}

async function handleRegisterUser(body, supabase) {
  const { phone, nickname, birthday, email, address, realName } = body;
  
  const existing = await supabase.query('users', { eq: { phone } });
  if (existing && existing.length > 0) {
    return { success: false, message: '此電話號碼已註冊' };
  }
  
  const newUser = [{
    phone,
    nickname,
    birthday,
    email: email || null,
    address: address || null,
    real_name: realName || null
  }];
  
  const result = await supabase.insert('users', newUser);
  if (result && result.length > 0) {
    return { success: true, message: '註冊成功！', user: result[0] };
  }
  
  return { success: false, message: '註冊失敗' };
}

async function handleGetProducts(body, supabase) {
  try {
    const products = await supabase.query('product_catalog', {});
    console.log('[PRODUCTS] Query returned ' + (Array.isArray(products) ? products.length : 'non-array') + ' items');
    
    if (!Array.isArray(products)) {
      console.error('[PRODUCTS] ERROR: Not an array:', products);
      return { success: false, message: `資料格式錯誤: ${JSON.stringify(products)}` };
    }
    
    if (products.length === 0) {
      return { success: true, items: [], message: '資料庫中沒有商品資料' };
    }
    
    // 記錄第一筆商品的原始資料
    console.log('[PRODUCTS] Sample product (first):', JSON.stringify(products[0]));
    
    // 🌟 動態計算每個商品的累積張數（從 orders 資料表實時加總）
    console.log('[PRODUCTS] 開始動態計算累積張數...');
    const accumulatedMap = new Map();
    const accumulatedItemMap = new Map();
    
    try {
      // 🔑 使用 queryAll 查詢所有訂單（無限制）
      const { rows: allOrders } = await fetchAllOrdersForAccumulation(supabase);
      
      console.log('[PRODUCTS] 查詢到 ' + (Array.isArray(allOrders) ? allOrders.length : 0) + ' 筆訂單');
      
      if (Array.isArray(allOrders)) {
        // 按商品名稱和卡號分組加總
        allOrders.forEach((order, idx) => {
          const orderItem = order.item || order.item_name || order.product_name || '';
          const orderCard = order.card_no || order.cardno || '';
          const key = buildKey(orderItem, orderCard);
          const itemKey = buildItemKey(orderItem);
          const qty = parseInt(order.quantity) || 0;
          
          // 除錯：顯示前 3 筆訂單的原始資料
          if (idx < 3) {
            console.log('[PRODUCTS] 訂單 #' + idx + ': item="' + orderItem + '", card_no="' + orderCard + '", qty=' + qty + ', key="' + key + '"');
          }
          
          if (qty > 0 && itemKey) {
            accumulatedMap.set(key, (accumulatedMap.get(key) || 0) + qty);
            accumulatedItemMap.set(itemKey, (accumulatedItemMap.get(itemKey) || 0) + qty);
          }
        });
        console.log('[PRODUCTS] 累積張數計算完成，共 ' + accumulatedMap.size + ' 個商品有訂單');
        
        // 顯示前幾個商品的累積張數（用於除錯）
        let count = 0;
        for (const [key, qty] of accumulatedMap) {
          if (count < 5) {
            console.log('[PRODUCTS] 範例累積: "' + key + '" = ' + qty + ' 張');
            count++;
          } else {
            break;
          }
        }
      }
    } catch (error) {
      console.error('[PRODUCTS] 計算累積張數失敗:', error);
    }
    
    const items = products.map(p => {
      const isBox = parseBoolValue(p.is_box_preorder) ? 'Y' : 'N';
      
      // 🌟 從動態計算的 Map 獲取累積張數（使用相同的標準化方式）
      const key = buildKey(p.item_name, p.card_no);
      const itemKey = buildItemKey(p.item_name);
      const accumulated = (accumulatedMap.get(key) != null)
        ? accumulatedMap.get(key)
        : (accumulatedItemMap.get(itemKey) || 0);
      
      return {
        item: p.item_name,
        cardNo: p.card_no,
        price: p.price,
        discountPrice: p.threshold_price || p.price,
        fullPrice: p.threshold_price || p.price,
        threshold: p.discount_threshold || 0,
        images: [p.image_url_1, p.image_url_2, p.image_url_3, p.image_url_4].filter(Boolean),
        isBox: isBox,
        status: parseBoolValue(p.is_available) ? 'open' : 'closed',
        isOpen: parseBoolValue(p.is_available),
        stockStatus: p.stock_status || 'P',
        arrivalStatus: p.stock_status || 'P',
        stock: p.remaining_stock || 0,
        canDrawSp: parseBoolValue(p.can_draw_sp),
        canDrawSignature: parseBoolValue(p.can_draw_signature),
        canDrawRelic: parseBoolValue(p.can_draw_relic),
        canDrawAutoRelic: parseBoolValue(p.can_draw_auto_relic),
        minGroup: p.min_group_quantity || 0,
        category: p.category,
        isBoxPreorder: parseBoolValue(p.is_box_preorder),
        canDirectOrder: parseBoolValue(p.can_direct_order),
        isDirect: parseBoolValue(p.can_direct_order) ? 'Y' : 'N',
        closeTime: p.scheduled_delist_time || '',
        // 🌟 累積張數（動態計算，永遠準確）
        accumulatedCount: accumulated,
        description: p.description || ''
      };
    });
    
    const boxCount = items.filter(i => i.isBox === 'Y').length;
    const toppsCount = items.filter(i => i.isBox === 'N').length;
    console.log('[PRODUCTS] Converted ' + items.length + ' items: Boxes=' + boxCount + ', Topps=' + toppsCount);
    console.log('[PRODUCTS] Sample converted item:', JSON.stringify(items[0]));
    
    return { success: true, items };
  } catch (error) {
    console.error('[PRODUCTS] ERROR:', error);
    return { success: false, message: error.message };
  }
}

async function handleGetOrderInfo(body, supabase) {
  const { phone } = body;
  console.log('[ORDER_INFO] Getting order info for phone: ' + phone);
  
  const users = await supabase.query('users', { eq: { phone } });
  if (!Array.isArray(users) || users.length === 0) {
    console.log('[ORDER_INFO] ERROR: User not found: ' + phone);
    return { success: false, message: '用戶不存在' };
  }
  
  const userId = users[0].id;
  const userNickname = users[0].nickname;
  console.log('[ORDER_INFO] User ID: ' + userId + ', Nickname: ' + userNickname);
  
  // 查詢訂單（使用 orders 資料表）
  let orders = await supabase.query('orders', { eq: { user_id: userId }, order: { column: 'timestamp', ascending: false } });
  
  // 查詢團拆記錄（使用 breaks 資料表）
  let groupBreaks = await supabase.query('breaks', { eq: { user_id: userId }, order: { column: 'created_at', ascending: false } });
  
  console.log('[ORDER_INFO] Orders: ' + (Array.isArray(orders) ? orders.length : 'non-array') + ' items');
  console.log('[ORDER_INFO] Group breaks: ' + (Array.isArray(groupBreaks) ? groupBreaks.length : 'non-array') + ' items');
  
  if (Array.isArray(orders) && orders.length > 0) {
    console.log('[ORDER_INFO] Sample order:', JSON.stringify(orders[0]));
  }
  
  // 🌟 動態計算全站累積張數（用於訂單列表顯示）
  const accumulatedMap = new Map();
  const accumulatedItemMap = new Map();
  try {
    // 🔑 使用 queryAll 查詢所有訂單（無限制）
    const { rows: allOrders } = await fetchAllOrdersForAccumulation(supabase);
    
    console.log('[ORDER_INFO] 查詢到 ' + (Array.isArray(allOrders) ? allOrders.length : 0) + ' 筆訂單用於計算累積');
    
    if (Array.isArray(allOrders)) {
      allOrders.forEach(order => {
        const orderItem = order.item || order.item_name || order.product_name || '';
        const orderCard = order.card_no || order.cardno || '';
        const key = buildKey(orderItem, orderCard);
        const itemKey = buildItemKey(orderItem);
        const qty = parseInt(order.quantity) || 0;
        if (qty > 0 && itemKey) {
          accumulatedMap.set(key, (accumulatedMap.get(key) || 0) + qty);
          accumulatedItemMap.set(itemKey, (accumulatedItemMap.get(itemKey) || 0) + qty);
        }
      });
      console.log('[ORDER_INFO] 累積張數計算完成，共 ' + accumulatedMap.size + ' 個商品有訂單');
    }
  } catch (error) {
    console.error('[ORDER_INFO] 計算累積張數失敗:', error);
  }
  
  const formattedOrders = Array.isArray(orders) ? orders.map(o => {
    // 使用標準化的 key（轉小寫）
    const key = buildKey(o.item, o.card_no);
    const itemKey = buildItemKey(o.item);
    const accumulatedCount = (accumulatedMap.get(key) != null)
      ? accumulatedMap.get(key)
      : (accumulatedItemMap.get(itemKey) || 0);
    // box_order 欄位：true/false 字串
    let boxOrderValue = 'false';
    if (typeof o.box_order !== 'undefined' && o.box_order !== null) {
      if (o.box_order === true || o.box_order === 'true' || o.box_order === 1 || o.box_order === '1') {
        boxOrderValue = 'true';
      }
    }
    return {
      id: o.id, // 🔑 加入訂單 ID，用於付款通知
      item: o.item,
      cardNo: o.card_no,
      quantity: o.quantity,
      price: o.unit_price || 0,
      total: o.total_fee || 0,
      totalFee: o.total_fee || 0,
      balance: o.balance_amount || 0,
      balanceAmount: o.balance_amount || 0,
      deposit: o.deposit || 0,
      isCleared: o.is_cleared ? 'Y' : 'N',
      status: o.status || '待確認',
      arrivalStatus: o.arrival_status || '',
      isShipped: o.is_shipped || false,
      imageUrl: o.image_url || '',
      timestamp: o.timestamp,
      date: o.timestamp,
      box_order: boxOrderValue,
      isBox: 'N', // 從 orders 資料表來的都是單卡
      累積張數: accumulatedCount // 🌟 顯示全站累積張數
    };
  }) : [];
  
  const formattedBreaks = Array.isArray(groupBreaks) ? groupBreaks.map(b => ({
    id: b.break_id,
    name: b.name,
    category: b.category || '棒球',
    totalFee: b.total_fee || 0,
    paid: b.paid || 0,
    balance: b.balance || 0,
    status: b.status || '',
    isOpened: b.is_opened || false,
    isShipped: b.is_shipped || false,
    paymentNotified: b.payment_notified || false,
    timestamp: b.created_at
  })) : [];
  
  console.log('[ORDER_INFO] Returning ' + formattedOrders.length + ' orders, ' + formattedBreaks.length + ' breaks');
  
  // 返回用戶資訊以及訂單和團拆記錄
  return { 
    success: true, 
    nickname: users[0].nickname,
    phone: users[0].phone,
    email: users[0].email,
    address: users[0].address,
    customerName: users[0].real_name,
    orders: formattedOrders, 
    groupBreaks: formattedBreaks 
  };
}

async function handleAddOrder(body, supabase) {
  console.log('[ADD_ORDER] ===== 開始處理訂單 =====');
  console.log('[ADD_ORDER] 收到的 body:', JSON.stringify(body));
  console.log('[ADD_ORDER] body 的 keys:', Object.keys(body));
  
  // 🔧 同時支援 orderEntries 和 entries 兩種格式
  const { nickname, phone, orderEntries, entries } = body;
  const rawEntries = orderEntries || entries;
  
  console.log('[ADD_ORDER] nickname:', nickname);
  console.log('[ADD_ORDER] phone:', phone);
  console.log('[ADD_ORDER] orderEntries:', orderEntries);
  console.log('[ADD_ORDER] entries:', entries);
  console.log('[ADD_ORDER] rawEntries:', rawEntries);
  console.log('[ADD_ORDER] rawEntries 類型:', typeof rawEntries);
  console.log('[ADD_ORDER] rawEntries 是否為陣列:', Array.isArray(rawEntries));
  console.log('[ADD_ORDER] rawEntries 長度:', rawEntries ? rawEntries.length : 'undefined');
  
  if (!rawEntries) {
    console.error('[ADD_ORDER] ❌ 訂單資料為空');
    return { success: false, message: '訂單資料為空 (orderEntries/entries 不存在)' };
  }
  
  if (!Array.isArray(rawEntries)) {
    console.error('[ADD_ORDER] ❌ 訂單資料不是陣列，類型:', typeof rawEntries);
    return { success: false, message: '訂單資料格式錯誤 (不是陣列)' };
  }
  
  if (rawEntries.length === 0) {
    console.error('[ADD_ORDER] ❌ 訂單資料長度為 0');
    return { success: false, message: '訂單資料為空 (陣列長度為 0)' };
  }
  
  // 🔧 標準化訂單資料格式（支援兩種格式）
  // 格式 1: { item, cardNo, quantity, unitPrice }
  // 格式 2: { item, cardNo, qty, price }
  const normalizedEntries = rawEntries.map(entry => ({
    item: entry.item,
    cardNo: entry.cardNo,
    quantity: entry.quantity || entry.qty || 1,
    unitPrice: entry.unitPrice || entry.price || 0
  }));
  
  console.log('[ADD_ORDER] 標準化後的訂單:', normalizedEntries);
  console.log('[ADD_ORDER] 標準化後的訂單:', normalizedEntries);
  
  const users = await supabase.query('users', { eq: { phone } });
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  const now = new Date().toISOString();
  
  // 🌟 查詢所有商品目錄以獲取圖片、到貨狀態、門檻價等資訊
  const products = await supabase.query('product_catalog', {});
  const productMap = new Map();
  
  console.log('[ADD_ORDER] 查詢到 ' + (Array.isArray(products) ? products.length : 0) + ' 個商品');
  
  if (Array.isArray(products)) {
    products.forEach((p, idx) => {
      // 標準化 key
      const key = buildKey(p.item_name, p.card_no);
      
      // 🔑 除錯：顯示前 3 個商品的原始資料
      if (idx < 3) {
        console.log('[ADD_ORDER] 商品 #' + idx + ' 原始資料:', {
          item_name: p.item_name,
          card_no: p.card_no,
          price: p.price,
          threshold_price: p.threshold_price,
          discount_threshold: p.discount_threshold,
          key: key
        });
      }
      
      // 🔑 門檻價格：優先使用 threshold_price，若為 0 則使用 price
      const thresholdPrice = parseFloat(p.threshold_price) || parseFloat(p.price) || 0;
      const regularPrice = parseFloat(p.price) || 0;
      
      productMap.set(key, {
        imageUrl: p.image_url_1 || '',
        arrivalStatus: p.stock_status || '',
        threshold: parseInt(p.discount_threshold) || 0,
        fullPrice: thresholdPrice, // 門檻價格
        regularPrice: regularPrice, // 原價
        isOpen: p.is_available !== 'N', // 🔑 只有明確設為 'N' 才視為關閉
        isAvailableValue: p.is_available, // 記錄原始值用於除錯
        stock: parseInt(p.remaining_stock) || 0,
        isBoxPreorder: parseBoolValue(p.is_box_preorder), // 🔑 卡盒判斷欄位
        // 記錄原始資料用於除錯
        rawThresholdPrice: p.threshold_price,
        rawPrice: p.price,
        rawDiscountThreshold: p.discount_threshold
      });
    });
  }
  
  // 🌟 動態計算當前全站累積張數（從現有訂單加總）
  const accumulatedMap = new Map();
  const accumulatedItemMap = new Map();
  try {
    // 🔑 使用 queryAll 查詢所有訂單（無限制）
    const { rows: allOrders } = await fetchAllOrdersForAccumulation(supabase);
    
    console.log('[ADD_ORDER] 查詢到 ' + (Array.isArray(allOrders) ? allOrders.length : 0) + ' 筆訂單用於計算累積');
    
    if (Array.isArray(allOrders)) {
      allOrders.forEach(order => {
        const orderItem = order.item || order.item_name || order.product_name || '';
        const orderCard = order.card_no || order.cardno || '';
        const key = buildKey(orderItem, orderCard);
        const itemKey = buildItemKey(orderItem);
        const qty = parseInt(order.quantity) || 0;
        if (qty > 0 && itemKey) {
          accumulatedMap.set(key, (accumulatedMap.get(key) || 0) + qty);
          accumulatedItemMap.set(itemKey, (accumulatedItemMap.get(itemKey) || 0) + qty);
        }
      });
      console.log('[ADD_ORDER] 累積張數計算完成，共 ' + accumulatedMap.size + ' 個商品有訂單');
    }
  } catch (error) {
    console.error('[ADD_ORDER] 計算累積張數失敗:', error);
  }
  
  console.log('[ADD_ORDER] 開始轉換訂單項目，共', normalizedEntries.length, '筆');
  
  const ordersToInsert = normalizedEntries.map((entry, index) => {
    console.log('[ADD_ORDER] 處理第', index + 1, '筆訂單，原始資料:', entry);
    
    const itemName = String(entry.item || '').trim();
    const cardNo = String(entry.cardNo || '').trim();
    const key = buildKey(itemName, cardNo);
    const quantity = parseInt(entry.quantity) || 1;
    let unitPrice = parseFloat(entry.unitPrice) || 0;
    
    console.log('[ADD_ORDER] 處理訂單項目 #' + (index + 1) + ':', { itemName, cardNo, key, quantity, unitPrice });
    
    // 🌟 從商品目錄獲取資訊
    const productInfo = productMap.get(key);
    let imageUrl = '';
    let arrivalStatus = '';
    
    console.log('[ADD_ORDER] 查詢商品資訊，key:', key);
    console.log('[ADD_ORDER] productMap 中是否存在:', productMap.has(key));
    
    if (!productInfo) {
      // 找不到商品資訊，列出所有可用的 key
      console.error('[ADD_ORDER] ❌ 找不到商品資訊！查詢 key:', key);
      console.error('[ADD_ORDER] 商品目錄中的 keys (前10個):', Array.from(productMap.keys()).slice(0, 10));
      
      // 嘗試找相似的 key
      const similarKeys = Array.from(productMap.keys()).filter(k => k.includes(itemName.toLowerCase()));
      console.error('[ADD_ORDER] 相似的 keys:', similarKeys);
      
      throw new Error('找不到商品【' + itemName + '】的資訊，請重新整理頁面');
    }
    
    imageUrl = productInfo.imageUrl;
    arrivalStatus = productInfo.arrivalStatus;
    
    console.log('[ADD_ORDER] 商品資訊:', { 
      isOpen: productInfo.isOpen, 
      isAvailableValue: productInfo.isAvailableValue,
      threshold: productInfo.threshold, 
      fullPrice: productInfo.fullPrice,
      regularPrice: productInfo.regularPrice,
      rawThresholdPrice: productInfo.rawThresholdPrice,
      rawPrice: productInfo.rawPrice
    });
    
    // 🌟 檢查是否開放（只有明確設為 'N' 才拒絕）
    if (productInfo.isAvailableValue === 'N') {
      console.error('[ADD_ORDER] ❌ 商品已關閉:', itemName, '(is_available = N)');
      throw new Error('【' + itemName + '】已截止下單！請重新整理頁面查看最新商品');
    }
    // 🌟 檢查是否開放（允許未設定的情況，預設為開放）
    if (productInfo.isOpen === false) {
      console.error('[ADD_ORDER] ❌ 商品已關閉:', itemName);
      throw new Error('【' + itemName + '】已截止下單！請重新整理頁面查看最新商品');
    }
    
    // 🌟 根據全站累積張數自動調整價格（達到門檻用門檻價）
    if (productInfo.threshold > 0 && productInfo.fullPrice > 0) {
      const itemKey = buildItemKey(itemName);
      const currentAccumulated = (accumulatedMap.get(key) != null)
        ? accumulatedMap.get(key)
        : (accumulatedItemMap.get(itemKey) || 0); // 🔑 從動態計算的累積讀取
      // 🔑 加上本次訂單的數量來計算總累積
      const totalAfterOrder = currentAccumulated + quantity;
      
      if (totalAfterOrder >= productInfo.threshold) {
        unitPrice = productInfo.fullPrice;
        console.log('[ADD_ORDER] ' + itemName + ' 累積 ' + totalAfterOrder + ' 張 >= 門檻 ' + productInfo.threshold + '，使用門檻價 ' + unitPrice);
      } else {
        console.log('[ADD_ORDER] ' + itemName + ' 累積 ' + totalAfterOrder + ' 張 < 門檻 ' + productInfo.threshold + '，使用原價 ' + unitPrice);
      }
    }
    
    const totalFee = unitPrice * quantity;
    
    // 判斷是否為卡盒商品（只接受 true 才算卡盒，其餘皆為 false）
    let boxOrderValue = false;
    if (productInfo && (productInfo.isBoxPreorder === true || productInfo.isBoxPreorder === 'true' || productInfo.isBoxPreorder === 1 || productInfo.isBoxPreorder === '1')) {
      boxOrderValue = true;
    }
    return {
      user_id: userId,
      timestamp: now,
      item: itemName,
      card_no: cardNo,
      quantity: quantity,
      unit_price: unitPrice,
      total_fee: totalFee,
      balance_amount: totalFee,
      deposit: 0,
      is_cleared: false,
      status: '待確認',
      arrival_status: arrivalStatus,
      image_url: imageUrl,
      box_order: boxOrderValue
    };
  });
  
  console.log('[ADD_ORDER] 準備插入訂單，共', ordersToInsert.length, '筆');
  console.log('[ADD_ORDER] 插入資料:', JSON.stringify(ordersToInsert, null, 2));
  
  const result = await supabase.insert('orders', ordersToInsert);
  
  console.log('[ADD_ORDER] 插入結果:', result);
  console.log('[ADD_ORDER] 插入成功筆數:', result ? result.length : 0);
  
  // 🌟 扣減商品庫存（只針對卡盒商品）
  try {
    console.log('[ADD_ORDER] 開始檢查是否需要扣減庫存...');
    
    for (const entry of normalizedEntries) {
      const itemName = String(entry.item || '').trim();
      const cardNo = String(entry.cardNo || '').trim();
      const quantity = parseInt(entry.quantity) || 1;
      const key = buildKey(itemName, cardNo);
      
      const productInfo = productMap.get(key);
      if (!productInfo) {
        console.warn('[ADD_ORDER] ⚠️ 找不到商品資訊，無法扣減庫存:', itemName, cardNo);
        continue;
      }
      
      // 🔑 檢查是否為卡盒商品（只有卡盒才扣減庫存）
      const products = await supabase.query('product_catalog', { 
        eq: { item_name: itemName, card_no: cardNo } 
      });
      
      if (Array.isArray(products) && products.length > 0) {
        const isBoxProduct = parseBoolValue(products[0].is_box_preorder);
        
        if (!isBoxProduct) {
          console.log('[ADD_ORDER] ⏭️ 跳過庫存扣減:', itemName, '(非卡盒商品)');
          continue;
        }
      }
      
      const currentStock = productInfo.stock || 0;
      const newStock = Math.max(0, currentStock - quantity);
      
      console.log('[ADD_ORDER] 扣減庫存 (卡盒):', itemName, '原庫存:', currentStock, '下單:', quantity, '新庫存:', newStock);
      
      // 更新 product_catalog 的 remaining_stock
      const updateStockUrl = `${supabase.url}/rest/v1/product_catalog?item_name=eq.${encodeURIComponent(itemName)}&card_no=eq.${encodeURIComponent(cardNo)}`;
      await fetch(updateStockUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabase.apiKey,
          'Authorization': `Bearer ${supabase.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          remaining_stock: newStock
        })
      });
      
      console.log('[ADD_ORDER] ✅ 已更新商品庫存:', itemName, '→', newStock);
    }
  } catch (error) {
    console.error('[ADD_ORDER] 扣減庫存失敗:', error);
    // 不影響訂單新增，只記錄錯誤
  }
  
  console.log('[ADD_ORDER] 🔍 開始檢查門檻價格更新邏輯...');
  
  // 🌟 檢查是否需要更新舊訂單價格（達到門檻時）
  // 這是原始 backend.js 的邏輯：達到門檻後，更新所有用戶該商品的訂單價格
  try {
    for (const entry of normalizedEntries) {
      const itemName = String(entry.item || '').trim();
      const cardNo = String(entry.cardNo || '').trim();
      const key = buildKey(itemName, cardNo); // 🔑 使用標準化 key
      const quantity = parseInt(entry.quantity) || 1;
      
      console.log('[ADD_ORDER] 檢查商品:', itemName, 'key:', key);
      
      const productInfo = productMap.get(key);
      if (!productInfo || !productInfo.threshold || !productInfo.fullPrice) {
        console.log('[ADD_ORDER] ⏭️ 跳過價格更新檢查:', itemName, '(無門檻設定)');
        console.log('[ADD_ORDER]   - threshold:', productInfo?.threshold || 0);
        console.log('[ADD_ORDER]   - fullPrice:', productInfo?.fullPrice || 0);
        console.log('[ADD_ORDER]   - regularPrice:', productInfo?.regularPrice || 0);
        console.log('[ADD_ORDER]   - rawThresholdPrice:', productInfo?.rawThresholdPrice);
        console.log('[ADD_ORDER]   - rawPrice:', productInfo?.rawPrice);
        
        // 🔑 如果有門檻數量但沒有門檻價格，使用原價作為門檻價格
        if (productInfo && productInfo.threshold > 0 && productInfo.regularPrice > 0) {
          console.log('[ADD_ORDER] ⚠️ 商品有門檻數量但無門檻價格，使用原價', productInfo.regularPrice, '作為門檻價格');
          productInfo.fullPrice = productInfo.regularPrice;
        } else {
          continue;
        }
      }
      
      console.log('[ADD_ORDER] 📊 商品', itemName, '有門檻設定: threshold=' + productInfo.threshold + ', fullPrice=' + productInfo.fullPrice);
      
      // 重新計算累積張數（包含剛新增的訂單）
      const ordersUrl = `${supabase.url}/rest/v1/orders?item=eq.${encodeURIComponent(itemName)}&card_no=eq.${encodeURIComponent(cardNo)}&select=quantity`;
      const ordersResp = await fetch(ordersUrl, {
        headers: {
          'apikey': supabase.apiKey,
          'Authorization': `Bearer ${supabase.apiKey}`
        }
      });
      const allProductOrders = await ordersResp.json();
      
      let totalAccumulated = 0;
      if (Array.isArray(allProductOrders)) {
        allProductOrders.forEach(o => {
          totalAccumulated += parseInt(o.quantity) || 0;
        });
      }
      
      console.log('[ADD_ORDER] ' + itemName + ' 最新累積: ' + totalAccumulated + ', 門檻: ' + productInfo.threshold);
      
      // 🎯 如果達到門檻，更新「所有用戶」該商品的訂單價格（不限該用戶）
      if (totalAccumulated >= productInfo.threshold) {
        console.log('[ADD_ORDER] 🎯 達到門檻！開始更新所有用戶的 ' + itemName + ' 訂單價格 -> ' + productInfo.fullPrice);
        
        // 🔑 查詢「所有用戶」該商品的訂單（移除 user_id 限制）
        const allOrdersUrl = `${supabase.url}/rest/v1/orders?item=eq.${encodeURIComponent(itemName)}&card_no=eq.${encodeURIComponent(cardNo)}&select=id,quantity,unit_price,deposit,user_id`;
        console.log('[ADD_ORDER] 查詢所有訂單 URL:', allOrdersUrl);
        
        const allOrdersResp = await fetch(allOrdersUrl, {
          headers: {
            'apikey': supabase.apiKey,
            'Authorization': `Bearer ${supabase.apiKey}`
          }
        });
        const allOrders = await allOrdersResp.json();
        
        console.log('[ADD_ORDER] 查詢到 ' + (Array.isArray(allOrders) ? allOrders.length : 0) + ' 筆訂單');
        
        if (Array.isArray(allOrders)) {
          let updatedCount = 0;
          let skippedCount = 0;
          
          for (const order of allOrders) {
            const priceDiff = Math.abs(order.unit_price - productInfo.fullPrice);
            console.log('[ADD_ORDER] 訂單 ' + order.id + ' (user_id=' + order.user_id + '): 目前價格=' + order.unit_price + ', 門檻價=' + productInfo.fullPrice + ', 差異=' + priceDiff);
            
            // 只更新價格不是門檻價的訂單
            if (priceDiff > 0.01) {
              const newTotal = order.quantity * productInfo.fullPrice;
              const newBalance = newTotal - (order.deposit || 0);
              
              const patchUrl = `${supabase.url}/rest/v1/orders?id=eq.${order.id}`;
              const patchResp = await fetch(patchUrl, {
                method: 'PATCH',
                headers: {
                  'apikey': supabase.apiKey,
                  'Authorization': `Bearer ${supabase.apiKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                  unit_price: productInfo.fullPrice,
                  total_fee: newTotal,
                  balance_amount: newBalance
                })
              });
              
              console.log('[ADD_ORDER] PATCH 回應狀態:', patchResp.status, patchResp.statusText);
              
              updatedCount++;
              console.log('[ADD_ORDER] ✅ 已更新訂單 ' + order.id + ' 價格: ' + order.unit_price + ' -> ' + productInfo.fullPrice);
            } else {
              skippedCount++;
              console.log('[ADD_ORDER] ⏭️ 跳過訂單 ' + order.id + ' (價格已是門檻價)');
            }
          }
          console.log('[ADD_ORDER] 🎉 更新結果: 已更新 ' + updatedCount + ' 筆，跳過 ' + skippedCount + ' 筆（價格已正確）');
        }
      } else {
        console.log('[ADD_ORDER] ⏭️ 未達門檻，不更新舊訂單 (累積 ' + totalAccumulated + ' < 門檻 ' + productInfo.threshold + ')');
      }
    }
  } catch (error) {
    console.error('[ADD_ORDER] 更新舊訂單價格失敗:', error);
    // 不影響訂單新增，只記錄錯誤
  }
  
  console.log('[ADD_ORDER] ✅ 訂單新增完成，共 ' + normalizedEntries.length + ' 筆');
  
  // 🌟 寄送 email 通知商家
  try {
    await sendOrderNotificationEmail(nickname, phone, ordersToInsert);
    console.log('[ADD_ORDER] ✅ Email 通知已發送');
  } catch (emailError) {
    console.error('[ADD_ORDER] ❌ Email 通知發送失敗:', emailError);
    // 不影響訂單新增，只記錄錯誤
  }
  
  return { success: true, message: '訂單新增成功', insertedCount: result ? result.length : 0 };
}

async function sendOrderNotificationEmail(nickname, phone, orders) {
  const resendApiKey = 're_9eMazG8M_NZZGeeT4DTWXMCAs3UGyBQWS'; // 🔑 你的 Resend API key
  const merchantEmail = 'ningscard@gmail.com'; // 🔑 請改成你的 Gmail
  
  // 組裝訂單明細
  let orderDetails = '';
  let totalAmount = 0;
  orders.forEach((o, idx) => {
    orderDetails += `${idx + 1}. ${o.item} ${o.card_no ? '(' + o.card_no + ')' : ''}\n`;
    orderDetails += `   數量: ${o.quantity} | 單價: NT$ ${o.unit_price} | 小計: NT$ ${o.total_fee}\n\n`;
    totalAmount += o.total_fee;
  });
  
  const emailBody = `
新訂單通知

客戶資訊：
- 暱稱：${nickname}
- 電話：${phone}

訂單明細：
${orderDetails}
總金額：NT$ ${totalAmount.toLocaleString()}

請盡快處理此訂單。
  `.trim();
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Ning Card Store <onboarding@resend.dev>', // Resend 預設寄件者
      to: [merchantEmail],
      subject: `🛒 新訂單通知 - ${nickname} (${phone})`,
      text: emailBody
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error('Resend API 錯誤: ' + error);
  }
  
  return await response.json();
}

async function handleGetPendingPaymentKeys(body, supabase) {
  const { nickname, phone } = body;
  
  const users = await supabase.query('users', { eq: { phone } });
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  const pendingItems = [];
  
  // 獲取未結清的訂單
  let orderQuery = `${supabase.url}/rest/v1/orders?user_id=eq.${userId}&is_cleared=eq.false&balance_amount=gt.0&select=*`;
  const ordersResp = await fetch(orderQuery, {
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`
    }
  });
  const orders = await ordersResp.json();
  
  if (orders && Array.isArray(orders)) {
    orders.forEach(o => {
      pendingItems.push({
        type: 'order',
        key: `${o.item}_${o.card_no}`,
        item: o.item,
        cardNo: o.card_no,
        balance: o.balance_amount,
        timestamp: o.timestamp
      });
    });
  }
  
  // 獲取未付清的團拆
  let breaksQuery = `${supabase.url}/rest/v1/breaks?user_id=eq.${userId}&balance=gt.0&select=*`;
  const breaksResp = await fetch(breaksQuery, {
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`
    }
  });
  const breaks = await breaksResp.json();
  
  if (breaks && Array.isArray(breaks)) {
    breaks.forEach(b => {
      pendingItems.push({
        type: 'break',
        key: `${b.break_id}_${b.name}`,
        breakId: b.break_id,
        name: b.name,
        balance: b.balance,
        timestamp: b.created_at
      });
    });
  }
  
  return { success: true, pendingItems };
}

async function handleNotifyPaymentBulk(body, supabase) {
  const { nickname, phone, paymentItems } = body;
  
  if (!paymentItems || paymentItems.length === 0) {
    return { success: false, message: '付款項目為空' };
  }
  
  const users = await supabase.query('users', { eq: { phone } });
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  const now = new Date().toISOString();
  
  const historyRecords = paymentItems.map(item => ({
    user_id: userId,
    action: '付款通知',
    details: `${item.item || item.name} - 金額: ${item.amount}`,
    timestamp: now
  }));
  
  await supabase.insert('order_history', historyRecords);
  return { success: true, message: '付款通知已送出' };
}

async function handlePaymentNotification(body, supabase) {
  const { nickname, phone, type, item, cardNo, orderIds, breakId, key, amount, total, quantity, remark, status } = body;
  
  const users = await supabase.query('users', { eq: { phone } });
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  
  // 🌟 1. 存入付款通知到 notifications 表（用於對帳）
  try {
    const notificationData = {
      user_id: userId,
      type: 'payment', // 付款通知類型
      subject: `${type === 'order' ? '訂單' : '團拆'}付款通知 - ${nickname}`,
      content: JSON.stringify({
        paymentType: type, // 'order' 或 'break'
        paymentMethod: body.paymentMethod || 'bank', // 'bank' 或 'linepay'
        accountLast5: key, // 帳號後五碼或 Line Pay 名稱
        items: item,
        cardNumbers: cardNo || '',
        orderIds: orderIds || '', // 訂單 ID（用於對帳查詢）
        breakIds: breakId || '',
        quantity: quantity,
        paidAmount: amount,
        remark: remark || ''
      }),
      status: 'pending', // 待確認
      sent_at: new Date().toISOString()
    };
    
    console.log('[NOTIFICATION] 準備寫入資料:', JSON.stringify(notificationData));
    
    const insertResult = await supabase.insert('notifications', [notificationData]);
    
    console.log('[NOTIFICATION] 寫入結果:', JSON.stringify(insertResult));
    
    if (insertResult && insertResult.error) {
      console.error('[NOTIFICATION] 寫入失敗:', JSON.stringify(insertResult.error));
      return { success: false, message: '付款通知寫入失敗: ' + insertResult.error.message };
    }
    
    console.log('[NOTIFICATION] ✅ 付款通知寫入成功');
    
  } catch (error) {
    console.error('[NOTIFICATION] 存入付款通知異常:', error.toString());
    return { success: false, message: '付款通知存入異常: ' + error.message };
  }
  
  // 🌟 2. 根據付款類型更新訂單/團拆狀態為「付款確認中」
  if (type === 'order') {
    // 訂單付款 - 根據訂單 ID 更新狀態為「付款確認中」
    if (orderIds) {
      const orderIdList = orderIds.split('||').filter(id => id);
      
      console.log('[NOTIFICATION] 準備更新訂單狀態為「付款確認中」，訂單 ID:', orderIdList);
      
      for (const orderId of orderIdList) {
        try {
          const updateUrl = `${supabase.url}/rest/v1/orders?id=eq.${orderId}`;
          
          const updateResponse = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
              'apikey': supabase.apiKey,
              'Authorization': `Bearer ${supabase.apiKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({ status: '付款確認中' })
          });
          
          if (!updateResponse.ok) {
            console.error('[NOTIFICATION] 更新訂單 ID ' + orderId + ' HTTP 錯誤:', updateResponse.status, updateResponse.statusText);
          }
          
          const updateResult = await updateResponse.json();
          console.log('[NOTIFICATION] 訂單 ID ' + orderId + ' 更新結果:', JSON.stringify(updateResult));
          console.log('[NOTIFICATION] 訂單 ID ' + orderId + ' 更新後筆數:', Array.isArray(updateResult) ? updateResult.length : 0);
          
        } catch (error) {
          console.error('[NOTIFICATION] 更新訂單 ID ' + orderId + ' 異常:', error.toString());
        }
      }
    } else {
      console.warn('[NOTIFICATION] 沒有收到 orderIds 參數');
    }
    
  } else if (type === 'break') {
    // 團拆付款 - 更新團拆狀態為「付款確認中」
    if (breakId) {
      const breakIdList = breakId.split('||').filter(id => id);
      
      console.log('[NOTIFICATION] 準備更新團拆狀態為「付款確認中」，團拆 ID:', breakIdList, '用戶ID:', userId);
      
      for (const bid of breakIdList) {
        try {
          // 🔥 先用 break_id 和 user_id 查詢找到 UUID（重點：加上 user_id 過濾！）
          const findUrl = `${supabase.url}/rest/v1/breaks?break_id=eq.${encodeURIComponent(bid)}&user_id=eq.${userId}&select=id`;
          
          const findResponse = await fetch(findUrl, {
            headers: {
              'apikey': supabase.apiKey,
              'Authorization': `Bearer ${supabase.apiKey}`,
              'Content-Type': 'application/json'
            }
          });
          
          const findResult = await findResponse.json();
          console.log('[NOTIFICATION] 查詢團拆 break_id:', bid, '用戶:', userId, '找到:', findResult);
          
          if (Array.isArray(findResult) && findResult.length > 0) {
            const breakUUID = findResult[0].id;
            
            // 使用 UUID 更新特定的團拆
            const updateUrl = `${supabase.url}/rest/v1/breaks?id=eq.${breakUUID}`;
            
            const updateResponse = await fetch(updateUrl, {
              method: 'PATCH',
              headers: {
                'apikey': supabase.apiKey,
                'Authorization': `Bearer ${supabase.apiKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
              },
              body: JSON.stringify({ status: '付款確認中' })
            });
            
            if (!updateResponse.ok) {
              console.error('[NOTIFICATION] 更新團拆 UUID ' + breakUUID + ' HTTP 錯誤:', updateResponse.status, updateResponse.statusText);
            }
            
            const updateResult = await updateResponse.json();
            console.log('[NOTIFICATION] 團拆 UUID ' + breakUUID + ' 更新結果:', JSON.stringify(updateResult));
          } else {
            console.warn('[NOTIFICATION] 未找到團拆 break_id:', bid, '於用戶:', userId);
          }
          
        } catch (error) {
          console.error('[NOTIFICATION] 更新團拆 ID ' + bid + ' 異常:', error.toString());
        }
      }
    } else {
      console.warn('[NOTIFICATION] 沒有收到 breakId 參數');
    }
  }
  
  return { success: true, message: '付款通知已送出' };
}

async function handleNotifyProfileUpdate(body, supabase) {
  const { phone, nickname, email, address, realName } = body;
  
  const updateData = {};
  if (nickname) updateData.nickname = nickname;
  if (email) updateData.email = email;
  if (address) updateData.address = address;
  if (realName) updateData.real_name = realName;
  
  const updateUrl = `${supabase.url}/rest/v1/users?phone=eq.${phone}`;
  const response = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(updateData)
  });
  
  const result = await response.json();
  return { success: true, message: '個人資料更新成功', user: result[0] };
}

async function handleLookupOrderStatus(body, supabase) {
  const { query } = body;
  
  const users = await supabase.query('users', { eq: { phone: query } });
  
  if (users && users.length > 0) {
    const userId = users[0].id;
    
    const ordersUrl = `${supabase.url}/rest/v1/orders?user_id=eq.${userId}&order=timestamp.desc&limit=20&select=*`;
    const ordersResp = await fetch(ordersUrl, {
      headers: {
        'apikey': supabase.apiKey,
        'Authorization': `Bearer ${supabase.apiKey}`
      }
    });
    const orders = await ordersResp.json();
    
    const breaksUrl = `${supabase.url}/rest/v1/breaks?user_id=eq.${userId}&order=created_at.desc&limit=20&select=*`;
    const breaksResp = await fetch(breaksUrl, {
      headers: {
        'apikey': supabase.apiKey,
        'Authorization': `Bearer ${supabase.apiKey}`
      }
    });
    const breaks = await breaksResp.json();
    
    return {
      success: true,
      orders: (orders || []).map(o => ({
        item: o.item,
        cardNo: o.card_no,
        totalFee: o.total_fee,
        balanceAmount: o.balance_amount,
        status: o.status,
        timestamp: o.timestamp
      })),
      breaks: (breaks || []).map(b => ({
        breakId: b.break_id,
        name: b.name,
        totalFee: b.total_fee,
        balance: b.balance,
        createdAt: b.created_at
      }))
    };
  }
  
  return { success: true, orders: [], breaks: [] };
}

async function handleGetBreakCredit(body, supabase) {
  const { nickname, phone } = body;
  
  const orCondition = `nickname.eq.${nickname},phone.eq.${phone}`;
  const usersUrl = `${supabase.url}/rest/v1/users?or=(${orCondition})&select=*`;
  const usersResp = await fetch(usersUrl, {
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`
    }
  });
  const users = await usersResp.json();
  
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  const credits = await supabase.query('break_credits', { eq: { user_id: userId } });
  
  let total = 0;
  let used = 0;
  
  if (credits && Array.isArray(credits)) {
    credits.forEach(c => {
      total += c.amount || 0;
      used += c.used_amount || 0;
    });
  }
  
  return {
    success: true,
    total,
    used,
    available: total - used
  };
}

async function handleUseBreakCredit(body, supabase) {
  const { nickname, phone, amount, breakIds } = body;
  
  const orCondition = `nickname.eq.${nickname},phone.eq.${phone}`;
  const usersUrl = `${supabase.url}/rest/v1/users?or=(${orCondition})&select=*`;
  const usersResp = await fetch(usersUrl, {
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`
    }
  });
  const users = await usersResp.json();
  
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  
  const creditsUrl = `${supabase.url}/rest/v1/break_credits?user_id=eq.${userId}&is_used=eq.false&select=*`;
  const creditsResp = await fetch(creditsUrl, {
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`
    }
  });
  const credits = await creditsResp.json();
  
  let available = 0;
  if (credits && Array.isArray(credits)) {
    credits.forEach(c => {
      available += (c.amount || 0) - (c.used_amount || 0);
    });
  }
  
  if (available < amount) {
    return { success: false, message: '團拆金餘額不足' };
  }
  
  if (credits && credits.length > 0) {
    const creditToUpdate = credits[0];
    const newUsedAmount = (creditToUpdate.used_amount || 0) + amount;
    
    const updateUrl = `${supabase.url}/rest/v1/break_credits?id=eq.${creditToUpdate.id}`;
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': supabase.apiKey,
        'Authorization': `Bearer ${supabase.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        used_amount: newUsedAmount,
        is_used: newUsedAmount >= creditToUpdate.amount,
        used_break_ids: breakIds
      })
    });
  }
  
  return { success: true, message: '團拆金使用成功' };
}

async function handleSubmitPsaOrder(body, supabase) {
  const { formData } = body;
  
  const users = await supabase.query('users', { eq: { phone: formData.phone } });
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  const orderId = 'PSA' + Date.now();
  
  const psaOrder = [{
    user_id: userId,
    order_id: orderId,
    real_name: formData.realName,
    email: formData.email,
    phone: formData.phone,
    shipping_method: formData.shippingMethod,
    total_cards: formData.totalCards,
    total_amount: formData.totalAmount,
    status: '處理中',
    timestamp: new Date().toISOString()
  }];
  
  const result = await supabase.insert('psa_orders', psaOrder);
  
  if (result && result.length > 0) {
    return { success: true, message: 'PSA 訂單提交成功', orderId: orderId };
  }
  
  return { success: false, message: 'PSA 訂單提交失敗' };
}

async function handleLookupPsaOrders(body, supabase) {
  const { phone } = body;
  
  const users = await supabase.query('users', { eq: { phone } });
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  
  const ordersUrl = `${supabase.url}/rest/v1/psa_orders?user_id=eq.${userId}&order=timestamp.desc&select=*`;
  const ordersResp = await fetch(ordersUrl, {
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`
    }
  });
  const orders = await ordersResp.json();
  
  return {
    success: true,
    orders: (orders || []).map(o => ({
      orderId: o.order_id,
      realName: o.real_name,
      totalCards: o.total_cards,
      totalAmount: o.total_amount,
      status: o.status,
      timestamp: o.timestamp
    }))
  };
}

async function handleCheckDailyFortune(body, supabase) {
  const { phone } = body;
  
  const users = await supabase.query('users', { eq: { phone } });
  if (!users || users.length === 0) {
    return { success: false, hasDrawn: false };
  }
  
  const userId = users[0].id;
  const today = new Date().toISOString().split('T')[0];
  
  const fortuneUrl = `${supabase.url}/rest/v1/lottery?user_id=eq.${userId}&draw_date=gte.${today}&draw_date=lt.${today}T23:59:59&select=*`;
  const fortuneResp = await fetch(fortuneUrl, {
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`
    }
  });
  const fortune = await fortuneResp.json();
  
  if (fortune && fortune.length > 0) {
    return {
      success: true,
      hasDrawn: true,
      result: fortune[0].result
    };
  }
  
  return {
    success: true,
    hasDrawn: false
  };
}

async function handleSaveDailyFortune(body, supabase) {
  const { phone, nickname, result } = body;
  
  const users = await supabase.query('users', { eq: { phone } });
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  
  const lotteryRecord = [{
    user_id: userId,
    draw_date: new Date().toISOString(),
    result: result
  }];
  
  await supabase.insert('lottery', lotteryRecord);
  return { success: true, message: '抽籤結果已儲存' };
}

async function handleCreateShipmentRecord(body, supabase) {
  const { phone, shipmentData } = body;
  
  const users = await supabase.query('users', { eq: { phone } });
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  
  const shipment = [{
    user_id: userId,
    shipment_no: shipmentData.shipmentNo,
    shipment_date: new Date().toISOString(),
    tracking_no: shipmentData.trackingNo,
    items: shipmentData.items,
    status: '已出貨'
  }];
  
  const result = await supabase.insert('shipments', shipment);
  return { success: true, message: '出貨記錄已建立', shipment: result[0] };
}

async function handleGetShipmentRecords(body, supabase) {
  const { phone } = body;
  
  const users = await supabase.query('users', { eq: { phone } });
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  
  const shipmentsUrl = `${supabase.url}/rest/v1/shipments?user_id=eq.${userId}&order=shipment_date.desc&select=*`;
  const shipmentsResp = await fetch(shipmentsUrl, {
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`
    }
  });
  const shipments = await shipmentsResp.json();
  
  return {
    success: true,
    shipments: (shipments || []).map(s => ({
      shipmentNo: s.shipment_no,
      trackingNo: s.tracking_no,
      items: s.items,
      status: s.status,
      shipmentDate: s.shipment_date
    }))
  };
}

async function handleCreateEcpayPayment(body, supabase) {
  try {
    const { orderDetails, totalAmount, phone, nickname, orderIds, itemName, paymentType } = body;
    
    if (!phone || !totalAmount) {
      return { success: false, message: '缺少必要參數：phone 或 totalAmount' };
    }
    
    // 驗證金額
    const amount = Number(totalAmount);
    if (amount < 1 || amount > 20000) {
      return { success: false, message: '測試環境金額範圍: NT$1 - NT$20,000' };
    }
    
    // 先查詢使用者ID（根據phone）- 這必須先做，因為後面需要 user_id
    console.log('[ECPay] 查詢使用者:', phone);
    const users = await supabase.query('users', { eq: { phone: phone } });
    console.log('[ECPay] 查詢結果:', users);
    
    if (!Array.isArray(users) || users.length === 0) {
      console.error('[ECPay] 找不到該電話號碼的使用者:', phone);
      return { success: false, message: '找不到該使用者，請先登入' };
    }
    const userId = users[0].id;
    console.log('[ECPay] 找到使用者:', userId);
    
    // 產生訂單編號
    const merchantTradeNo = 'NC' + Date.now();
    
    // 綠界要求的時間格式: yyyy/MM/dd HH:mm:ss (使用本地時間 GMT+8)
    const now = new Date();
    // 轉換為 GMT+8 時間
    const localTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    const year = localTime.getUTCFullYear();
    const month = String(localTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(localTime.getUTCDate()).padStart(2, '0');
    const hours = String(localTime.getUTCHours()).padStart(2, '0');
    const minutes = String(localTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(localTime.getUTCSeconds()).padStart(2, '0');
    const tradeDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    
    console.log('[ECPay] 產生交易時間:', tradeDate, '(GMT+8)');
    
    // 組合綠界參數
    const ecpayParams = {
      MerchantID: ECPAY_CONFIG.MerchantID,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: tradeDate,
      PaymentType: 'aio',
      TotalAmount: Math.round(amount),
      TradeDesc: 'NingsCard Order',
      ItemName: (itemName || '商品訂單').substring(0, 200),
      ReturnURL: 'https://supabase.cnkuoc.workers.dev/ecpay-callback',  // 綠界付款完成後回調此端點
      ChoosePayment: ECPAY_CONFIG.ChoosePayment,
      EncryptType: ECPAY_CONFIG.EncryptType,
      CustomField1: phone,
      CustomField2: (orderIds || []).join(','),
      ClientBackURL: 'https://supabasedemo-dnd.pages.dev/'  // 客戶返回商店首頁
    };
    
    console.log('[ECPay] 組合參數完成，準備生成 CheckMacValue');
    
    // 生成 CheckMacValue (非同步)
    const checkMacValue = await generateEcpayCheckMacValueAsync(ecpayParams);
    ecpayParams.CheckMacValue = checkMacValue;
    
    console.log('[ECPay] CheckMacValue 生成完成:', checkMacValue.substring(0, 20) + '...');
    
    // 儲存付款記錄到 ecpay_records 表（使用重新命名後的欄位名）
    const paymentRecord = {
      merchant_trade_no: merchantTradeNo,
      user_id: userId,
      trade_amt: amount,
      item_name: itemName || '商品訂單',
      status: 'pending',
      order_details: JSON.stringify(orderDetails || []),
      payment_type: paymentType || 'order',
      order_ids: (orderIds || []).join(','),
      trade_date: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
    
    console.log('[ECPay] 儲存付款記錄到資料庫...');
    console.log('[ECPay] 記錄:', paymentRecord);
    
    try {
      // 使用 fetch 直接插入，比 supabase.insert() 更可靠
      const insertUrl = `${supabase.url}/rest/v1/ecpay_records`;
      console.log('[ECPay] 插入 URL:', insertUrl);
      
      const insertResponse = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'apikey': supabase.apiKey,
          'Authorization': `Bearer ${supabase.apiKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(paymentRecord)
      });
      
      console.log('[ECPay] 插入 HTTP 狀態:', insertResponse.status);
      
      const insertResult = await insertResponse.json();
      console.log('[ECPay] 插入結果類型:', typeof insertResult);
      console.log('[ECPay] 插入結果:', JSON.stringify(insertResult).substring(0, 500));
      
      if (insertResponse.ok) {
        console.log('[ECPay] ✅ 付款記錄已成功儲存到 ecpay_records 表');
      } else {
        console.error('[ECPay] ⚠️ 插入失敗，HTTP ' + insertResponse.status, insertResult);
      }
    } catch (dbError) {
      console.error('[ECPay] ⚠️ 資料庫異常:', dbError.message || JSON.stringify(dbError));
      // 不要 return，繼續生成付款表單
    }
    
    console.log('[ECPay] ✅ 準備返回支付參數');
    
    return {
      success: true,
      paymentUrl: ECPAY_CONFIG.PaymentURL,
      params: ecpayParams,
      merchantTradeNo: merchantTradeNo,
      message: '付款資訊已建立'
    };
  } catch (error) {
    console.error('[ECPay] 建立付款失敗:', error);
    return { success: false, message: '建立付款失敗: ' + error.message };
  }
}

async function handleCheckPaymentStatus(body, supabase) {
  const { merchantTradeNo } = body;
  
  console.log('[Payment] 查詢支付狀態:', merchantTradeNo);
  
  // 使用 fetch 直接查詢，比用 supabase.query() 更可靠
  const queryUrl = `${supabase.url}/rest/v1/ecpay_records?merchant_trade_no=eq.${encodeURIComponent(merchantTradeNo)}&select=*`;
  console.log('[Payment] 查詢 URL:', queryUrl);
  
  const queryResp = await fetch(queryUrl, {
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  const payment = await queryResp.json();
  console.log('[Payment] 查詢結果:', Array.isArray(payment) ? payment.length + '筆' : JSON.stringify(payment).substring(0, 200));
  
  if (payment && Array.isArray(payment) && payment.length > 0) {
    const record = payment[0];
    
    return {
      success: true,
      status: record.status,
      paymentDate: record.payment_date
    };
  }
  
  return { success: false, message: '找不到付款記錄' };
}

async function handleUpdateOrderStatusToPending(body, supabase) {
  const { orderDetails, merchantTradeNo } = body;
  
  if (!orderDetails || orderDetails.length === 0) {
    return { success: false, message: '缺少訂單明細' };
  }
  
  let updatedCount = 0;
  
  try {
    // 遍歷每筆訂單明細，更新狀態為「付款確認中」
    for (const detail of orderDetails) {
      const { nickname, timestamp, item, cardNo } = detail;
      
      // 構建查詢條件
      const updateUrl = `${supabase.url}/rest/v1/orders?item=eq.${encodeURIComponent(item)}&card_no=eq.${encodeURIComponent(cardNo || '')}`;
      
      // 查詢匹配的訂單
      const ordersResp = await fetch(updateUrl, {
        headers: {
          'apikey': supabase.apiKey,
          'Authorization': `Bearer ${supabase.apiKey}`
        }
      });
      const orders = await ordersResp.json();
      
      // 找到符合條件的訂單（需要匹配時間戳記、暱稱）
      if (Array.isArray(orders)) {
        for (const order of orders) {
          // 透過 user_id 查詢用戶暱稱
          const users = await supabase.query('users', { eq: { id: order.user_id } });
          if (users && users.length > 0 && users[0].nickname === nickname) {
            // 時間戳記匹配（轉換為相同格式比較）
            const orderTime = new Date(order.timestamp).toISOString();
            const detailTime = new Date(timestamp).toISOString();
            
            if (orderTime === detailTime) {
              // 更新狀態
              const patchUrl = `${supabase.url}/rest/v1/orders?id=eq.${order.id}`;
              await fetch(patchUrl, {
                method: 'PATCH',
                headers: {
                  'apikey': supabase.apiKey,
                  'Authorization': `Bearer ${supabase.apiKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                  status: '付款確認中'
                })
              });
              
              updatedCount++;
              console.log('[UPDATE_ORDER] ✅ 已更新訂單:', item, cardNo, '狀態 -> 付款確認中');
              break;
            }
          }
        }
      }
    }
    
    console.log('[UPDATE_ORDER] 完成！成功更新 ' + updatedCount + '/' + orderDetails.length + ' 筆');
    
    return {
      success: true,
      message: '已更新 ' + updatedCount + ' 筆訂單狀態為「付款確認中」',
      updatedCount,
      totalRequested: orderDetails.length
    };
  } catch (error) {
    console.error('[UPDATE_ORDER] 錯誤:', error);
    return { success: false, message: '更新失敗: ' + error.toString() };
  }
}

async function handleUpdateBreakStatusToPending(body, supabase) {
  const { breakDetails, orderDetails, merchantTradeNo } = body;
  const details = breakDetails || orderDetails;
  
  if (!details || details.length === 0) {
    return { success: false, message: '缺少團拆明細' };
  }
  
  let updatedCount = 0;
  
  try {
    // 遍歷每筆團拆明細，更新狀態為「付款確認中」
    for (const detail of details) {
      const { nickname, breakId, breakName } = detail;
      
      console.log('[UPDATE_BREAK] 查詢團拆:', breakId, nickname, breakName);
      
      // 構建查詢條件
      let updateUrl = `${supabase.url}/rest/v1/break_records?break_id=eq.${encodeURIComponent(breakId)}`;
      
      // 查詢匹配的團拆記錄
      const breaksResp = await fetch(updateUrl, {
        headers: {
          'apikey': supabase.apiKey,
          'Authorization': `Bearer ${supabase.apiKey}`
        }
      });
      const breaks = await breaksResp.json();
      
      console.log('[UPDATE_BREAK] 查詢到 ' + (Array.isArray(breaks) ? breaks.length : 0) + ' 筆團拆記錄');
      
      // 找到符合條件的團拆記錄
      if (Array.isArray(breaks)) {
        for (const breakRecord of breaks) {
          // 透過 user_id 查詢用戶暱稱
          const users = await supabase.query('users', { eq: { id: breakRecord.user_id } });
          
          if (users && users.length > 0 && users[0].nickname === nickname) {
            // 如果有提供團名，也要匹配
            let breakNameMatch = true;
            if (breakName) {
              breakNameMatch = breakRecord.break_name === breakName;
            }
            
            if (breakNameMatch) {
              // 更新狀態
              const patchUrl = `${supabase.url}/rest/v1/break_records?id=eq.${breakRecord.id}`;
              await fetch(patchUrl, {
                method: 'PATCH',
                headers: {
                  'apikey': supabase.apiKey,
                  'Authorization': `Bearer ${supabase.apiKey}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                  status: '付款確認中'
                })
              });
              
              updatedCount++;
              console.log('[UPDATE_BREAK] ✅ 已更新團拆:', breakId, '狀態 -> 付款確認中');
              break;
            }
          }
        }
      }
    }
    
    console.log('[UPDATE_BREAK] 完成！成功更新 ' + updatedCount + '/' + details.length + ' 筆');
    
    return {
      success: true,
      message: '已更新 ' + updatedCount + ' 筆團拆狀態為「付款確認中」',
      updatedCount,
      totalRequested: details.length
    };
  } catch (error) {
    console.error('[UPDATE_BREAK] 錯誤:', error);
    return { success: false, message: '更新失敗: ' + error.toString() };
  }
}

async function handleUpdateOrderStatusToFailed(body, supabase) {
  const { orderDetails, paymentType } = body;
  
  if (!orderDetails || orderDetails.length === 0) {
    return { success: false, message: '缺少訂單明細' };
  }
  
  let updatedCount = 0;
  
  try {
    if (paymentType === 'order') {
      // 更新訂單狀態為「付款失敗」
      for (const detail of orderDetails) {
        const { id } = detail;
        
        if (!id) {
          console.warn('[UPDATE_ORDER_FAILED] ⚠️ 訂單缺少 ID');
          continue;
        }
        
        console.log('[UPDATE_ORDER_FAILED] 準備更新訂單 ' + id + ' 為「付款失敗」');
        
        // 直接用 ID 更新訂單
        const updateUrl = `${supabase.url}/rest/v1/orders?id=eq.${id}`;
        const patchResp = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'apikey': supabase.apiKey,
            'Authorization': `Bearer ${supabase.apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            status: '付款失敗'
          })
        });
        
        if (patchResp.ok) {
          updatedCount++;
          console.log('[UPDATE_ORDER_FAILED] ✅ 訂單 ' + id + ' 已更新為「付款失敗」');
        } else {
          console.error('[UPDATE_ORDER_FAILED] ❌ 更新訂單 ' + id + ' 失敗: HTTP ' + patchResp.status);
        }
      }
    } else if (paymentType === 'break') {
      // 更新團拆狀態為「付款失敗」
      for (const detail of orderDetails) {
        const { id, breakId } = detail;
        const targetId = breakId || id;
        
        if (!targetId) {
          console.warn('[UPDATE_BREAK_FAILED] ⚠️ 團拆缺少 ID');
          continue;
        }
        
        console.log('[UPDATE_BREAK_FAILED] 準備更新團拆 ' + targetId + ' 為「付款失敗」');
        
        // 直接用 ID 更新團拆
        const updateUrl = `${supabase.url}/rest/v1/group_breaks?id=eq.${targetId}`;
        const patchResp = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'apikey': supabase.apiKey,
            'Authorization': `Bearer ${supabase.apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            status: '付款失敗'
          })
        });
        
        if (patchResp.ok) {
          updatedCount++;
          console.log('[UPDATE_BREAK_FAILED] ✅ 團拆 ' + targetId + ' 已更新為「付款失敗」');
        } else {
          console.error('[UPDATE_BREAK_FAILED] ❌ 更新團拆 ' + targetId + ' 失敗: HTTP ' + patchResp.status);
        }
      }
    }
    
    console.log('[UPDATE_FAILED] 完成！成功更新 ' + updatedCount + '/' + orderDetails.length + ' 筆');
    
    return {
      success: true,
      message: '已更新 ' + updatedCount + ' 筆' + (paymentType === 'order' ? '訂單' : '團拆') + '狀態為「付款失敗」',
      updatedCount,
      totalRequested: orderDetails.length
    };
  } catch (error) {
    console.error('[UPDATE_FAILED] 錯誤:', error);
    return { success: false, message: '更新失敗: ' + error.toString() };
  }
}

async function handleVerifyData(body, supabase) {
  const results = {};
  
  try {
    console.log('[VERIFY] Starting data verification...');
    
    // 1. 檢查所有資料表筆數
    const tables = [
      'users',
      'product_catalog', 
      'orders',
      'break_records',
      'notifications',
      'psa_orders',
      'break_credits',
      'daily_fortunes'
    ];
    
    results.tableCounts = {};
    for (const table of tables) {
      const data = await supabase.query(table, {});
      results.tableCounts[table] = Array.isArray(data) ? data.length : 0;
      console.log('[VERIFY] ' + table + ': ' + results.tableCounts[table] + ' rows');
    }
    
    // 2. 檢查 users 範例
    const users = await supabase.query('users', {});
    if (Array.isArray(users) && users.length > 0) {
      results.usersSample = users.slice(0, 2).map(u => ({
        phone: u.phone,
        nickname: u.nickname,
        birthday: u.birthday,
        birthdayType: typeof u.birthday
      }));
      results.usersFields = Object.keys(users[0]);
    }
    
    // 3. 檢查 product_catalog 範例
    const products = await supabase.query('product_catalog', {});
    if (Array.isArray(products) && products.length > 0) {
      results.productsSample = products.slice(0, 2).map(p => ({
        item_name: p.item_name,
        category: p.category,
        is_box_preorder: p.is_box_preorder,
        is_box_type: typeof p.is_box_preorder,
        total_quantity: p.total_quantity,
        current_quantity: p.current_quantity,
        close_time: p.close_time
      }));
      results.productsFields = Object.keys(products[0]);
      
      // 統計分類
      const categories = {};
      const boxCount = { true: 0, false: 0, other: 0 };
      products.forEach(p => {
        categories[p.category] = (categories[p.category] || 0) + 1;
        if (p.is_box_preorder === 'true') boxCount.true++;
        else if (p.is_box_preorder === 'false') boxCount.false++;
        else boxCount.other++;
      });
      results.productStats = { categories, boxCount };
    }
    
    // 4. 檢查 orders 範例
    const orders = await supabase.query('orders', {});
    if (Array.isArray(orders) && orders.length > 0) {
      results.ordersSample = orders.slice(0, 2).map(o => ({
        phone: o.phone,
        nickname: o.nickname,
        item_name: o.item_name,
        user_id: o.user_id,
        has_user_id: !!o.user_id,
        is_cleared: o.is_cleared,
        is_shipped: o.is_shipped,
        order_date: o.order_date
      }));
      results.ordersFields = Object.keys(orders[0]);
      
      // 統計 user_id
      let hasUserId = 0;
      let noUserId = 0;
      orders.forEach(o => {
        if (o.user_id) hasUserId++;
        else noUserId++;
      });
      results.orderStats = { hasUserId, noUserId, total: orders.length };
    }
    
    // 5. 檢查特定用戶訂單
    const phone = '0975313096';
    const userOrders = await supabase.query('orders', { eq: { user_id: users[0].id } });
    results.testUserOrders = {
      phone,
      count: Array.isArray(userOrders) ? userOrders.length : 0,
      sample: Array.isArray(userOrders) && userOrders.length > 0 ? userOrders.slice(0, 2).map(o => ({
        item_name: o.item_name,
        quantity: o.quantity,
        order_date: o.order_date
      })) : []
    };
    
    console.log('[VERIFY] Verification completed successfully');
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      results
    };
    
  } catch (error) {
    console.error('[VERIFY] Error:', error);
    return {
      success: false,
      error: error.message,
      partialResults: results
    };
  }
}

// ==================== Worker 入口 (只處理 API) ====================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // ==================== 綠界回調路由 ====================
    if (request.method === 'POST' && url.pathname === '/ecpay-callback') {
      try {
        const supabaseUrl = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
        const supabaseKey = env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
        const supabase = new SupabaseClient(supabaseUrl, supabaseKey);
        
        let params = {};
        const contentType = request.headers.get('content-type') || '';
        
        console.log('[ECPay Callback] Content-Type:', contentType);
        
        // 綠界回調總是用 form-urlencoded
        if (contentType.includes('application/x-www-form-urlencoded')) {
          const text = await request.text();
          console.log('[ECPay Callback] 收到原始文本:', text.substring(0, 100));
          
          const formData = new URLSearchParams(text);
          for (const [key, value] of formData.entries()) {
            params[key] = value;
          }
          console.log('[ECPay Callback] 解析後參數數量:', Object.keys(params).length);
        } else if (contentType.includes('application/json')) {
          // 備用：如果是 JSON 格式
          params = await request.json();
        } else {
          // 如果沒有指定 Content-Type，試著當成 form 處理
          const text = await request.text();
          if (text) {
            const formData = new URLSearchParams(text);
            for (const [key, value] of formData.entries()) {
              params[key] = value;
            }
          }
        }
        
        console.log('[ECPay Callback] 開始處理回調');
        
        const result = await handleEcpayCallback(params, supabase);
        
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (error) {
        console.error('[ECPay Callback] 錯誤:', error.message || error);
        return new Response(JSON.stringify({ success: false, message: error.message }), {
          status: 200,  // 返回 200 讓綠界知道我們收到了
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/api') {
      return handleAPI(request, env);
    }

    return new Response('Not Found', { status: 404 });
  }
};

// ===== 🌟 後台管理 API 函數 =====

async function handleAdminLogin(body, supabase) {
  const { password } = body;
  const ADMIN_PASSWORD = 'ning123'; // 🔑 管理員密碼（應放在環境變數）
  
  if (password === ADMIN_PASSWORD) {
    return { success: true, message: '登入成功', token: 'admin_token_' + Date.now() };
  } else {
    return { success: false, message: '密碼錯誤' };
  }
}

async function handleGetNotifications(body, supabase) {
  const { limit = 50, offset = 0 } = body;
  
  const headers = {
    'apikey': supabase.apiKey,
    'Authorization': `Bearer ${supabase.apiKey}`,
    'Content-Type': 'application/json'
  };
  
  // 直接查詢 notifications 表並關聯 users 表取得暱稱
  const queryUrl = `${supabase.url}/rest/v1/notifications?select=*,users:user_id(nickname,phone)&order=sent_at.desc&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(queryUrl, { headers });
  const notifications = await response.json();
  
  if (!Array.isArray(notifications)) {
    return { success: true, notifications: [], count: 0 };
  }
  
  // 對每個 notification 查詢該筆通知勾選的訂單
  const enrichedNotifications = await Promise.all(
    notifications.map(async (notif) => {
      try {
        const content = JSON.parse(notif.content || '{}');
        
        let relatedOrders = [];
        let relatedBreaks = [];
        
        // 🌟 根據 paymentType 查詢相關資料
        if (content.paymentType === 'break') {
          // 團拆通知 - 查詢團拆資料
          if (content.breakIds && typeof content.breakIds === 'string') {
            const breakIds = content.breakIds
              .split('||')
              .filter(id => id && id.trim())
              .map(id => id.trim());
            
            console.log('[getNotifications] 通知 ID:', notif.id, '找到團拆 ID:', breakIds);
            
            if (breakIds.length > 0) {
              try {
                // 🔥 使用 break_id + user_id 查詢團拆（重點：加上user_id過濾以區分不同用戶的同名團拆！）
                const breakQueryUrl = `${supabase.url}/rest/v1/breaks?break_id=in.(${breakIds.map(id => `"${encodeURIComponent(id)}"`).join(',')})&user_id=eq.${notif.user_id}`;
                
                const breaksResponse = await fetch(breakQueryUrl, { headers });
                relatedBreaks = await breaksResponse.json();
                
                console.log('[getNotifications] 團拆查詢結果:', relatedBreaks, '(user_id:', notif.user_id, ')');
                
                if (!Array.isArray(relatedBreaks)) {
                  relatedBreaks = [];
                }
              } catch (breakErr) {
                console.error('[getNotifications] 查詢團拆異常:', breakErr);
                relatedBreaks = [];
              }
            }
          }
        } else {
          // 訂單通知 - 查詢訂單資料
          if (content.orderIds && typeof content.orderIds === 'string') {
            // 用 || 分隔符
            const selectedOrderIds = content.orderIds
              .split('||')
              .filter(id => id && id.trim())
              .map(id => id.trim());
            
            console.log('[getNotifications] 通知 ID:', notif.id, '找到訂單 ID:', selectedOrderIds);
            
            if (selectedOrderIds && selectedOrderIds.length > 0) {
              try {
                // 查詢這些特定的訂單
                const orderIdsStr = selectedOrderIds.join(',');
                const ordersUrl = `${supabase.url}/rest/v1/orders?id=in.(${orderIdsStr})`;
                
                console.log('[getNotifications] 查詢 URL:', ordersUrl);
                
                const ordersResponse = await fetch(ordersUrl, { headers });
                relatedOrders = await ordersResponse.json();
                
                console.log('[getNotifications] 訂單查詢結果:', relatedOrders);
                
                if (!Array.isArray(relatedOrders)) {
                  relatedOrders = [];
                }
              } catch (orderErr) {
                console.error('[getNotifications] 查詢訂單異常:', orderErr);
                relatedOrders = [];
              }
            }
          }
        }
        
        return {
          ...notif,
          nickname: notif.users?.nickname || '未知',
          phone: notif.users?.phone || '',
          relatedOrders: relatedOrders,
          relatedBreaks: relatedBreaks,
          contentParsed: content
        };
      } catch (err) {
        console.error('Error enriching notification:', err);
        return { 
          ...notif, 
          nickname: '未知', 
          phone: '', 
          relatedOrders: [],
          contentParsed: {}
        };
      }
    })
  );
  
  return { 
    success: true, 
    notifications: enrichedNotifications,
    count: enrichedNotifications.length
  };
}

async function handleUpdateNotification(body, supabase) {
  const { id, status } = body;
  
  const updateUrl = `${supabase.url}/rest/v1/notifications?id=eq.${id}`;
  
  const response = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: status })
  });
  
  const result = await response.json();
  
  if (response.ok) {
    return { success: true, message: '更新成功' };
  } else {
    return { success: false, message: '更新失敗: ' + (result.message || result.details) };
  }
}

async function handleDeleteNotification(body, supabase) {
  const { id } = body;
  
  const deleteUrl = `${supabase.url}/rest/v1/notifications?id=eq.${id}`;
  
  const response = await fetch(deleteUrl, {
    method: 'DELETE',
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`
    }
  });
  
  if (response.ok) {
    return { success: true, message: '刪除成功' };
  } else {
    return { success: false, message: '刪除失敗' };
  }
}

async function handleSearchOrders(body, supabase) {
  const { phone, nickname, item, limit = 50, offset = 0 } = body;
  
  console.log('[handleSearchOrders] 搜尋參數:', { phone, nickname, item });
  
  try {
    // 先查詢所有訂單
    let queryUrl = `${supabase.url}/rest/v1/orders?select=*&order=timestamp.desc&limit=1000`;
    const headers = {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    const response = await fetch(queryUrl, { headers });
    const allOrders = await response.json();
    
    console.log('[handleSearchOrders] 找到 ' + (Array.isArray(allOrders) ? allOrders.length : 0) + ' 筆訂單');
    
    if (!Array.isArray(allOrders)) {
      return { success: true, orders: [], count: 0 };
    }
    
    // 如果需要按 phone 或 nickname 搜尋，需要 JOIN 用戶資料
    let filtered = allOrders;
    
    if (phone || nickname) {
      // 查詢所有用戶
      const userQueryUrl = `${supabase.url}/rest/v1/users?select=*&limit=1000`;
      const userResponse = await fetch(userQueryUrl, { headers });
      const allUsers = await userResponse.json();
      const userMap = new Map();
      
      if (Array.isArray(allUsers)) {
        allUsers.forEach(u => {
          userMap.set(u.id, u);
        });
      }
      
      console.log('[handleSearchOrders] 載入 ' + userMap.size + ' 個用戶資料');
      
      // 用戶端 JOIN：為訂單添加用戶信息
      filtered = filtered.map(o => ({
        ...o,
        nickname: userMap.get(o.user_id)?.nickname || o.nickname || '',
        phone: userMap.get(o.user_id)?.phone || o.phone || ''
      }));
      
      // 按 phone 或 nickname 過濾
      if (phone) {
        filtered = filtered.filter(o => o.phone && o.phone.toString().includes(phone.toString()));
      }
      
      if (nickname) {
        filtered = filtered.filter(o => o.nickname && o.nickname.toLowerCase().includes(nickname.toLowerCase()));
      }
    }
    
    // 按 item 過濾
    if (item) {
      filtered = filtered.filter(o => o.item && o.item.toLowerCase().includes(item.toLowerCase()));
    }
    
    console.log('[handleSearchOrders] 過濾後找到 ' + filtered.length + ' 筆訂單');
    
    return { 
      success: true, 
      orders: filtered.slice(offset, offset + limit),
      count: filtered.length
    };
  } catch (error) {
    console.error('[handleSearchOrders] 錯誤:', error);
    return { success: false, message: '搜尋失敗: ' + error.message };
  }
}

async function handleSearchUsers(body, supabase) {
  const { phone, nickname, limit = 50, offset = 0 } = body;
  
  console.log('[handleSearchUsers] 搜尋參數:', { phone, nickname });
  
  try {
    // 查詢所有用戶
    const queryUrl = `${supabase.url}/rest/v1/users?select=*&limit=1000`;
    const headers = {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    const response = await fetch(queryUrl, { headers });
    const allUsers = await response.json();
    
    console.log('[handleSearchUsers] 找到 ' + (Array.isArray(allUsers) ? allUsers.length : 0) + ' 個用戶');
    
    if (!Array.isArray(allUsers)) {
      return { success: true, users: [], count: 0 };
    }
    
    // 用戶端過濾
    let filtered = allUsers;
    
    if (phone) {
      filtered = filtered.filter(u => u.phone && u.phone.toString().includes(phone.toString()));
    }
    
    if (nickname) {
      filtered = filtered.filter(u => u.nickname && u.nickname.toLowerCase().includes(nickname.toLowerCase()));
    }
    
    console.log('[handleSearchUsers] 過濾後找到 ' + filtered.length + ' 個用戶');
    
    // 去重（以 id 為基準）
    const uniqueUsers = Array.from(new Map(filtered.map(u => [u.id, u])).values());
    
    return { 
      success: true, 
      users: uniqueUsers.slice(offset, offset + limit),
      count: uniqueUsers.length
    };
  } catch (error) {
    console.error('[handleSearchUsers] 錯誤:', error);
    return { success: false, message: '搜尋失敗: ' + error.message };
  }
}

async function handleUpdateOrder(body, supabase) {
  try {
    const { id, status, balance, balance_amount, notes } = body;
    
    const updateData = {};
    if (status) updateData.status = status;
    // 同時支持 balance 和 balance_amount，優先使用傳入的任一個
    if (balance !== undefined) updateData.balance_amount = balance;
    if (balance_amount !== undefined) updateData.balance_amount = balance_amount;
    if (notes) updateData.notes = notes;
    updateData.updated_at = new Date().toISOString();
    
    console.log('[handleUpdateOrder] 更新訂單:', { id, ...updateData });
    
    const updateUrl = `${supabase.url}/rest/v1/orders?id=eq.${id}`;
    
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': supabase.apiKey,
        'Authorization': `Bearer ${supabase.apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'  // 讓 Supabase 返回更新後的資料
      },
      body: JSON.stringify(updateData)
    });
    
    console.log('[handleUpdateOrder] HTTP 狀態:', response.status);
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('[handleUpdateOrder] ✅ 更新成功，返回:', result);
      // 返回更新後的訂單（Supabase 在 Prefer: return=representation 時會返回陣列）
      const updatedOrder = Array.isArray(result) && result.length > 0 ? result[0] : result;
      return { 
        success: true, 
        message: '訂單更新成功',
        order: updatedOrder 
      };
    } else {
      console.error('[handleUpdateOrder] ❌ 更新失敗:', result);
      return { success: false, message: '更新失敗: ' + (result.message || result.details || '未知錯誤') };
    }
  } catch (error) {
    console.error('[handleUpdateOrder] 異常:', error);
    return { success: false, message: '更新異常: ' + error.message };
  }
}

async function handleGetUsers(body, supabase) {
  const { limit = 100, offset = 0 } = body;
  
  try {
    // 直接查詢用戶表
    const queryUrl = `${supabase.url}/rest/v1/users?select=*&limit=${limit}&offset=${offset}&order=created_at.desc`;
    const headers = {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    const response = await fetch(queryUrl, { headers });
    const users = await response.json();
    
    if (!Array.isArray(users)) {
      return { success: true, users: [], count: 0 };
    }
    
    // 去重（以 id 為基準）
    const uniqueUsers = Array.from(new Map(users.map(u => [u.id, u])).values());
    
    return { 
      success: true, 
      users: uniqueUsers,
      count: uniqueUsers.length
    };
  } catch (error) {
    console.error('[handleGetUsers] 錯誤:', error);
    return { success: false, message: '載入失敗: ' + error.message };
  }
}

async function handleUpdateUser(body, supabase) {
  const { phone, nickname, email, address, real_name } = body;
  
  const updateData = {};
  if (nickname) updateData.nickname = nickname;
  if (email) updateData.email = email;
  if (address) updateData.address = address;
  if (real_name) updateData.real_name = real_name;
  
  const updateUrl = `${supabase.url}/rest/v1/users?phone=eq.${phone}`;
  
  const response = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updateData)
  });
  
  const result = await response.json();
  
  if (response.ok) {
    return { success: true, message: '用戶更新成功' };
  } else {
    return { success: false, message: '更新失敗: ' + (result.message || result.details) };
  }
}

async function handleAddProduct(body, supabase) {
  const { 
    item_name, card_no, price, threshold_price, is_available, 
    is_box_preorder, stock_status, description 
  } = body;
  
  const productData = {
    item_name: item_name,
    card_no: card_no,
    price: Number(price),
    threshold_price: Number(threshold_price) || 0,
    is_available: is_available || 'Y',
    is_box_preorder: is_box_preorder ? 'true' : 'false',
    stock_status: stock_status || 'P',
    description: description || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const insertUrl = `${supabase.url}/rest/v1/product_catalog`;
  
  const response = await fetch(insertUrl, {
    method: 'POST',
    headers: {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(productData)
  });
  
  const result = await response.json();
  
  if (response.ok) {
    return { success: true, message: '商品新增成功' };
  } else {
    return { success: false, message: '新增失敗: ' + (result.message || result.details) };
  }
}

async function handleCleanupDuplicateUsers(body, supabase) {
  const { adminPassword } = body;
  
  // 驗證密碼
  if (adminPassword !== 'ning123') {
    return { success: false, message: '密碼錯誤' };
  }
  
  try {
    console.log('[cleanupDuplicateUsers] 開始清理 password 為 NULL 的重複用戶...');
    
    const headers = {
      'apikey': supabase.apiKey,
      'Authorization': `Bearer ${supabase.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    // 第一步：查詢所有 password 為 NULL 的用戶
    const queryUrl = `${supabase.url}/rest/v1/users?select=id,phone,password&password=is.null&limit=1000`;
    const response = await fetch(queryUrl, { headers });
    const nullPasswordUsers = await response.json();
    
    console.log('[cleanupDuplicateUsers] 找到 ' + (Array.isArray(nullPasswordUsers) ? nullPasswordUsers.length : 0) + ' 個 password 為 NULL 的用戶');
    
    if (!Array.isArray(nullPasswordUsers) || nullPasswordUsers.length === 0) {
      return { success: true, message: '沒有需要清理的用戶', deletedUsers: 0, deletedShipments: 0 };
    }
    
    const idsToDelete = nullPasswordUsers.map(u => u.id);
    
    // 第二步：一次性查詢所有相關的記錄
    const inClause = idsToDelete.join(',');
    
    // 刪除 shipments 記錄
    console.log('[cleanupDuplicateUsers] 刪除相關 shipments 記錄...');
    const deleteShipmentsUrl = `${supabase.url}/rest/v1/shipments?user_id=in.(${inClause})`;
    const deleteShipmentsResponse = await fetch(deleteShipmentsUrl, {
      method: 'DELETE',
      headers
    });
    
    let deletedShipments = 0;
    if (deleteShipmentsResponse.ok) {
      const contentRange = deleteShipmentsResponse.headers.get('content-range');
      deletedShipments = contentRange ? parseInt(contentRange.split('/')[1]) : 0;
      console.log('[cleanupDuplicateUsers] 已刪除 ' + deletedShipments + ' 個 shipments 記錄');
    } else {
      const errorText = await deleteShipmentsResponse.text();
      console.error('[cleanupDuplicateUsers] 刪除 shipments 失敗:', errorText);
      throw new Error('刪除出貨記錄失敗: ' + errorText);
    }
    
    // 刪除 lottery 記錄
    console.log('[cleanupDuplicateUsers] 刪除相關 lottery 記錄...');
    const deleteLotteryUrl = `${supabase.url}/rest/v1/lottery?user_id=in.(${inClause})`;
    const deleteLotteryResponse = await fetch(deleteLotteryUrl, {
      method: 'DELETE',
      headers
    });
    
    let deletedLottery = 0;
    if (deleteLotteryResponse.ok) {
      const contentRange = deleteLotteryResponse.headers.get('content-range');
      deletedLottery = contentRange ? parseInt(contentRange.split('/')[1]) : 0;
      console.log('[cleanupDuplicateUsers] 已刪除 ' + deletedLottery + ' 個 lottery 記錄');
    } else {
      const errorText = await deleteLotteryResponse.text();
      console.warn('[cleanupDuplicateUsers] 刪除 lottery 記錄失敗（可能不存在此表）:', errorText);
    }
    
    // 刪除 notifications 記錄
    console.log('[cleanupDuplicateUsers] 刪除相關 notifications 記錄...');
    const deleteNotificationsUrl = `${supabase.url}/rest/v1/notifications?user_id=in.(${inClause})`;
    const deleteNotificationsResponse = await fetch(deleteNotificationsUrl, {
      method: 'DELETE',
      headers
    });
    
    let deletedNotifications = 0;
    if (deleteNotificationsResponse.ok) {
      const contentRange = deleteNotificationsResponse.headers.get('content-range');
      deletedNotifications = contentRange ? parseInt(contentRange.split('/')[1]) : 0;
      console.log('[cleanupDuplicateUsers] 已刪除 ' + deletedNotifications + ' 個 notifications 記錄');
    } else {
      const errorText = await deleteNotificationsResponse.text();
      console.warn('[cleanupDuplicateUsers] 刪除 notifications 記錄失敗:', errorText);
    }
    
    // 第三步：刪除所有 password 為 NULL 的用戶（一次性）
    console.log('[cleanupDuplicateUsers] 刪除用戶...');
    const deleteUsersUrl = `${supabase.url}/rest/v1/users?id=in.(${inClause})`;
    const deleteUsersResponse = await fetch(deleteUsersUrl, {
      method: 'DELETE',
      headers
    });
    
    if (!deleteUsersResponse.ok) {
      const errorText = await deleteUsersResponse.text();
      console.error('[cleanupDuplicateUsers] 刪除用戶失敗:', errorText);
      throw new Error('刪除用戶失敗: ' + errorText);
    }
    
    const deletedUsers = idsToDelete.length;
    console.log('[cleanupDuplicateUsers] 清理完成，共刪除 ' + deletedUsers + ' 個用戶和 ' + deletedShipments + ' 個出貨記錄');
    
    return { 
      success: true, 
      message: '清理完成！已刪除 ' + deletedUsers + ' 個重複用戶和 ' + deletedShipments + ' 個相關出貨記錄',
      deletedUsers: deletedUsers,
      deletedShipments: deletedShipments
    };
  } catch (error) {
    console.error('[cleanupDuplicateUsers] 錯誤:', error);
    return { success: false, message: '清理失敗: ' + error.message };
  }
}

// ==================== 團拆管理 API ====================

async function handleGetAllBreaks(body, supabase) {
  try {
    console.log('[getAllBreaks] 查詢所有團拆');
    
    const breaksData = await supabase.query('breaks', { order: { column: 'created_at', ascending: false } });
    
    if (!Array.isArray(breaksData)) {
      return { success: false, message: '查詢失敗' };
    }
    
    console.log('[getAllBreaks] 共找到 ' + breaksData.length + ' 筆團拆');
    
    return { 
      success: true, 
      breaks: breaksData || []
    };
  } catch (error) {
    console.error('[getAllBreaks] 錯誤:', error);
    return { success: false, message: '查詢失敗: ' + error.message };
  }
}

async function handleUpdateBreak(body, supabase) {
  const { id, status, paid } = body;
  
  if (!id) {
    return { success: false, message: '缺少團拆 ID' };
  }
  
  try {
    console.log('[updateBreak] 更新團拆 ID: ' + id);
    
    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (paid !== undefined) updateData.paid = parseFloat(paid);
    
    const updateUrl = `${supabase.url}/rest/v1/breaks?id=eq.${id}`;
    
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': supabase.apiKey,
        'Authorization': `Bearer ${supabase.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[updateBreak] HTTP 錯誤:', response.status, errorText);
      return { success: false, message: '更新失敗: ' + response.statusText };
    }
    
    const result = await response.json();
    console.log('[updateBreak] 更新成功:', JSON.stringify(updateData));
    
    return { 
      success: true, 
      message: '團拆已更新',
      break: result[0] || {}
    };
  } catch (error) {
    console.error('[updateBreak] 錯誤:', error);
    return { success: false, message: '更新失敗: ' + error.message };
  }
}

// ==================== 💳 綠界金流工具函式 ====================

/**
 * 生成綠界 CheckMacValue (非同步版本)
 */
async function generateEcpayCheckMacValue(params) {
  try {
    // 1. 移除 CheckMacValue
    const paramsCopy = { ...params };
    delete paramsCopy.CheckMacValue;
    
    // 2. 參數名稱排序
    const keys = Object.keys(paramsCopy).sort();
    
    // 3. 組合成 query string（不含 & 和 =）
    let data = '';
    for (const key of keys) {
      data += key + '=' + paramsCopy[key];
      data += '&';
    }
    
    // 4. 前後加入 HashKey 和 HashIV
    const hashKey = ECPAY_CONFIG.HashKey;
    const hashIV = ECPAY_CONFIG.HashIV;
    
    // 5. URL encode
    const urlEncoded = encodeURIComponent(data)
      .replace(/'/g, '%27')
      .replace(/\*/g, '%2A')
      .replace(/~/g, '%7E')
      .replace(/\+/g, '%20');
    
    const dataToHash = 'HashKey=' + hashKey + '&' + urlEncoded + '&HashIV=' + hashIV;
    
    // 6. SHA256 加密 (非同步)
    const hash = await SHA256(dataToHash);
    
    // 7. 轉大寫
    return hash.toUpperCase();
  } catch (error) {
    console.error('[ECPay] CheckMacValue 生成失敗:', error);
    throw error;
  }
}

/**
 * SHA256 雜湊函式（簡化版，使用 crypto API）
 */
async function SHA256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * 綠界回調處理（異步版本，用於 Cloudflare Workers）
 */
async function handleEcpayCallback(params, supabase) {
  try {
    console.log('[ECPay Callback] 開始處理回調');
    console.log('[ECPay Callback] 收到參數數量:', Object.keys(params).length);
    
    console.log('[ECPay] 回調參數:', {
      MerchantTradeNo: params.MerchantTradeNo,
      RtnCode: params.RtnCode,
      RtnMsg: params.RtnMsg,
      TradeNo: params.TradeNo,
      CheckMacValue: params.CheckMacValue ? '已收到' : '缺少'
    });
    
    // 檢查必要參數
    if (!params.MerchantTradeNo || !params.RtnCode) {
      console.error('[ECPay] 缺少必要參數');
      return { success: false, message: '缺少必要參數' };
    }
    
    // 驗證 CheckMacValue
    const receivedCheckMac = params.CheckMacValue;
    if (!receivedCheckMac) {
      console.error('[ECPay] 缺少 CheckMacValue');
      return { success: false, message: '缺少 CheckMacValue' };
    }
    
    const paramsCopy = { ...params };
    delete paramsCopy.CheckMacValue;
    
    console.log('[ECPay] 準備驗證 CheckMacValue，參數:', Object.keys(paramsCopy).sort().join(','));
    
    const calculatedCheckMac = await generateEcpayCheckMacValueAsync(paramsCopy);
    
    console.log('[ECPay] CheckMacValue 比對:');
    console.log('  收到:  ', receivedCheckMac);
    console.log('  計算:  ', calculatedCheckMac);
    
    if (receivedCheckMac !== calculatedCheckMac) {
      console.error('[ECPay] ❌ CheckMacValue 驗證失敗!');
      return { success: false, message: 'CheckMacValue 驗證失敗' };
    }
    
    console.log('[ECPay] ✅ CheckMacValue 驗證成功');
    
    const merchantTradeNo = params.MerchantTradeNo;
    const rtnCode = params.RtnCode;
    const tradeNo = params.TradeNo;
    const paymentDate = params.PaymentDate;
    
    // 查詢現有的付款記錄
    console.log('[ECPay] 查詢付款記錄:', merchantTradeNo);
    
    // 使用 fetch 直接查詢，比用 supabase.query() 更可靠
    const queryUrl = `${supabase.url}/rest/v1/ecpay_records?merchant_trade_no=eq.${encodeURIComponent(merchantTradeNo)}&select=*`;
    console.log('[ECPay] 查詢 URL:', queryUrl);
    
    const queryResp = await fetch(queryUrl, {
      headers: {
        'apikey': supabase.apiKey,
        'Authorization': `Bearer ${supabase.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const records = await queryResp.json();
    console.log('[ECPay] 查詢結果類型:', typeof records);
    console.log('[ECPay] 查詢結果:', Array.isArray(records) ? records.length + '筆' : JSON.stringify(records).substring(0, 200));
    
    if (!Array.isArray(records) || records.length === 0) {
      console.error('[ECPay] 找不到付款記錄:', merchantTradeNo);
      console.error('[ECPay] 查詢結果:', records);
      return { success: false, message: '找不到付款記錄' };
    }
    
    const record = records[0];
    console.log('[ECPay] 找到付款記錄，user_id:', record.user_id);
    
    // 更新付款記錄狀態
    const updateUrl = `${supabase.url}/rest/v1/ecpay_records?merchant_trade_no=eq.${encodeURIComponent(merchantTradeNo)}`;
    console.log('[ECPay] 更新 URL:', updateUrl);
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'apikey': supabase.apiKey,
        'Authorization': `Bearer ${supabase.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: rtnCode === '1' ? 'success' : 'failed',
        trade_no: tradeNo,
        payment_date: paymentDate,
        trade_amt: params.Amt || params.TotalAmount,
        updated_at: new Date().toISOString()
      })
    });
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('[ECPay] 更新付款記錄失敗:', updateResponse.status, errorText);
      return { success: false, message: '更新記錄失敗: ' + errorText };
    }
    
    // 安全地讀取 JSON，可能為空
    let updateResult = {};
    const responseText = await updateResponse.text();
    if (responseText) {
      try {
        updateResult = JSON.parse(responseText);
      } catch (e) {
        console.warn('[ECPay] 更新結果不是有效 JSON:', responseText.substring(0, 100));
      }
    }
    console.log('[ECPay] ✅ 付款記錄已更新，狀態:', rtnCode === '1' ? 'success' : 'failed');
    
    // 如果付款成功，更新訂單狀態並保存通知
    if (rtnCode === '1') {
      // 從 user_id 查詢使用者資訊
      const userInfo = await supabase.query('users', { eq: { id: record.user_id } });
      const user = Array.isArray(userInfo) && userInfo.length > 0 ? userInfo[0] : {};
      
      // 解析 order_details 並更新對應的訂單
      try {
        let orderDetailsArray = [];
        if (record.order_details) {
          if (typeof record.order_details === 'string') {
            orderDetailsArray = JSON.parse(record.order_details);
          } else {
            orderDetailsArray = record.order_details;
          }
        }
        
        console.log('[ECPay] 開始更新訂單，數量:', orderDetailsArray.length);
        console.log('[ECPay] order_ids:', record.order_ids);
        console.log('[ECPay] payment_type:', record.payment_type);
        
        // 判斷付款類型：order 或 break
        const paymentType = record.payment_type || 'order';
        
        if (paymentType === 'order') {
          // 訂單付款：根據 order_ids（UUID）更新 orders 表
          const orderIds = record.order_ids ? record.order_ids.split(',').map(id => id.trim()) : [];
          console.log('[ECPay] 進入訂單更新分支，要更新的訂單 IDs:', orderIds);
          
          for (const orderId of orderIds) {
            if (!orderId) {
              console.log('[ECPay] ⚠️ 跳過空的 orderId');
              continue;
            }
            
            console.log('[ECPay] 開始更新訂單 ID:', orderId);
            
            // 直接用訂單 ID 查詢
            const matchingOrders = await supabase.query('orders', { eq: { id: orderId } });
            console.log('[ECPay] 查詢訂單結果:', Array.isArray(matchingOrders) ? `找到 ${matchingOrders.length} 筆` : '非陣列');
            
            if (Array.isArray(matchingOrders) && matchingOrders.length > 0) {
              const order = matchingOrders[0];
              console.log('[ECPay] ✅ 找到訂單:', orderId, '原狀態:', order.status, '原尾款:', order.balance_amount);
              
              // 更新訂單：設置尾款為 0，狀態為已付款
              const updateOrderUrl = `${supabase.url}/rest/v1/orders?id=eq.${orderId}`;
              console.log('[ECPay] 準備更新 URL:', updateOrderUrl);
              
              const orderUpdateResponse = await fetch(updateOrderUrl, {
                method: 'PATCH',
                headers: {
                  'apikey': supabase.apiKey,
                  'Authorization': `Bearer ${supabase.apiKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  balance_amount: 0,
                  status: '已付款',
                  updated_at: new Date().toISOString()
                })
              });
              
              console.log('[ECPay] 訂單更新 HTTP 狀態:', orderUpdateResponse.status);
              
              if (orderUpdateResponse.ok) {
                console.log('[ECPay] ✅ 訂單已更新 - ID:', orderId, '尾款設為 0，狀態改為：已付款');
              } else {
                const errorText = await orderUpdateResponse.text();
                console.error('[ECPay] ❌ 訂單更新失敗:', orderId, 'HTTP', orderUpdateResponse.status, '錯誤:', errorText);
              }
            } else {
              console.warn('[ECPay] ⚠️ 找不到訂單 ID:', orderId, '查詢結果:', matchingOrders);
            }
          }
        } else if (paymentType === 'break') {
          // 團拆付款：根據 breakIds 更新 group_breaks 表
          const breakIds = record.order_ids ? record.order_ids.split(',').map(id => id.trim()) : [];
          console.log('[ECPay] 進入團拆更新分支，要更新的團拆 IDs:', breakIds);
          
          for (const breakId of breakIds) {
            if (!breakId) continue;
            
            const matchingBreaks = await supabase.query('group_breaks', { eq: { id: breakId } });
            
            if (Array.isArray(matchingBreaks) && matchingBreaks.length > 0) {
              const breakRecord = matchingBreaks[0];
              console.log('[ECPay] ✅ 找到團拆記錄:', breakId);
              
              // 計算新的已付金額
              const currentPaid = Number(breakRecord.paid || 0);
              const newPaid = currentPaid + record.trade_amt;
              const totalFee = Number(breakRecord.totalFee || breakRecord['總團費'] || 0);
              
              const updateBreakUrl = `${supabase.url}/rest/v1/group_breaks?id=eq.${breakId}`;
              
              const breakUpdateResponse = await fetch(updateBreakUrl, {
                method: 'PATCH',
                headers: {
                  'apikey': supabase.apiKey,
                  'Authorization': `Bearer ${supabase.apiKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  paid: newPaid,
                  status: newPaid >= totalFee ? '已全額付款' : '部份付款',
                  updated_at: new Date().toISOString()
                })
              });
              
              if (breakUpdateResponse.ok) {
                console.log('[ECPay] ✅ 團拆已更新 - ID:', breakId, '已付:', newPaid);
              } else {
                const errorText = await breakUpdateResponse.text();
                console.error('[ECPay] ❌ 團拆更新失敗:', breakId, breakUpdateResponse.status, errorText);
              }
            } else {
              console.warn('[ECPay] ⚠️ 找不到團拆記錄:', breakId);
            }
          }
        }
      } catch (updateErr) {
        console.error('[ECPay] 更新訂單/團拆時發生錯誤:', updateErr);
      }
      
      // 建立支付通知到 notifications 表（供後台查看）
      const notification = {
        type: 'payment',
        title: '綠界付款完成',
        content: JSON.stringify({
          merchant_trade_no: merchantTradeNo,
          user_id: record.user_id,
          phone: user.phone || '',
          nickname: user.nickname || '',
          amount: record.trade_amt,
          item_name: record.item_name,
          order_ids: record.order_ids,
          trade_no: tradeNo,
          payment_date: paymentDate,
          paymentMethod: 'ecpay',
          status: 'success'
        }),
        status: 'unread',
        created_at: new Date().toISOString()
      };
      
      console.log('[ECPay] 建立支付通知...');
      try {
        const notifUrl = `${supabase.url}/rest/v1/notifications`;
        const notifResponse = await fetch(notifUrl, {
          method: 'POST',
          headers: {
            'apikey': supabase.apiKey,
            'Authorization': `Bearer ${supabase.apiKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(notification)
        });
        
        if (notifResponse.ok) {
          console.log('[ECPay] ✅ 已建立支付通知');
        } else {
          console.warn('[ECPay] ⚠️ 通知建立失敗:', notifResponse.status);
        }
      } catch (notifErr) {
        console.error('[ECPay] 建立通知時發生錯誤:', notifErr);
      }
    }
    
    return { success: true, message: '回調處理完成，RtnCode: ' + rtnCode };
  } catch (error) {
    console.error('[ECPay Callback] 錯誤:', error.message || error);
    console.error('[ECPay Callback] 堆棧:', error.stack);
    return { success: false, message: '回調處理失敗: ' + (error.message || String(error)) };
  }
}

/**
 * 同步版本的 CheckMacValue 生成（用於回調驗證）
 * 注：這在 Cloudflare Workers 環境中需要非同步，所以改用異步版本
 */
async function generateEcpayCheckMacValueAsync(params) {
  try {
    const paramsCopy = { ...params };
    
    // 移除 CheckMacValue (如果存在)
    delete paramsCopy.CheckMacValue;
    
    // 排序參數（按照 A-Z 排序）
    const sortedKeys = Object.keys(paramsCopy).sort();
    
    // 組合參數字串
    let paramStr = '';
    for (let i = 0; i < sortedKeys.length; i++) {
      paramStr += sortedKeys[i] + '=' + paramsCopy[sortedKeys[i]];
      if (i < sortedKeys.length - 1) {
        paramStr += '&';
      }
    }
    
    const hashKey = ECPAY_CONFIG.HashKey;
    const hashIV = ECPAY_CONFIG.HashIV;
    
    // 加上 HashKey 和 HashIV
    const rawStr = 'HashKey=' + hashKey + '&' + paramStr + '&HashIV=' + hashIV;
    
    console.log('原始參數:', paramStr);
    
    // URL Encode (完整編碼)
    let encodedStr = encodeURIComponent(rawStr);
    
    console.log('URL 編碼後:', encodedStr);
    
    // 轉小寫
    encodedStr = encodedStr.toLowerCase();
    
    console.log('轉小寫後:', encodedStr);
    
    // 特殊字符還原（綠界的 .NET URL Encode 規則）
    encodedStr = encodedStr
      .replace(/%2d/g, '-')   // -
      .replace(/%5f/g, '_')   // _
      .replace(/%2e/g, '.')   // .
      .replace(/%21/g, '!')   // !
      .replace(/%2a/g, '*')   // *
      .replace(/%28/g, '(')   // (
      .replace(/%29/g, ')')   // )
      .replace(/%20/g, '+');  // 空格轉為 +
    
    console.log('特殊字符還原後:', encodedStr);
    
    // SHA256 加密
    const msgBuffer = new TextEncoder().encode(encodedStr);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checkMacValue = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    
    console.log('最終 CheckMacValue:', checkMacValue);
    
    return checkMacValue;
  } catch (error) {
    console.error('[ECPay] CheckMacValue 非同步生成失敗:', error);
    throw error;
  }
}

/**
 * SHA256 同步實現（使用 SubtleCrypto）
 * 注：Cloudflare Workers 支持 crypto.subtle
 */
function SHA256Sync(message) {
  // 簡易實現：使用 crypto.getRandomValues 作為備選
  // 實際應使用正確的 SHA256，但在 Workers 環境可能需要特殊處理
  const msgBuffer = new TextEncoder().encode(message);
  // 返回暫時的預留位置，實際會透過非同步調用
  return hmacSHA256(message, '');
}

/**
 * 基於 HMAC 的臨時實現
 */
function hmacSHA256(message, secret) {
  // 這是簡化版本，實際實現需要正確的 SHA256
  // 在 Cloudflare Workers 中應該使用 crypto.subtle
  const hash = require('crypto').createHmac('sha256', secret).update(message).digest('hex');
  return hash;
}

// ==================== 前端 HTML ====================


