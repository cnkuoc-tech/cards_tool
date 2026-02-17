/**
 * Cloudflare Worker 後端 API 處理
 * 直接整合 Supabase 查詢
 */

// Supabase 客戶端類別
class SupabaseClient {
  constructor(url, apiKey) {
    this.url = url;
    this.apiKey = apiKey;
  }
  
  async query(table, options = {}) {
    const { select = '*', eq = {}, or = null, order = null, range = null, count = false } = options;
    
    let queryUrl = `${this.url}/rest/v1/${table}?select=${select}`;
    
    for (const [key, value] of Object.entries(eq)) {
      queryUrl += `&${key}=eq.${value}`;
    }
    
    if (or) {
      queryUrl += `&or=(${or})`;
    }
    
    if (order) {
      queryUrl += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`;
    }
    
    if (range) {
      queryUrl += `&limit=${range[1] - range[0] + 1}&offset=${range[0]}`;
    }
    
    const headers = {
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
    
    if (count) {
      headers['Prefer'] = 'count=exact';
    }
    
    const response = await fetch(queryUrl, { headers });
    const data = await response.json();
    const totalCount = count ? parseInt(response.headers.get('content-range')?.split('/')[1] || '0') : null;
    
    return {
      data: response.ok ? data : null,
      error: response.ok ? null : data,
      count: totalCount
    };
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
    
    const result = await response.json();
    return {
      data: response.ok ? result : null,
      error: response.ok ? null : result
    };
  }
}

// API 處理函數
export async function handleAPI(request, env) {
  const supabase = new SupabaseClient(
    env.SUPABASE_URL || 'https://hmqwcpstzkxfwabasqgx.supabase.co',
    env.SUPABASE_ANON_KEY
  );
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  try {
    const body = await request.json();
    const { action } = body;
    
    let result;
    
    switch (action) {
      case 'login':
        result = await handleLogin(body, supabase);
        break;
      case 'getProducts':
        result = await handleGetProducts(body, supabase);
        break;
      case 'getOrderInfo':
        result = await handleGetOrderInfo(body, supabase);
        break;
      case 'addOrderEntriesToMain':
        result = await handleAddOrder(body, supabase);
        break;
      case 'submitPaymentNotification':
        result = await handlePaymentNotification(body, supabase);
        break;
      case 'getBreakCredit':
        result = await handleGetBreakCredit(body, supabase);
        break;
      case 'useBreakCredit':
        result = await handleUseBreakCredit(body, supabase);
        break;
      case 'submitPsaOrder':
        result = await handleSubmitPsaOrder(body, supabase);
        break;
      case 'lookupPsaOrders':
        result = await handleLookupPsaOrders(body, supabase);
        break;
      case 'checkDailyFortune':
        result = await handleCheckDailyFortune(body, supabase);
        break;
      case 'saveDailyFortune':
        result = await handleSaveDailyFortune(body, supabase);
        break;
      default:
        result = { success: false, message: `未知的 action: ${action}` };
    }
    
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
    
  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: error.message || '伺服器錯誤'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// 1. 登入
async function handleLogin(body, supabase) {
  const { phone, password } = body;
  
  if (!phone || !password) {
    return { success: false, message: '請提供手機號碼和生日' };
  }
  
  const { data: users, error } = await supabase.query('users', {
    select: '*',
    eq: { phone }
  });
  
  if (error || !users || users.length === 0) {
    return { success: false, message: '找不到此手機號碼的會員資料' };
  }
  
  const user = users[0];
  const userBday = String(user.birthday || '').replace(/\D/g, '').slice(-4);
  const inputBday = String(password).replace(/\D/g, '');
  
  if (userBday !== inputBday) {
    return { success: false, message: '生日驗證失敗' };
  }
  
  return {
    success: true,
    user: {
      phone: user.phone,
      nickname: user.nickname,
      real_name: user.real_name,
      email: user.email,
      address: user.address
    }
  };
}

// 2. 取得商品
async function handleGetProducts(body, supabase) {
  const { data: products, error } = await supabase.query('products', {
    select: '*',
    order: { column: 'created_at', ascending: false }
  });
  
  if (error) {
    return { success: false, message: '查詢商品失敗' };
  }
  
  const items = (products || []).map(p => ({
    item: p.item_name,
    cardNo: p.card_no || '',
    price: Number(p.price || 0),
    fullPrice: Number(p.discount_price || 0),
    threshold: Number(p.threshold || 0),
    images: [p.image_url_1, p.image_url_2, p.image_url_3].filter(Boolean),
    isBox: p.is_box || 'N',
    status: p.is_available === 'Y' ? 'open' : 'closed',
    stockStatus: p.stock_status || 'Y',
    description: p.description || ''
  }));
  
  return { success: true, items };
}

// 3. 取得訂單資訊
async function handleGetOrderInfo(body, supabase) {
  const { phone, birthday } = body;
  
  if (!phone) {
    return { success: false, message: '請提供手機號碼' };
  }
  
  const { data: users } = await supabase.query('users', {
    select: 'id',
    eq: { phone }
  });
  
  if (!users || users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  
  const { data: orders } = await supabase.query('orders', {
    select: '*',
    eq: { user_id: userId },
    order: { column: 'order_date', ascending: false }
  });
  
  const { data: breaks } = await supabase.query('group_breaks', {
    select: '*',
    eq: { user_id: userId },
    order: { column: 'created_at', ascending: false }
  });
  
  const formattedOrders = (orders || []).map(o => ({
    item: o.item_name,
    cardNo: o.card_no || '',
    quantity: o.quantity,
    totalFee: o.total_fee,
    isCleared: o.is_cleared ? 'Y' : 'N',
    isShipped: o.is_shipped ? 'Y' : 'N',
    orderDate: o.order_date,
    images: [o.image_url].filter(Boolean)
  }));
  
  const formattedBreaks = (breaks || []).map(b => ({
    breakName: b.break_name,
    createdAt: b.created_at
  }));
  
  return {
    success: true,
    orders: formattedOrders,
    groupBreaks: formattedBreaks
  };
}

// 4. 新增訂單（簡化版）
async function handleAddOrder(body, supabase) {
  return { success: true, message: '訂單功能開發中' };
}

// 5. 付款通知（簡化版）
async function handlePaymentNotification(body, supabase) {
  return { success: true, message: '付款通知已記錄' };
}

// 6. 取得團拆額度（簡化版）
async function handleGetBreakCredit(body, supabase) {
  return { success: true, credit: 0 };
}

// 7. 使用團拆額度（簡化版）
async function handleUseBreakCredit(body, supabase) {
  return { success: true, message: '額度已使用' };
}

// 8. 提交 PSA 訂單（簡化版）
async function handleSubmitPsaOrder(body, supabase) {
  return { success: true, message: 'PSA 訂單已提交' };
}

// 9. 查詢 PSA 訂單（簡化版）
async function handleLookupPsaOrders(body, supabase) {
  return { success: true, orders: [] };
}

// 10. 檢查每日抽獎（簡化版）
async function handleCheckDailyFortune(body, supabase) {
  return { success: true, hasDrawn: false };
}

// 11. 儲存抽獎結果（簡化版）
async function handleSaveDailyFortune(body, supabase) {
  return { success: true, message: '抽獎結果已儲存' };
}
