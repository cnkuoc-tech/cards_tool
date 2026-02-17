/**
 * API 呼叫封裝 - 統一處理 API 請求
 */

class API {
  constructor(baseURL) {
    this.baseURL = baseURL || window.location.origin
  }
  
  /**
   * 通用 HTTP 請求
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }
    
    // 加入認證 token（如果有）
    const user = window.authManager?.getUser()
    if (user?.token) {
      defaultOptions.headers['Authorization'] = `Bearer ${user.token}`
    }
    
    const finalOptions = { ...defaultOptions, ...options }
    
    // 顯示載入中
    if (options.showLoading !== false) {
      window.showLoading?.()
    }
    
    try {
      const response = await fetch(url, finalOptions)
      
      // 隱藏載入中
      window.hideLoading?.()
      
      // 處理錯誤狀態
      if (!response.ok) {
        if (response.status === 401) {
          // 未授權，清除登入狀態
          window.authManager?.logout()
          window.router?.navigate('/login')
          throw new Error('登入已過期，請重新登入')
        }
        
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`)
      }
      
      // 解析回應
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
  
  /**
   * GET 請求
   */
  async get(endpoint, query = {}, options = {}) {
    const queryString = new URLSearchParams(query).toString()
    const url = queryString ? `${endpoint}?${queryString}` : endpoint
    
    return this.request(url, {
      method: 'GET',
      ...options
    })
  }
  
  /**
   * POST 請求
   */
  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options
    })
  }
  
  /**
   * PUT 請求
   */
  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options
    })
  }
  
  /**
   * DELETE 請求
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...options
    })
  }
}

// 全域 API 實例
window.api = new API()
