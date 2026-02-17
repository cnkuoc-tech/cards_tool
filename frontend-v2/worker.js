/**
 * Cloudflare Worker - Ning's Card v2
 * 整合前端（支援 URL 路由）+ Supabase API
 */

import { createClient } from '@supabase/supabase-js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    
    // API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env)
    }
    
    // 靜態資源（JS/CSS）
    if (url.pathname.startsWith('/js/') || url.pathname.startsWith('/css/')) {
      return handleStaticFile(url.pathname)
    }
    
    // 所有其他路徑都返回 index.html（SPA 路由）
    return handleHTML()
  }
}

/**
 * 處理 API 請求
 */
async function handleAPI(request, env) {
  const url = new URL(request.url)
  const path = url.pathname
  
  // 建立 Supabase 客戶端
  const supabase = createClient(
    env.SUPABASE_URL,
    env.SUPABASE_ANON_KEY
  )
  
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
  
  // 處理 OPTIONS 請求
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    let response
    
    // 登入 API
    if (path === '/api/login' && request.method === 'POST') {
      response = await handleLogin(request, supabase)
    }
    // 商品列表 API
    else if (path === '/api/products' && request.method === 'GET') {
      response = await handleGetProducts(url, supabase)
    }
    // 訂單列表 API
    else if (path === '/api/orders' && request.method === 'GET') {
      response = await handleGetOrders(url, request, supabase)
    }
    // 404
    else {
      response = { success: false, message: 'API 不存在' }
    }
    
    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
    
  } catch (error) {
    console.error('API 錯誤:', error)
    return new Response(JSON.stringify({
      success: false,
      message: error.message || '伺服器錯誤'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  }
}

/**
 * 登入 API
 */
async function handleLogin(request, supabase) {
  const { phone, birthday } = await request.json()
  
  if (!phone || !birthday) {
    return { success: false, message: '請提供手機號碼和生日' }
  }
  
  // 查詢用戶
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .limit(1)
  
  if (error) {
    console.error('查詢用戶失敗:', error)
    return { success: false, message: '查詢失敗' }
  }
  
  if (!users || users.length === 0) {
    return { success: false, message: '找不到此手機號碼的會員資料' }
  }
  
  const user = users[0]
  
  // 驗證生日（支援多種格式）
  const userBday = String(user.birthday || '').replace(/\D/g, '').slice(-4)
  const inputBday = String(birthday).replace(/\D/g, '')
  
  if (userBday !== inputBday) {
    return { success: false, message: '生日驗證失敗' }
  }
  
  // 登入成功
  return {
    success: true,
    user: {
      id: user.id,
      phone: user.phone,
      nickname: user.nickname,
      real_name: user.real_name,
      email: user.email,
      address: user.address
    }
  }
}

/**
 * 取得商品列表
 */
async function handleGetProducts(url, supabase) {
  const category = url.searchParams.get('category')
  const status = url.searchParams.get('status')
  
  let query = supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })
  
  // 篩選條件
  if (status === 'available') {
    query = query.eq('is_available', 'Y')
  }
  
  if (status === 'in_stock') {
    query = query.eq('stock_status', 'Y')
  }
  
  if (status === 'pre_order') {
    query = query.eq('stock_status', 'P')
  }
  
  const { data: products, error } = await query
  
  if (error) {
    console.error('查詢商品失敗:', error)
    return { success: false, message: '查詢失敗' }
  }
  
  return {
    success: true,
    products: products || []
  }
}

/**
 * 取得訂單列表（支援分頁）
 */
async function handleGetOrders(url, request, supabase) {
  // TODO: 從 Authorization header 取得用戶 ID
  // 目前先從 query 參數取得（測試用）
  const userId = url.searchParams.get('user_id')
  
  if (!userId) {
    return { success: false, message: '請先登入' }
  }
  
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = parseInt(url.searchParams.get('per_page') || '20')
  const search = url.searchParams.get('search') || ''
  
  // 計算 offset
  const offset = (page - 1) * perPage
  
  // 建立查詢
  let query = supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('order_date', { ascending: false })
  
  // 搜尋
  if (search) {
    query = query.or(`item_name.ilike.%${search}%,card_no.ilike.%${search}%`)
  }
  
  // 分頁
  query = query.range(offset, offset + perPage - 1)
  
  const { data: orders, error, count } = await query
  
  if (error) {
    console.error('查詢訂單失敗:', error)
    return { success: false, message: '查詢失敗' }
  }
  
  // 統計數據
  const { data: stats } = await supabase
    .from('orders')
    .select('is_cleared, is_shipped')
    .eq('user_id', userId)
  
  const statsData = {
    total: count || 0,
    pending: stats?.filter(s => !s.is_cleared).length || 0,
    paid: stats?.filter(s => s.is_cleared && !s.is_shipped).length || 0,
    shipped: stats?.filter(s => s.is_shipped).length || 0
  }
  
  return {
    success: true,
    orders: orders || [],
    stats: statsData,
    pagination: {
      current_page: page,
      per_page: perPage,
      total: count || 0,
      total_pages: Math.ceil((count || 0) / perPage)
    }
  }
}

/**
 * 處理靜態檔案
 */
async function handleStaticFile(pathname) {
  // 從 frontend-v2 資料夾載入檔案
  // 注意：這裡需要將檔案內容內嵌或使用 Cloudflare Pages
  // 為了簡化，我們將 JS 檔案內容返回
  
  const files = {
    '/js/router.js': ROUTER_JS,
    '/js/api.js': API_JS,
    '/js/auth.js': AUTH_JS,
    '/js/app.js': APP_JS,
    '/js/pages/home.js': HOME_PAGE_JS,
    '/js/pages/login.js': LOGIN_PAGE_JS,
    '/js/pages/products.js': PRODUCTS_PAGE_JS,
    '/js/pages/orders.js': ORDERS_PAGE_JS,
  }
  
  const content = files[pathname]
  
  if (!content) {
    return new Response('Not Found', { status: 404 })
  }
  
  return new Response(content, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
}

/**
 * 返回 HTML
 */
function handleHTML() {
  return new Response(HTML_CONTENT, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  })
}

// 將前端檔案內容嵌入（實際部署時應該使用 Cloudflare Pages）
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ning's Card Store v2</title>
  <style>
    body { font-family: sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }
    h1 { color: #0a2342; }
    .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #0a2342; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div id="app">
    <div style="text-align:center;padding:100px 20px;">
      <div class="spinner"></div>
      <p>載入中...</p>
    </div>
  </div>
  <script>
    // 簡化版的路由器和應用程式
    console.log('Ning\\'s Card v2 - 前端架構測試版')
    console.log('完整版本需要部署所有 JS 檔案')
    
    document.getElementById('app').innerHTML = \`
      <h1>✅ Cloudflare Worker 運作正常！</h1>
      <p>這是 Ning's Card v2 的測試版本</p>
      <p>接下來需要：</p>
      <ol>
        <li>部署完整的前端檔案（使用 Cloudflare Pages）</li>
        <li>測試 API 功能</li>
        <li>實作所有頁面</li>
      </ol>
      
      <h2>測試 API</h2>
      <button onclick="testAPI()">測試登入 API</button>
      <pre id="apiResult"></pre>
    \`
    
    async function testAPI() {
      const result = document.getElementById('apiResult')
      result.textContent = '測試中...'
      
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: '0912345678',
            birthday: '0101'
          })
        })
        
        const data = await response.json()
        result.textContent = JSON.stringify(data, null, 2)
      } catch (error) {
        result.textContent = '錯誤: ' + error.message
      }
    }
  </script>
</body>
</html>`

const ROUTER_JS = '// Router will be loaded here'
const API_JS = '// API will be loaded here'
const AUTH_JS = '// Auth will be loaded here'
const APP_JS = '// App will be loaded here'
const HOME_PAGE_JS = '// Home page will be loaded here'
const LOGIN_PAGE_JS = '// Login page will be loaded here'
const PRODUCTS_PAGE_JS = '// Products page will be loaded here'
const ORDERS_PAGE_JS = '// Orders page will be loaded here'
