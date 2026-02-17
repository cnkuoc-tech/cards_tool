/**
 * Cloudflare Worker - Ning's Card Store v2
 * 整合版：前端（支援 URL 路由）+ Supabase API
 * 
 * 部署方式：
 * 1. 複製這整個檔案的內容
 * 2. 到 Cloudflare Dashboard → Workers & Pages
 * 3. 編輯你的 Worker (supabasefrontdemo)
 * 4. 貼上並部署
 * 
 * 環境變數設定：
 * - SUPABASE_URL = https://hmqwcpstzkxfwabasqgx.supabase.co
 * - SUPABASE_ANON_KEY = (你的 Supabase Anon Key)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    
    // API 路由
    if (url.pathname.startsWith('/api/')) {
      return handleAPI(request, env)
    }
    
    // 所有其他路徑都返回 HTML（SPA 路由）
    return new Response(HTML_CONTENT, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=0, must-revalidate'
      }
    })
  }
}

/**
 * Supabase REST API 輔助函數
 */
class SupabaseClient {
  constructor(url, apiKey) {
    this.url = url
    this.apiKey = apiKey
  }
  
  async query(table, options = {}) {
    const { select = '*', eq = {}, or = null, order = null, range = null, count = false } = options
    
    let queryUrl = `${this.url}/rest/v1/${table}?select=${select}`
    
    // 條件查詢
    for (const [key, value] of Object.entries(eq)) {
      queryUrl += `&${key}=eq.${value}`
    }
    
    // OR 查詢
    if (or) {
      queryUrl += `&or=(${or})`
    }
    
    // 排序
    if (order) {
      queryUrl += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`
    }
    
    // 分頁
    if (range) {
      queryUrl += `&limit=${range[1] - range[0] + 1}&offset=${range[0]}`
    }
    
    const headers = {
      'apikey': this.apiKey,
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    }
    
    if (count) {
      headers['Prefer'] = 'count=exact'
    }
    
    const response = await fetch(queryUrl, { headers })
    
    const data = await response.json()
    const totalCount = count ? parseInt(response.headers.get('content-range')?.split('/')[1] || '0') : null
    
    return {
      data: response.ok ? data : null,
      error: response.ok ? null : data,
      count: totalCount
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
  const { data: users, error } = await supabase.query('users', {
    select: '*',
    eq: { phone }
  })
  
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
  
  const queryOptions = {
    select: '*',
    order: { column: 'created_at', ascending: false },
    eq: {}
  }
  
  // 篩選條件
  if (status === 'available') {
    queryOptions.eq.is_available = 'Y'
  }
  
  if (status === 'in_stock') {
    queryOptions.eq.stock_status = 'Y'
  }
  
  if (status === 'pre_order') {
    queryOptions.eq.stock_status = 'P'
  }
  
  const { data: products, error } = await supabase.query('products', queryOptions)
  
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
  // 從 query 參數取得 user_id（後續應該從 token 取得）
  const userId = url.searchParams.get('user_id')
  
  if (!userId) {
    return { success: false, message: '請先登入' }
  }
  
  const page = parseInt(url.searchParams.get('page') || '1')
  const perPage = parseInt(url.searchParams.get('per_page') || '20')
  const search = url.searchParams.get('search') || ''
  
  // 計算 offset
  const offset = (page - 1) * perPage
  
  // 建立查詢選項
  const queryOptions = {
    select: '*',
    eq: { user_id: userId },
    order: { column: 'order_date', ascending: false },
    range: [offset, offset + perPage - 1],
    count: true
  }
  
  // 搜尋
  if (search) {
    queryOptions.or = `item_name.ilike.*${search}*,card_no.ilike.*${search}*`
  }
  
  const { data: orders, error, count } = await supabase.query('orders', queryOptions)
  
  if (error) {
    console.error('查詢訂單失敗:', error)
    return { success: false, message: '查詢失敗' }
  }
  
  // 統計數據
  const { data: stats } = await supabase.query('orders', {
    select: 'is_cleared,is_shipped',
    eq: { user_id: userId }
  })
  
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
 * 前端 JavaScript（整合所有模組）
 */
const FRONTEND_JS = `
// ============================================
// Router (URL 路由管理器)
// ============================================
class Router {
  constructor() {
    this.routes = new Map()
    this.currentRoute = null
    
    window.addEventListener('popstate', () => this.loadCurrentRoute())
    
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]')
      if (link && link.href.startsWith(window.location.origin)) {
        e.preventDefault()
        this.navigate(link.pathname + link.search + link.hash)
      }
    })
  }
  
  register(path, handler, meta = {}) {
    this.routes.set(path, { handler, meta })
    return this
  }
  
  async navigate(path, options = {}) {
    if (options.replace) {
      window.history.replaceState(options.state || {}, '', path)
    } else {
      window.history.pushState(options.state || {}, '', path)
    }
    await this.loadCurrentRoute()
  }
  
  async loadCurrentRoute() {
    const path = window.location.pathname
    const search = new URLSearchParams(window.location.search)
    const hash = window.location.hash
    
    let matchedRoute = null
    let params = {}
    
    for (const [routePath, route] of this.routes) {
      const match = this.matchRoute(routePath, path)
      if (match) {
        matchedRoute = route
        params = match.params
        break
      }
    }
    
    if (!matchedRoute) {
      matchedRoute = {
        handler: () => {
          document.getElementById('app').innerHTML = \`
            <div style="text-align:center;padding:100px 20px;">
              <h1 style="font-size:72px;color:#ccc;margin:0;">404</h1>
              <p style="font-size:20px;color:#666;">找不到此頁面</p>
              <button onclick="router.navigate('/')" class="btn btn-primary" style="margin-top:20px;">返回首頁</button>
            </div>
          \`
        },
        meta: {}
      }
    }
    
    if (matchedRoute.meta.requireAuth && !window.authManager?.isLoggedIn()) {
      this.navigate('/login?redirect=' + encodeURIComponent(path + window.location.search))
      return
    }
    
    this.currentRoute = { path, search, hash, params }
    
    try {
      await matchedRoute.handler({ path, search, hash, params })
    } catch (error) {
      console.error('路由處理錯誤:', error)
      this.showError(error)
    }
  }
  
  matchRoute(routePath, actualPath) {
    if (routePath === actualPath) return { params: {} }
    
    const routeParts = routePath.split('/').filter(Boolean)
    const actualParts = actualPath.split('/').filter(Boolean)
    
    if (routeParts.length !== actualParts.length) return null
    
    const params = {}
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i]
      const actualPart = actualParts[i]
      
      if (routePart.startsWith(':')) {
        params[routePart.slice(1)] = actualPart
      } else if (routePart !== actualPart) {
        return null
      }
    }
    return { params }
  }
  
  getQuery(key) {
    return new URLSearchParams(window.location.search).get(key)
  }
  
  getParams() {
    return this.currentRoute?.params || {}
  }
  
  back() {
    window.history.back()
  }
  
  showError(error) {
    document.getElementById('app').innerHTML = \`
      <div style="max-width:600px;margin:50px auto;padding:30px;background:#fee;border-radius:12px;border:2px solid #f66;">
        <h2 style="color:#d00;margin:0 0 15px;">⚠️ 發生錯誤</h2>
        <p style="color:#666;margin:0 0 20px;">\${error.message || '未知錯誤'}</p>
        <button onclick="router.back()" class="btn btn-secondary">返回上一頁</button>
        <button onclick="router.navigate('/')" class="btn btn-primary" style="margin-left:10px;">返回首頁</button>
      </div>
    \`
  }
  
  async init() {
    await this.loadCurrentRoute()
  }
}

// ============================================
// API (API 呼叫封裝)
// ============================================
class API {
  constructor(baseURL) {
    this.baseURL = baseURL || ''
  }
  
  async request(endpoint, options = {}) {
    const url = \`\${this.baseURL}\${endpoint}\`
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }
    
    const user = window.authManager?.getUser()
    if (user?.token) {
      defaultOptions.headers['Authorization'] = \`Bearer \${user.token}\`
    }
    
    const finalOptions = { ...defaultOptions, ...options }
    
    if (options.showLoading !== false) {
      window.showLoading?.()
    }
    
    try {
      const response = await fetch(url, finalOptions)
      window.hideLoading?.()
      
      if (!response.ok) {
        if (response.status === 401) {
          window.authManager?.logout()
          window.router?.navigate('/login')
          throw new Error('登入已過期，請重新登入')
        }
        
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || \`HTTP \${response.status}: \${response.statusText}\`)
      }
      
      const contentType = response.headers.get('content-type')
      if (contentType?.includes('application/json')) {
        return await response.json()
      }
      return await response.text()
      
    } catch (error) {
      window.hideLoading?.()
      console.error('API 請求失敗:', error)
      throw error
    }
  }
  
  async get(endpoint, query = {}, options = {}) {
    const queryString = new URLSearchParams(query).toString()
    const url = queryString ? \`\${endpoint}?\${queryString}\` : endpoint
    return this.request(url, { method: 'GET', ...options })
  }
  
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    })
  }
  
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options
    })
  }
  
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options })
  }
}

// ============================================
// AuthManager (認證管理器)
// ============================================
class AuthManager {
  constructor() {
    this.storageKey = 'ning_card_user'
    this.user = null
    this.loadUserFromStorage()
  }
  
  loadUserFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        this.user = JSON.parse(stored)
        const expireTime = 7 * 24 * 60 * 60 * 1000
        if (Date.now() - this.user.loginTime > expireTime) {
          this.logout()
          return
        }
      }
    } catch (error) {
      console.error('載入用戶資料失敗:', error)
      this.logout()
    }
  }
  
  async login(phone, birthday, remember = true) {
    try {
      const response = await window.api.post('/api/login', { phone, birthday })
      
      if (!response.success) {
        throw new Error(response.message || '登入失敗')
      }
      
      this.user = { ...response.user, loginTime: Date.now() }
      
      if (remember) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.user))
      }
      
      window.dispatchEvent(new CustomEvent('user-login', { detail: this.user }))
      return this.user
      
    } catch (error) {
      console.error('登入失敗:', error)
      throw error
    }
  }
  
  logout() {
    this.user = null
    localStorage.removeItem(this.storageKey)
    window.dispatchEvent(new CustomEvent('user-logout'))
    window.router?.navigate('/login')
  }
  
  isLoggedIn() {
    return this.user !== null
  }
  
  getUser() {
    return this.user
  }
  
  updateUser(updates) {
    if (!this.user) return
    this.user = { ...this.user, ...updates }
    localStorage.setItem(this.storageKey, JSON.stringify(this.user))
    window.dispatchEvent(new CustomEvent('user-update', { detail: this.user }))
  }
}

// ============================================
// App (主應用程式)
// ============================================
class App {
  constructor() {
    this.cart = []
    this.loadCartFromStorage()
  }
  
  async init() {
    console.log('🚀 Ning\\'s Card App v2 啟動中...')
    this.registerRoutes()
    this.setupEventListeners()
    this.updateUI()
    await router.init()
    console.log('✅ App 已啟動')
  }
  
  registerRoutes() {
    router.register('/', () => this.renderHomePage())
    router.register('/login', () => this.renderLoginPage())
    router.register('/products', () => this.renderProductsPage())
    router.register('/orders', () => this.renderOrdersPage(), { requireAuth: true })
  }
  
  setupEventListeners() {
    window.addEventListener('user-login', () => this.updateUI())
    window.addEventListener('user-logout', () => {
      this.updateUI()
      this.clearCart()
    })
    window.addEventListener('cart-update', () => this.updateCartUI())
  }
  
  updateUI() {
    this.updateSidebar()
    this.updateHeader()
    this.updateCartUI()
  }
  
  updateSidebar() {
    const user = authManager.getUser()
    const sidebarHeader = document.getElementById('sidebarHeader')
    const sidebarMenu = document.getElementById('sidebarMenu')
    const userInfo = document.getElementById('userInfo')
    
    if (user) {
      sidebarHeader.classList.add('logged-in')
      userInfo.textContent = \`👤 \${user.nickname || user.phone}\`
    } else {
      sidebarHeader.classList.remove('logged-in')
      userInfo.textContent = '未登入'
    }
    
    const menuItems = [
      { path: '/', icon: '🏠', label: '首頁', auth: false },
      { path: '/products', icon: '🃏', label: 'Topps Now', auth: false },
      { divider: true },
      { path: '/orders', icon: '🧾', label: '我的訂單', auth: true },
    ]
    
    sidebarMenu.innerHTML = menuItems.map(item => {
      if (item.divider) return '<hr style="margin:10px 0;border:none;border-top:1px solid #eee;">'
      const memberClass = item.auth ? \`member-only \${user ? 'show' : ''}\` : ''
      const activeClass = window.location.pathname === item.path ? 'active' : ''
      return \`
        <a href="\${item.path}" class="menu-item \${memberClass} \${activeClass}" onclick="toggleSidebar()">
          <span class="menu-icon">\${item.icon}</span>
          \${item.label}
        </a>
      \`
    }).join('')
    
    if (user) {
      sidebarMenu.innerHTML += \`
        <a href="#" class="menu-item" onclick="event.preventDefault(); authManager.logout()">
          <span class="menu-icon">🚪</span>
          登出
        </a>
      \`
    }
  }
  
  updateHeader() {
    const user = authManager.getUser()
    const headerActions = document.getElementById('headerActions')
    
    if (user) {
      headerActions.innerHTML = \`
        <button class="nav-btn cart-btn">
          <span>🛒</span>
          <span class="nav-btn-text">購物車</span>
          <span class="cart-badge" id="cartBadge" style="display:none;">0</span>
        </button>
      \`
    } else {
      headerActions.innerHTML = \`
        <button class="nav-btn" onclick="router.navigate('/login')">
          <span>👤</span>
          <span class="nav-btn-text">登入</span>
        </button>
      \`
    }
  }
  
  updateCartUI() {
    const badge = document.getElementById('cartBadge')
    if (badge) {
      const count = this.cart.reduce((sum, item) => sum + item.quantity, 0)
      badge.textContent = count
      badge.style.display = count > 0 ? 'flex' : 'none'
    }
  }
  
  loadCartFromStorage() {
    try {
      const stored = localStorage.getItem('ning_card_cart')
      this.cart = stored ? JSON.parse(stored) : []
    } catch (error) {
      this.cart = []
    }
  }
  
  saveCartToStorage() {
    localStorage.setItem('ning_card_cart', JSON.stringify(this.cart))
    window.dispatchEvent(new CustomEvent('cart-update'))
  }
  
  clearCart() {
    this.cart = []
    this.saveCartToStorage()
  }
  
  showToast(message, duration = 3000) {
    const old = document.getElementById('toast')
    if (old) old.remove()
    
    const toast = document.createElement('div')
    toast.id = 'toast'
    toast.textContent = message
    toast.style.cssText = \`
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 14px;
      z-index: 10000;
      animation: fadeIn 0.3s ease-in-out;
    \`
    
    document.body.appendChild(toast)
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease-in-out'
      setTimeout(() => toast.remove(), 300)
    }, duration)
  }
  
  // ============================================
  // 頁面渲染
  // ============================================
  
  renderHomePage() {
    const user = authManager.getUser()
    document.getElementById('app').innerHTML = \`
      <div style="max-width:800px;margin:0 auto;padding:20px;line-height:1.8;">
        <div style="background:linear-gradient(135deg, var(--navy), #2e4a7c);color:white;padding:30px;border-radius:12px;margin-bottom:30px;text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
          <h2 style="font-size:28px;margin-bottom:15px;">⚾️ 關於我們：投寧所好，以卡球緣</h2>
          <p style="font-size:16px;line-height:1.8;">
            歡迎來到 <strong>Ning's Card</strong>！我是站長 Ning。<br>
            本身是投手出身的我，將工作室取名為<strong>「投寧所好球緣卡工作室」</strong>，<br>
            這裡面包含了兩個我們對收藏的核心理念：
          </p>
        </div>

        <div style="background:#f8f9fa;padding:25px;border-radius:10px;margin-bottom:25px;border-left:5px solid var(--orange);box-shadow:0 2px 8px rgba(0,0,0,0.05);">
          <h3 style="color:var(--navy);margin-bottom:15px;font-size:20px;">🎯 投寧所好 (投其所好)</h3>
          <p style="color:#555;margin-bottom:0;">
            融入了我的名字「Ning」，希望能像投手精準控球一樣，精準地為每一位收藏家提供最優質的服務。
          </p>
        </div>

        <div style="background:#f8f9fa;padding:25px;border-radius:10px;margin-bottom:30px;border-left:5px solid var(--orange);box-shadow:0 2px 8px rgba(0,0,0,0.05);">
          <h3 style="color:var(--navy);margin-bottom:15px;font-size:20px;">🍀 球緣卡 (球員卡)</h3>
          <p style="color:#555;margin-bottom:0;">
            取自「球員卡」的諧音。我們相信每一張卡片的相遇都是一種<strong>「緣分」</strong>。<br>
            買卡不只是獲得一張紙片，更是在尋求那份與心儀球星相遇的幸運機緣。
          </p>
        </div>

        <p style="text-align:center;font-size:16px;color:#666;margin-bottom:40px;padding:20px;background:linear-gradient(135deg, #fff8e1, #ffecb3);border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
          💡 在這裡，我們希望透過公開透明的直播與團購力量，<br>讓大家一起享受這份「求緣」的刺激與樂趣！
        </p>

        <div style="text-align:center;margin-top:40px;">
          <button onclick="router.navigate('/products')" class="btn btn-primary" style="padding:15px 40px;font-size:16px;margin-right:10px;">🃏 瀏覽商品</button>
          \${!user ? \`<button onclick="router.navigate('/login')" class="btn btn-secondary" style="padding:15px 40px;font-size:16px;">👤 會員登入</button>\` : \`<button onclick="router.navigate('/orders')" class="btn btn-secondary" style="padding:15px 40px;font-size:16px;">🧾 我的訂單</button>\`}
        </div>
      </div>
    \`
  }
  
  renderLoginPage() {
    if (authManager.isLoggedIn()) {
      const redirect = router.getQuery('redirect') || '/'
      router.navigate(redirect, { replace: true })
      return
    }
    
    document.getElementById('app').innerHTML = \`
      <div style="max-width:450px;margin:50px auto;">
        <div style="text-align:center;margin-bottom:40px;">
          <img src="https://i.postimg.cc/jSFPPTp5/photo-output.png" alt="Ning's Card" style="max-width:120px;margin-bottom:20px;opacity:0.9;">
          <h1 style="color:var(--navy);font-size:28px;margin-bottom:10px;">會員登入</h1>
          <p style="color:#666;">請使用手機號碼和生日登入</p>
        </div>
        
        <div style="background:white;padding:40px;border-radius:12px;box-shadow:0 5px 20px rgba(0,0,0,0.1);">
          <form id="loginForm" onsubmit="handleLogin(event)">
            <div style="margin-bottom:20px;">
              <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">📱 手機號碼</label>
              <input type="tel" id="loginPhone" placeholder="09xxxxxxxx" maxlength="10" required style="width:100%;padding:12px 15px;border:2px solid #e0e7ff;border-radius:8px;font-size:15px;">
            </div>
            
            <div style="margin-bottom:20px;">
              <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">🎂 生日（月日四碼）</label>
              <input type="text" id="loginBday" placeholder="MMDD (例如：0815)" maxlength="4" required style="width:100%;padding:12px 15px;border:2px solid #e0e7ff;border-radius:8px;font-size:15px;">
              <small style="color:#999;font-size:12px;margin-top:5px;display:block;">例如：8月15日請輸入 0815</small>
            </div>
            
            <div style="margin-bottom:25px;">
              <label style="display:flex;align-items:center;cursor:pointer;">
                <input type="checkbox" id="rememberMe" checked style="margin-right:8px;">
                <span style="color:#666;font-size:14px;">記住我的登入狀態（7天）</span>
              </label>
            </div>
            
            <button type="submit" class="btn btn-primary" style="width:100%;padding:14px;font-size:16px;">登入</button>
          </form>
        </div>
        
        <div style="text-align:center;margin-top:30px;">
          <a href="/" style="color:#666;text-decoration:none;font-size:14px;">← 返回首頁</a>
        </div>
      </div>
    \`
    
    setTimeout(() => document.getElementById('loginPhone')?.focus(), 100)
  }
  
  async renderProductsPage() {
    const search = router.currentRoute.search
    const category = search.get('category') || 'all'
    const status = search.get('status') || 'all'
    
    document.getElementById('app').innerHTML = \`
      <div>
        <h1 style="color:var(--navy);margin-bottom:20px;">🃏 Topps Now 商品</h1>
        <div id="productGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px;">
          <div style="text-align:center;padding:60px 20px;grid-column:1/-1;">
            <div class="spinner" style="margin:0 auto 20px;"></div>
            <p style="color:#666;">載入商品中...</p>
          </div>
        </div>
      </div>
    \`
    
    try {
      const response = await api.get('/api/products', { category, status })
      if (!response.success) throw new Error(response.message)
      
      const products = response.products || []
      const grid = document.getElementById('productGrid')
      
      if (products.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:60px 20px;grid-column:1/-1;"><p style="font-size:48px;margin-bottom:15px;">📭</p><p style="color:#666;">目前沒有商品</p></div>'
        return
      }
      
      grid.innerHTML = products.map(p => \`
        <div style="background:white;border-radius:10px;box-shadow:0 3px 10px rgba(0,0,0,0.08);border:2px solid #eee;transition:all 0.3s;cursor:pointer;">
          <div style="position:relative;padding-top:140%;background:linear-gradient(135deg,#f5f5f5,#e8e8e8);overflow:hidden;">
            \${p.image_url_1 ? \`<img src="\${p.image_url_1}" alt="\${p.item_name}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:auto;height:82%;object-fit:contain;">\` : ''}
          </div>
          <div style="padding:15px;">
            <div style="font-size:15px;font-weight:bold;color:#333;margin-bottom:8px;line-height:1.4;height:42px;overflow:hidden;">\${p.item_name}</div>
            <div style="font-size:20px;font-weight:bold;color:var(--navy);">$\${Number(p.price).toLocaleString()}</div>
          </div>
        </div>
      \`).join('')
      
    } catch (error) {
      document.getElementById('productGrid').innerHTML = \`
        <div style="text-align:center;padding:60px 20px;grid-column:1/-1;">
          <p style="font-size:48px;margin-bottom:15px;">❌</p>
          <p style="color:#666;margin-bottom:20px;">\${error.message}</p>
        </div>
      \`
    }
  }
  
  async renderOrdersPage() {
    const search = router.currentRoute.search
    const page = parseInt(search.get('page') || '1')
    const searchKeyword = search.get('search') || ''
    const user = authManager.getUser()
    
    if (!user) {
      router.navigate('/login')
      return
    }
    
    document.getElementById('app').innerHTML = \`
      <div>
        <h1 style="color:var(--navy);margin-bottom:20px;">🧾 我的訂單</h1>
        <div id="orderList">
          <div style="text-align:center;padding:60px 20px;">
            <div class="spinner" style="margin:0 auto 20px;"></div>
            <p style="color:#666;">載入訂單中...</p>
          </div>
        </div>
        <div id="pagination" style="margin-top:40px;"></div>
      </div>
    \`
    
    try {
      const response = await api.get('/api/orders', {
        user_id: user.id,
        page,
        per_page: 20,
        search: searchKeyword
      })
      
      if (!response.success) throw new Error(response.message)
      
      const { orders, stats, pagination } = response
      const listEl = document.getElementById('orderList')
      
      if (!orders || orders.length === 0) {
        listEl.innerHTML = '<div style="text-align:center;padding:60px 20px;"><p style="font-size:48px;margin-bottom:15px;">📭</p><p style="color:#666;">目前沒有訂單</p></div>'
        return
      }
      
      listEl.innerHTML = orders.map(o => {
        let statusClass = 'status-pending'
        let statusText = '待付款'
        if (o.is_shipped) { statusClass = 'status-shipped'; statusText = '已出貨' }
        else if (o.is_cleared) { statusClass = 'status-paid'; statusText = '已付款' }
        
        return \`
          <div style="background:white;border:2px solid #eee;border-radius:10px;padding:20px;margin-bottom:15px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding-bottom:15px;border-bottom:1px solid #eee;">
              <div>
                <strong style="font-size:16px;color:var(--navy);">\${o.item_name}</strong>
                \${o.card_no ? \`<div style="color:#666;font-size:13px;margin-top:4px;">卡號：\${o.card_no}</div>\` : ''}
              </div>
              <span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:bold;background:\${statusClass === 'status-shipped' ? '#cce5ff' : statusClass === 'status-paid' ? '#d4edda' : '#fff3cd'};color:\${statusClass === 'status-shipped' ? '#004085' : statusClass === 'status-paid' ? '#155724' : '#856404'};">\${statusText}</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;font-size:14px;">
              <div><span style="color:#666;font-weight:600;">數量</span>：\${o.quantity} 張</div>
              <div><span style="color:#666;font-weight:600;">總金額</span>：<strong style="color:var(--navy);">$\${Number(o.total_fee).toLocaleString()}</strong></div>
            </div>
          </div>
        \`
      }).join('')
      
      // 分頁
      if (pagination && pagination.total_pages > 1) {
        const pages = []
        for (let i = 1; i <= pagination.total_pages; i++) {
          if (i === 1 || i === pagination.total_pages || (i >= pagination.current_page - 2 && i <= pagination.current_page + 2)) {
            pages.push(i)
          } else if (pages[pages.length - 1] !== '...') {
            pages.push('...')
          }
        }
        
        document.getElementById('pagination').innerHTML = \`
          <div style="display:flex;justify-content:center;gap:10px;">
            \${pages.map(p => {
              if (p === '...') return '<span style="padding:8px;">...</span>'
              return \`<button onclick="router.navigate('/orders?page=\${p}')" style="padding:8px 16px;border:2px solid \${p === pagination.current_page ? 'var(--navy)' : '#ddd'};background:\${p === pagination.current_page ? 'var(--navy)' : 'white'};color:\${p === pagination.current_page ? 'white' : '#333'};border-radius:6px;cursor:pointer;font-weight:600;">\${p}</button>\`
            }).join('')}
          </div>
          <div style="text-align:center;margin-top:15px;color:#666;font-size:14px;">第 \${pagination.current_page} / \${pagination.total_pages} 頁</div>
        \`
      }
      
    } catch (error) {
      document.getElementById('orderList').innerHTML = \`
        <div style="text-align:center;padding:60px 20px;">
          <p style="font-size:48px;margin-bottom:15px;">❌</p>
          <p style="color:#666;margin-bottom:20px;">\${error.message}</p>
        </div>
      \`
    }
  }
}

// ============================================
// 全域工具函數
// ============================================
window.showLoading = (text = '載入中...') => {
  const overlay = document.getElementById('loadingOverlay')
  const loadingText = document.getElementById('loadingText')
  if (overlay) overlay.classList.add('show')
  if (loadingText) loadingText.textContent = text
}

window.hideLoading = () => {
  const overlay = document.getElementById('loadingOverlay')
  if (overlay) overlay.classList.remove('show')
}

window.toggleSidebar = () => {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebarOverlay')
  sidebar.classList.toggle('open')
  overlay.classList.toggle('show')
}

window.formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

window.formatMoney = (amount) => {
  return \`$\${Number(amount).toLocaleString('zh-TW')}\`
}

window.handleLogin = async (event) => {
  event.preventDefault()
  const phone = document.getElementById('loginPhone').value.trim()
  const birthday = document.getElementById('loginBday').value.trim()
  const remember = document.getElementById('rememberMe').checked
  
  if (!phone || !/^09\d{8}$/.test(phone)) {
    app.showToast('❌ 請輸入正確的手機號碼（09開頭，共10碼）')
    return
  }
  
  if (!birthday || !/^\d{4}$/.test(birthday)) {
    app.showToast('❌ 請輸入正確的生日（MMDD格式，共4碼）')
    return
  }
  
  try {
    const user = await authManager.login(phone, birthday, remember)
    app.showToast(\`✅ 歡迎回來，\${user.nickname || user.phone}！\`)
    const redirect = router.getQuery('redirect') || '/'
    router.navigate(redirect, { replace: true })
  } catch (error) {
    app.showToast(\`❌ \${error.message}\`)
  }
}

// ============================================
// 初始化
// ============================================
window.router = new Router()
window.api = new API()
window.authManager = new AuthManager()
window.app = new App()

document.addEventListener('DOMContentLoaded', () => {
  window.app.init()
})
`

/**
 * HTML 內容（包含所有前端程式碼）
 */
const HTML_CONTENT = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Ning's Card Store</title>
  <link rel="icon" type="image/png" href="https://i.postimg.cc/jSFPPTp5/photo-output.png">
  
  <style>
    :root {
      --navy: #0a2342;
      --navy-2: #1c3a63;
      --orange: #e67e22;
      --red: #d32f2f;
      --green: #28a745;
      --bg-light: #f8f9fa;
    }
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f0f2f5;
      min-height: 100vh;
      padding-top: 60px;
      overflow-x: hidden;
    }
    
    /* 浮水印 */
    body::after {
      content: "";
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: url('https://i.postimg.cc/jSFPPTp5/photo-output.png');
      background-repeat: no-repeat;
      background-position: center;
      background-size: 40%;
      z-index: 99999;
      pointer-events: none;
      opacity: 0.05;
    }
    
    /* Header */
    .app-header {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 60px;
      background: linear-gradient(90deg, var(--navy), var(--navy-2));
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 15px;
      z-index: 2000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.15);
    }
    
    .header-left { display: flex; align-items: center; gap: 15px; }
    .menu-btn { background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 5px; }
    .header-title { color: white; font-weight: bold; font-size: 18px; letter-spacing: 1px; cursor: pointer; }
    .header-right { display: flex; align-items: center; gap: 10px; }
    
    .nav-btn {
      background: rgba(255,255,255,0.15);
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 20px;
      cursor: pointer;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 5px;
      transition: 0.2s;
      font-size: 13px;
      white-space: nowrap;
    }
    .nav-btn:hover { background: rgba(255,255,255,0.25); }
    .cart-btn { position: relative; }
    .cart-badge {
      position: absolute;
      top: -6px; right: -6px;
      background: var(--red);
      color: white;
      border-radius: 50%;
      width: 20px; height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: bold;
      border: 2px solid #fff;
    }
    
    /* Sidebar */
    .sidebar {
      position: fixed;
      top: 0; left: 0; bottom: 0;
      width: 280px;
      background: #fff;
      z-index: 2500;
      transform: translateX(-100%);
      transition: transform 0.3s ease-in-out;
      box-shadow: 2px 0 10px rgba(0,0,0,0.1);
      display: flex;
      flex-direction: column;
    }
    .sidebar.open { transform: translateX(0); }
    .sidebar-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 2400;
      display: none;
      backdrop-filter: blur(2px);
    }
    .sidebar-overlay.show { display: block; }
    
    .sidebar-header {
      background: var(--bg-light);
      color: #333;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sidebar-header.logged-in { background: var(--navy); color: white; }
    .user-info { font-size: 16px; font-weight: bold; }
    .sidebar-menu { flex: 1; overflow-y: auto; padding: 10px 0; }
    
    .menu-item {
      display: flex;
      align-items: center;
      padding: 15px 20px;
      color: #333;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      border-left: 4px solid transparent;
      transition: all 0.2s;
      cursor: pointer;
    }
    .menu-item:hover { background: #f8f9fa; }
    .menu-item.active {
      background: #e3f2fd;
      color: var(--navy);
      border-left-color: var(--navy);
      font-weight: bold;
    }
    .menu-icon { margin-right: 12px; font-size: 18px; }
    .member-only { display: none; }
    .member-only.show { display: flex; }
    
    /* Main Container */
    .container {
      max-width: 1200px;
      margin: 20px auto;
      background: #fff;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.05);
      min-height: 80vh;
    }
    
    /* Loading */
    .loading-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 9999;
      display: none;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(3px);
    }
    .loading-overlay.show { display: flex; }
    .loading-spinner {
      background: white;
      padding: 30px 40px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid var(--navy);
      border-radius: 50%;
      width: 50px; height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 15px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    /* Buttons */
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      transition: 0.2s;
      font-size: 14px;
      text-decoration: none;
      display: inline-block;
      text-align: center;
    }
    .btn-primary { background: var(--navy); color: white; }
    .btn-primary:hover { background: var(--navy-2); }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-secondary:hover { background: #5a6268; }
    .btn:disabled { background: #bdc3c7 !important; cursor: not-allowed; }
    
    /* Toast */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-50%) translateY(10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    /* Responsive */
    @media (max-width: 768px) {
      .container { margin: 10px; padding: 15px; }
      .header-title { font-size: 16px; }
      .nav-btn { padding: 6px 10px; font-size: 12px; }
      .nav-btn-text { display: none; }
    }
  </style>
</head>
<body>
  <header class="app-header">
    <div class="header-left">
      <button class="menu-btn" onclick="toggleSidebar()">☰</button>
      <div class="header-title" onclick="router.navigate('/')">Ning's Card</div>
    </div>
    <div class="header-right" id="headerActions"></div>
  </header>
  
  <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-header" id="sidebarHeader">
      <div class="user-info" id="userInfo">未登入</div>
    </div>
    <div class="sidebar-menu" id="sidebarMenu"></div>
  </nav>
  
  <main id="app" class="container">
    <div style="text-align:center;padding:100px 20px;">
      <div class="spinner"></div>
      <p style="color:#666;margin-top:20px;">載入中...</p>
    </div>
  </main>
  
  <div class="loading-overlay" id="loadingOverlay">
    <div class="loading-spinner">
      <div class="spinner"></div>
      <div id="loadingText">處理中...</div>
    </div>
  </div>
  
  <script>
${FRONTEND_JS}
  </script>
</body>
</html>`
