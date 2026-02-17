/**
 * 主應用程式 - 初始化和全域功能
 */

class App {
  constructor() {
    this.cart = []
    this.loadCartFromStorage()
  }
  
  /**
   * 初始化應用程式
   */
  async init() {
    console.log('🚀 Ning\'s Card App 啟動中...')
    
    // 註冊路由
    this.registerRoutes()
    
    // 設定事件監聽
    this.setupEventListeners()
    
    // 更新 UI
    this.updateUI()
    
    // 啟動路由器
    await router.init()
    
    console.log('✅ App 已啟動')
  }
  
  /**
   * 註冊所有路由
   */
  registerRoutes() {
    // 首頁
    router.register('/', window.HomePage?.render)
    
    // 登入
    router.register('/login', window.LoginPage?.render)
    
    // 商品
    router.register('/products', window.ProductsPage?.render)
    router.register('/products/:id', window.ProductDetailPage?.render)
    
    // 訂單
    router.register('/orders', window.OrdersPage?.render, { requireAuth: true })
    
    // 團拆
    router.register('/breaks', window.BreaksPage?.render, { requireAuth: true })
    
    // PSA
    router.register('/psa', window.PSAPage?.render, { requireAuth: true })
    
    // 會員
    router.register('/profile', window.ProfilePage?.render, { requireAuth: true })
    
    // 運勢
    router.register('/fortune', window.FortunePage?.render)
    
    // 關於
    router.register('/about', window.AboutPage?.render)
  }
  
  /**
   * 設定事件監聽
   */
  setupEventListeners() {
    // 監聽登入事件
    window.addEventListener('user-login', () => {
      this.updateUI()
    })
    
    // 監聽登出事件
    window.addEventListener('user-logout', () => {
      this.updateUI()
      this.clearCart()
    })
    
    // 監聽購物車變更
    window.addEventListener('cart-update', () => {
      this.updateCartUI()
    })
  }
  
  /**
   * 更新 UI（側邊欄、Header等）
   */
  updateUI() {
    this.updateSidebar()
    this.updateHeader()
    this.updateCartUI()
  }
  
  /**
   * 更新側邊欄
   */
  updateSidebar() {
    const user = authManager.getUser()
    const sidebarHeader = document.getElementById('sidebarHeader')
    const sidebarMenu = document.getElementById('sidebarMenu')
    const userInfo = document.getElementById('userInfo')
    
    // 更新用戶資訊
    if (user) {
      sidebarHeader.classList.add('logged-in')
      userInfo.textContent = `👤 ${user.nickname || user.phone}`
    } else {
      sidebarHeader.classList.remove('logged-in')
      userInfo.textContent = '未登入'
    }
    
    // 更新選單
    const menuItems = [
      { path: '/', icon: '🏠', label: '首頁', auth: false },
      { path: '/products', icon: '🃏', label: 'Topps Now', auth: false },
      { path: '/fortune', icon: '🔮', label: '運勢抽籤', auth: false },
      { path: '/about', icon: 'ℹ️', label: '關於我們', auth: false },
      { divider: true },
      { path: '/orders', icon: '🧾', label: '我的訂單', auth: true },
      { path: '/breaks', icon: '🎲', label: '我的團拆', auth: true },
      { path: '/psa', icon: '🏆', label: 'PSA 鑑定', auth: true },
      { path: '/profile', icon: '👤', label: '會員資料', auth: true },
    ]
    
    sidebarMenu.innerHTML = menuItems.map(item => {
      if (item.divider) {
        return '<hr style="margin:10px 0;border:none;border-top:1px solid #eee;">'
      }
      
      const memberClass = item.auth ? `member-only ${user ? 'show' : ''}` : ''
      const activeClass = window.location.pathname === item.path ? 'active' : ''
      
      return `
        <a href="${item.path}" class="menu-item ${memberClass} ${activeClass}" onclick="toggleSidebar()">
          <span class="menu-icon">${item.icon}</span>
          ${item.label}
        </a>
      `
    }).join('')
    
    // 登出按鈕
    if (user) {
      sidebarMenu.innerHTML += `
        <a href="#" class="menu-item" onclick="event.preventDefault(); authManager.logout()">
          <span class="menu-icon">🚪</span>
          登出
        </a>
      `
    }
  }
  
  /**
   * 更新 Header 按鈕
   */
  updateHeader() {
    const user = authManager.getUser()
    const headerActions = document.getElementById('headerActions')
    
    if (user) {
      headerActions.innerHTML = `
        <button class="nav-btn cart-btn" onclick="router.navigate('/cart')">
          <span>🛒</span>
          <span class="nav-btn-text">購物車</span>
          <span class="cart-badge" id="cartBadge">0</span>
        </button>
      `
    } else {
      headerActions.innerHTML = `
        <button class="nav-btn" onclick="router.navigate('/login')">
          <span>👤</span>
          <span class="nav-btn-text">登入</span>
        </button>
      `
    }
  }
  
  /**
   * 更新購物車 UI
   */
  updateCartUI() {
    const badge = document.getElementById('cartBadge')
    if (badge) {
      const count = this.cart.reduce((sum, item) => sum + item.quantity, 0)
      badge.textContent = count
      badge.style.display = count > 0 ? 'flex' : 'none'
    }
  }
  
  /**
   * 購物車功能
   */
  loadCartFromStorage() {
    try {
      const stored = localStorage.getItem('ning_card_cart')
      this.cart = stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error('載入購物車失敗:', error)
      this.cart = []
    }
  }
  
  saveCartToStorage() {
    localStorage.setItem('ning_card_cart', JSON.stringify(this.cart))
    window.dispatchEvent(new CustomEvent('cart-update'))
  }
  
  addToCart(product, quantity = 1) {
    const existing = this.cart.find(item => item.product.id === product.id)
    
    if (existing) {
      existing.quantity += quantity
    } else {
      this.cart.push({ product, quantity, addedAt: Date.now() })
    }
    
    this.saveCartToStorage()
    this.showToast(`✅ 已加入購物車：${product.item_name}`)
  }
  
  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.product.id !== productId)
    this.saveCartToStorage()
  }
  
  clearCart() {
    this.cart = []
    this.saveCartToStorage()
  }
  
  getCart() {
    return this.cart
  }
  
  /**
   * 顯示 Toast 訊息
   */
  showToast(message, duration = 3000) {
    // 移除舊的 toast
    const old = document.getElementById('toast')
    if (old) old.remove()
    
    // 建立新的 toast
    const toast = document.createElement('div')
    toast.id = 'toast'
    toast.textContent = message
    toast.style.cssText = `
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
    `
    
    document.body.appendChild(toast)
    
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease-in-out'
      setTimeout(() => toast.remove(), 300)
    }, duration)
  }
}

/**
 * 全域工具函數
 */

// 顯示載入中
window.showLoading = (text = '載入中...') => {
  const overlay = document.getElementById('loadingOverlay')
  const loadingText = document.getElementById('loadingText')
  if (overlay) overlay.classList.add('show')
  if (loadingText) loadingText.textContent = text
}

// 隱藏載入中
window.hideLoading = () => {
  const overlay = document.getElementById('loadingOverlay')
  if (overlay) overlay.classList.remove('show')
}

// 切換側邊欄
window.toggleSidebar = () => {
  const sidebar = document.getElementById('sidebar')
  const overlay = document.getElementById('sidebarOverlay')
  
  sidebar.classList.toggle('open')
  overlay.classList.toggle('show')
}

// 格式化日期
window.formatDate = (dateString) => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('zh-TW', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  })
}

// 格式化金額
window.formatMoney = (amount) => {
  return `$${Number(amount).toLocaleString('zh-TW')}`
}

// 全域 App 實例
window.app = new App()

// 加入 CSS 動畫
const style = document.createElement('style')
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  
  @keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`
document.head.appendChild(style)
