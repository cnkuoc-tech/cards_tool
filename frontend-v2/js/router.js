/**
 * 路由管理器 - 支援 URL 路由，重新整理不會重來
 */

class Router {
  constructor() {
    this.routes = new Map()
    this.currentRoute = null
    this.beforeRouteChange = null
    
    // 監聽瀏覽器上一頁/下一頁
    window.addEventListener('popstate', (e) => {
      this.loadCurrentRoute()
    })
    
    // 攔截所有 <a> 標籤點擊
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href]')
      if (link && link.href.startsWith(window.location.origin)) {
        e.preventDefault()
        this.navigate(link.pathname + link.search + link.hash)
      }
    })
  }
  
  /**
   * 註冊路由
   * @param {string} path - 路由路徑（支援參數，例如 /products/:id）
   * @param {Function} handler - 處理函數
   * @param {Object} meta - 路由元資訊（例如 requireAuth）
   */
  register(path, handler, meta = {}) {
    this.routes.set(path, { handler, meta })
    return this
  }
  
  /**
   * 導航到指定路徑（不重新載入頁面）
   * @param {string} path - 目標路徑
   * @param {Object} options - 選項 { replace: boolean, state: any }
   */
  async navigate(path, options = {}) {
    // 執行路由變更前的鉤子
    if (this.beforeRouteChange) {
      const canNavigate = await this.beforeRouteChange(this.currentRoute, path)
      if (canNavigate === false) return
    }
    
    // 更新瀏覽器歷史記錄
    if (options.replace) {
      window.history.replaceState(options.state || {}, '', path)
    } else {
      window.history.pushState(options.state || {}, '', path)
    }
    
    // 載入新路由
    await this.loadCurrentRoute()
  }
  
  /**
   * 載入當前 URL 對應的路由
   */
  async loadCurrentRoute() {
    const path = window.location.pathname
    const search = new URLSearchParams(window.location.search)
    const hash = window.location.hash
    
    // 尋找匹配的路由
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
    
    // 404 處理
    if (!matchedRoute) {
      matchedRoute = this.routes.get('/404') || {
        handler: () => {
          document.getElementById('app').innerHTML = `
            <div style="text-align:center;padding:100px 20px;">
              <h1 style="font-size:72px;color:#ccc;margin:0;">404</h1>
              <p style="font-size:20px;color:#666;">找不到此頁面</p>
              <button onclick="router.navigate('/')" class="btn btn-primary" style="margin-top:20px;">返回首頁</button>
            </div>
          `
        },
        meta: {}
      }
    }
    
    // 檢查權限
    if (matchedRoute.meta.requireAuth && !window.authManager?.isLoggedIn()) {
      this.navigate('/login?redirect=' + encodeURIComponent(path + window.location.search))
      return
    }
    
    // 更新當前路由
    this.currentRoute = { path, search, hash, params }
    
    // 執行路由處理函數
    try {
      await matchedRoute.handler({ path, search, hash, params })
    } catch (error) {
      console.error('路由處理錯誤:', error)
      this.showError(error)
    }
  }
  
  /**
   * 匹配路由路徑
   * @param {string} routePath - 路由定義（例如 /products/:id）
   * @param {string} actualPath - 實際路徑（例如 /products/123）
   */
  matchRoute(routePath, actualPath) {
    // 簡單匹配（不含參數）
    if (routePath === actualPath) {
      return { params: {} }
    }
    
    // 參數匹配
    const routeParts = routePath.split('/').filter(Boolean)
    const actualParts = actualPath.split('/').filter(Boolean)
    
    if (routeParts.length !== actualParts.length) {
      return null
    }
    
    const params = {}
    
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i]
      const actualPart = actualParts[i]
      
      if (routePart.startsWith(':')) {
        // 參數部分
        const paramName = routePart.slice(1)
        params[paramName] = actualPart
      } else if (routePart !== actualPart) {
        // 不匹配
        return null
      }
    }
    
    return { params }
  }
  
  /**
   * 取得當前 URL 參數
   */
  getQuery(key) {
    return new URLSearchParams(window.location.search).get(key)
  }
  
  /**
   * 取得當前路由參數
   */
  getParams() {
    return this.currentRoute?.params || {}
  }
  
  /**
   * 返回上一頁
   */
  back() {
    window.history.back()
  }
  
  /**
   * 顯示錯誤訊息
   */
  showError(error) {
    document.getElementById('app').innerHTML = `
      <div style="max-width:600px;margin:50px auto;padding:30px;background:#fee;border-radius:12px;border:2px solid #f66;">
        <h2 style="color:#d00;margin:0 0 15px;">⚠️ 發生錯誤</h2>
        <p style="color:#666;margin:0 0 20px;">${error.message || '未知錯誤'}</p>
        <button onclick="router.back()" class="btn btn-secondary">返回上一頁</button>
        <button onclick="router.navigate('/')" class="btn btn-primary" style="margin-left:10px;">返回首頁</button>
      </div>
    `
  }
  
  /**
   * 初始化路由器
   */
  async init() {
    await this.loadCurrentRoute()
  }
}

// 全域路由器實例
window.router = new Router()
