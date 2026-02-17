/**
 * 認證管理器 - 處理登入/登出狀態
 */

class AuthManager {
  constructor() {
    this.storageKey = 'ning_card_user'
    this.user = null
    this.loadUserFromStorage()
  }
  
  /**
   * 從 localStorage 載入用戶
   */
  loadUserFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        this.user = JSON.parse(stored)
        
        // 檢查是否過期（7天）
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
  
  /**
   * 登入
   */
  async login(phone, birthday, remember = true) {
    try {
      const response = await window.api.post('/api/login', {
        phone,
        birthday
      })
      
      if (!response.success) {
        throw new Error(response.message || '登入失敗')
      }
      
      // 儲存用戶資料
      this.user = {
        ...response.user,
        loginTime: Date.now()
      }
      
      if (remember) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.user))
      }
      
      // 觸發登入事件
      window.dispatchEvent(new CustomEvent('user-login', { detail: this.user }))
      
      return this.user
      
    } catch (error) {
      console.error('登入失敗:', error)
      throw error
    }
  }
  
  /**
   * 登出
   */
  logout() {
    this.user = null
    localStorage.removeItem(this.storageKey)
    
    // 觸發登出事件
    window.dispatchEvent(new CustomEvent('user-logout'))
    
    // 導航到登入頁
    window.router?.navigate('/login')
  }
  
  /**
   * 檢查是否已登入
   */
  isLoggedIn() {
    return this.user !== null
  }
  
  /**
   * 取得當前用戶
   */
  getUser() {
    return this.user
  }
  
  /**
   * 更新用戶資料
   */
  updateUser(updates) {
    if (!this.user) return
    
    this.user = {
      ...this.user,
      ...updates
    }
    
    localStorage.setItem(this.storageKey, JSON.stringify(this.user))
    
    // 觸發更新事件
    window.dispatchEvent(new CustomEvent('user-update', { detail: this.user }))
  }
}

// 全域認證管理器實例
window.authManager = new AuthManager()
