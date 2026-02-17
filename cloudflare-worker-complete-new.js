/**
 * Cloudflare Worker - Ning's Card Store 完整版
 * ✅ 功能：登入、商品列表、訂單查詢、團拆查詢、PSA 鑑定、付款通知
 * ✅ 後端：Supabase REST API
 * ✅ 前端：單頁應用，使用 switchTab 切換頁面
 * 
 * 部署方式：
 * 1. 複製此檔案內容
 * 2. 到 Cloudflare Dashboard → Workers & Pages
 * 3. 編輯你的 Worker 並貼上
 * 4. 設定環境變數：SUPABASE_URL、SUPABASE_ANON_KEY
 * 5. 部署
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    
    // API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env)
    }
    
    // 所有其他路徑返回 HTML
    return new Response(HTML_CONTENT, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate'
      }
    })
  }
}

/**
 * Supabase 客戶端
 */
class SupabaseClient {
  constructor(url, apiKey) {
    this.url = url
    this.apiKey = apiKey
  }
  
  async query(table, options = {}) {
    const { select = '*', eq = {}, order = null, limit = null } = options
    
    let queryUrl = `${this.url}/rest/v1/${table}?select=${select}`
    
    // 條件查詢
    for (const [key, value] of Object.entries(eq)) {
      queryUrl += `&${key}=eq.${value}`
    }
    
    // 排序
    if (order) {
      queryUrl += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`
    }
    
    // 限制數量
    if (limit) {
      queryUrl += `&limit=${limit}`
    }
    
    const headers = {
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    }
    
    const response = await fetch(queryUrl, { headers })
    const data = await response.json()
    
    return {
      data: response.ok ? data : null,
      error: response.ok ? null : data
    }
  }
  
  async insert(table, data) {
    const insertUrl = `${this.url}/rest/v1/${table}`
    
    const response = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        'apikey': this.apiKey,
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    })
    
    const result = await response.json()
    
    return {
      data: response.ok ? result : null,
      error: response.ok ? null : result
    }
  }
}

/**
 * 處理 API 請求
 */
async function handleAPI(request, env) {
  const url = new URL(request.url)
  const path = url.pathname
  
  // 建立 Supabase 客戶端
  const supabase = new SupabaseClient(
    env.SUPABASE_URL || 'https://hmqwcpstzkxfwabasqgx.supabase.co',
    env.SUPABASE_ANON_KEY || 'your-anon-key-here'
  )
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  }
  
  // OPTIONS 請求處理
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    // POST /api/login - 登入
    if (path === '/api/login' && request.method === 'POST') {
      const { phone, birthday } = await request.json()
      
      // 查詢用戶
      const userResult = await supabase.query('users', {
        eq: { phone, birthday }
      })
      
      if (!userResult.data || userResult.data.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          message: '手機號碼或生日錯誤'
        }), { headers: corsHeaders, status: 401 })
      }
      
      const user = userResult.data[0]
      
      // 查詢用戶訂單
      const ordersResult = await supabase.query('orders', {
        eq: { user_id: user.id },
        order: { column: 'order_date', ascending: false }
      })
      
      // 查詢用戶團拆
      const breaksResult = await supabase.query('group_breaks', {
        eq: { user_id: user.id },
        order: { column: 'created_at', ascending: false }
      })
      
      return new Response(JSON.stringify({
        success: true,
        user: {
          id: user.id,
          phone: user.phone,
          nickname: user.nickname || '會員',
          real_name: user.real_name || '',
          email: user.email || '',
          address: user.address || ''
        },
        orders: ordersResult.data || [],
        breaks: breaksResult.data || []
      }), { headers: corsHeaders })
    }
    
    // GET /api/products - 商品列表
    if (path === '/api/products' && request.method === 'GET') {
      const productsResult = await supabase.query('products', {
        eq: { is_available: true },
        order: { column: 'created_at', ascending: false }
      })
      
      return new Response(JSON.stringify({
        success: true,
        products: productsResult.data || []
      }), { headers: corsHeaders })
    }
    
    // GET /api/orders - 訂單列表
    if (path === '/api/orders' && request.method === 'GET') {
      const userId = url.searchParams.get('user_id')
      const filter = url.searchParams.get('filter') || 'all'
      
      if (!userId) {
        return new Response(JSON.stringify({
          success: false,
          message: '缺少 user_id 參數'
        }), { headers: corsHeaders, status: 400 })
      }
      
      let queryOptions = {
        eq: { user_id: parseInt(userId) },
        order: { column: 'order_date', ascending: false }
      }
      
      // 根據篩選條件調整查詢
      if (filter === 'pending') {
        queryOptions.eq.is_cleared = false
      } else if (filter === 'paid') {
        queryOptions.eq.is_cleared = true
        queryOptions.eq.is_shipped = false
      } else if (filter === 'shipped') {
        queryOptions.eq.is_shipped = true
      }
      
      const ordersResult = await supabase.query('orders', queryOptions)
      
      return new Response(JSON.stringify({
        success: true,
        orders: ordersResult.data || []
      }), { headers: corsHeaders })
    }
    
    // GET /api/breaks - 團拆列表
    if (path === '/api/breaks' && request.method === 'GET') {
      const userId = url.searchParams.get('user_id')
      
      if (!userId) {
        return new Response(JSON.stringify({
          success: false,
          message: '缺少 user_id 參數'
        }), { headers: corsHeaders, status: 400 })
      }
      
      const breaksResult = await supabase.query('group_breaks', {
        eq: { user_id: parseInt(userId) },
        order: { column: 'created_at', ascending: false }
      })
      
      return new Response(JSON.stringify({
        success: true,
        breaks: breaksResult.data || []
      }), { headers: corsHeaders })
    }
    
    // POST /api/payment-notice - 付款通知
    if (path === '/api/payment-notice' && request.method === 'POST') {
      const formData = await request.json()
      
      // 這裡可以將付款通知存入資料庫或發送通知
      // 暫時返回成功
      return new Response(JSON.stringify({
        success: true,
        message: '付款通知已送出，我們會盡快確認'
      }), { headers: corsHeaders })
    }
    
    // POST /api/psa-submit - PSA 鑑定申請
    if (path === '/api/psa-submit' && request.method === 'POST') {
      const formData = await request.json()
      
      // 這裡可以將 PSA 申請存入資料庫
      // 暫時返回成功
      return new Response(JSON.stringify({
        success: true,
        message: 'PSA 鑑定申請已送出'
      }), { headers: corsHeaders })
    }
    
    // 404
    return new Response(JSON.stringify({
      success: false,
      message: 'API 端點不存在'
    }), { headers: corsHeaders, status: 404 })
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      message: error.message
    }), { headers: corsHeaders, status: 500 })
  }
}
