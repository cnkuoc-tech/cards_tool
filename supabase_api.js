/**
 * Cloudflare Workers API - 連接 Supabase 後端
 * ✅ 環境變數已內建，可直接使用
 */

// ============================================
// 環境變數設定
// ============================================
const SUPABASE_URL = 'https://hmqwcpstzkxfwabasqgx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcXdjcHN0emt4ZndhYmFzcWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MTM1OTgsImV4cCI6MjA4NDk4OTU5OH0.UJWsWXL-1_L6cGsmoBVSlsYlEEGMSp1F_wyXAc1hB8E';

// ============================================
// Supabase 客戶端初始化
// ============================================
function createSupabaseClient() {
  return {
    url: SUPABASE_URL,
    key: SUPABASE_KEY,
    
    async query(sql, params = []) {
      const response = await fetch(`${this.url}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`
        },
        body: JSON.stringify({ query: sql, params })
      });
      return response.json();
    },
    
    async select(table, options = {}) {
      let url = `${this.url}/rest/v1/${table}`;
      const filters = [];
      
      if (options.select) {
        filters.push(`select=${options.select}`);
      }
      
      if (options.eq) {
        Object.entries(options.eq).forEach(([key, value]) => {
          filters.push(`${key}=eq.${value}`);
        });
      }
      
      if (options.order) {
        filters.push(`order=${options.order}`);
      }
      
      if (options.limit) {
        filters.push(`limit=${options.limit}`);
      }
      
      if (filters.length > 0) {
        url += '?' + filters.join('&');
      }
      
      const response = await fetch(url, {
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Supabase error: ${response.status}`);
      }
      
      return response.json();
    },
    
    async insert(table, data) {
      const response = await fetch(`${this.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });
      return response.json();
    },
    
    async update(table, data, match) {
      let url = `${this.url}/rest/v1/${table}`;
      const params = new URLSearchParams();
      
      Object.entries(match).forEach(([key, value]) => {
        params.append(key, `eq.${value}`);
      });
      
      url += `?${params.toString()}`;
      
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(data)
      });
      return response.json();
    }
  };
}

// ============================================
// API 路由處理
// ============================================
export default {
  async fetch(request, env, ctx) {
    // CORS 處理
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }
    
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      
      // 解析 POST 資料
      let params = {};
      if (request.method === 'POST') {
        const contentType = request.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          params = await request.json();
        } else {
          const formData = await request.formData();
          for (const [key, value] of formData.entries()) {
            params[key] = value;
          }
        }
      }
      
      const supabase = createSupabaseClient();
      let result;
      
      // 路由分發
      switch (params.action || path.substring(1)) {
        case 'login':
          result = await handleLogin(supabase, params);
          break;
        case 'register':
          result = await handleRegister(supabase, params);
          break;
        case 'getUserOrders':
          result = await handleGetUserOrders(supabase, params);
          break;
        case 'getBreaks':
          result = await handleGetBreaks(supabase, params);
          break;
        case 'getProducts':
          result = await handleGetProducts(supabase, params);
          break;
        case 'createOrder':
          result = await handleCreateOrder(supabase, params);
          break;
        case 'updateUser':
          result = await handleUpdateUser(supabase, params);
          break;
        default:
          result = { success: false, message: '未知的 action: ' + (params.action || path) };
      }
      
      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};

// ============================================
// 用戶登入
// ============================================
async function handleLogin(supabase, params) {
  const { phone, password } = params;
  
  if (!phone || !password) {
    return { success: false, message: '請提供手機號碼和密碼' };
  }
  
  const users = await supabase.select('users', {
    eq: { phone, password },
    limit: 1
  });
  
  if (users.length === 0) {
    return { success: false, message: '手機號碼或密碼錯誤' };
  }
  
  const user = users[0];
  return {
    success: true,
    user: {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      realName: user.real_name,
      email: user.email,
      address: user.address
    }
  };
}

// ============================================
// 用戶註冊
// ============================================
async function handleRegister(supabase, params) {
  const { phone, password, nickname, realName, email, address } = params;
  
  if (!phone || !password || !nickname) {
    return { success: false, message: '請提供必要資訊' };
  }
  
  // 檢查是否已存在
  const existing = await supabase.select('users', {
    eq: { phone },
    limit: 1
  });
  
  if (existing.length > 0) {
    return { success: false, message: '此手機號碼已註冊' };
  }
  
  const newUser = await supabase.insert('users', {
    phone,
    password,
    nickname,
    real_name: realName,
    email,
    address
  });
  
  if (newUser.length > 0) {
    return {
      success: true,
      user: {
        id: newUser[0].id,
        phone: newUser[0].phone,
        nickname: newUser[0].nickname
      }
    };
  }
  
  return { success: false, message: '註冊失敗' };
}

// ============================================
// 取得用戶訂單
// ============================================
async function handleGetUserOrders(supabase, params) {
  const { phone } = params;
  
  if (!phone) {
    return { success: false, message: '請提供手機號碼' };
  }
  
  // 先取得用戶 ID
  const users = await supabase.select('users', {
    eq: { phone },
    select: 'id',
    limit: 1
  });
  
  if (users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const userId = users[0].id;
  
  // 取得訂單
  const orders = await supabase.select('orders', {
    eq: { user_id: userId },
    order: 'created_at.desc'
  });
  
  return {
    success: true,
    orders: orders.map(order => ({
      id: order.id,
      item: order.item,
      cardNo: order.card_no,
      quantity: order.quantity,
      totalFee: order.total_fee,
      deposit: order.deposit,
      balance: order.balance,
      status: order.status,
      isCleared: order.is_cleared,
      createdAt: order.created_at
    }))
  };
}

// ============================================
// 取得團拆列表
// ============================================
async function handleGetBreaks(supabase, params) {
  const { phone, category } = params;
  
  let options = {
    order: 'created_at.desc'
  };
  
  if (phone) {
    const users = await supabase.select('users', {
      eq: { phone },
      select: 'id',
      limit: 1
    });
    
    if (users.length > 0) {
      options.eq = { user_id: users[0].id };
    }
  }
  
  if (category) {
    options.eq = { ...options.eq, category };
  }
  
  const breaks = await supabase.select('breaks', options);
  
  return {
    success: true,
    breaks: breaks.map(b => ({
      id: b.id,
      breakId: b.break_id,
      name: b.name,
      category: b.category,
      format: b.format,
      item: b.item,
      totalFee: b.total_fee,
      paid: b.paid,
      status: b.status,
      isOpened: b.is_opened
    }))
  };
}

// ============================================
// 取得商品列表
// ============================================
async function handleGetProducts(supabase, params) {
  const { category, isAvailable } = params;
  
  let options = {
    order: 'created_at.desc'
  };
  
  if (category) {
    options.eq = { category };
  }
  
  if (isAvailable === 'Y') {
    options.eq = { ...options.eq, is_available: true };
  }
  
  const products = await supabase.select('product_catalog', options);
  
  return {
    success: true,
    products: products.map(p => ({
      id: p.id,
      itemName: p.item_name,
      cardNo: p.card_no,
      price: p.price,
      thresholdPrice: p.threshold_price,
      imageUrl1: p.image_url_1,
      imageUrl2: p.image_url_2,
      stockStatus: p.stock_status,
      isAvailable: p.is_available,
      category: p.category
    }))
  };
}

// ============================================
// 建立訂單
// ============================================
async function handleCreateOrder(supabase, params) {
  const { phone, item, cardNo, quantity, totalFee, deposit } = params;
  
  if (!phone || !item) {
    return { success: false, message: '缺少必要資訊' };
  }
  
  // 取得用戶 ID
  const users = await supabase.select('users', {
    eq: { phone },
    select: 'id,nickname',
    limit: 1
  });
  
  if (users.length === 0) {
    return { success: false, message: '找不到用戶' };
  }
  
  const user = users[0];
  
  const newOrder = await supabase.insert('orders', {
    user_id: user.id,
    item,
    card_no: cardNo,
    unit_price: totalFee / quantity,
    quantity: quantity || 1,
    total_fee: totalFee,
    deposit: deposit || 0,
    balance: totalFee - (deposit || 0),
    status: '已下單'
  });
  
  if (newOrder.length > 0) {
    return {
      success: true,
      order: {
        id: newOrder[0].id,
        item: newOrder[0].item,
        totalFee: newOrder[0].total_fee
      }
    };
  }
  
  return { success: false, message: '建立訂單失敗' };
}

// ============================================
// 更新用戶資料
// ============================================
async function handleUpdateUser(supabase, params) {
  const { phone, nickname, realName, email, address } = params;
  
  if (!phone) {
    return { success: false, message: '請提供手機號碼' };
  }
  
  const updateData = {};
  if (nickname) updateData.nickname = nickname;
  if (realName) updateData.real_name = realName;
  if (email) updateData.email = email;
  if (address) updateData.address = address;
  
  const updated = await supabase.update('users', updateData, { phone });
  
  if (updated.length > 0) {
    return {
      success: true,
      user: {
        nickname: updated[0].nickname,
        realName: updated[0].real_name,
        email: updated[0].email,
        address: updated[0].address
      }
    };
  }
  
  return { success: false, message: '更新失敗' };
}
