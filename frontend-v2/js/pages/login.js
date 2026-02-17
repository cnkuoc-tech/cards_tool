/**
 * 登入頁面
 */

window.LoginPage = {
  async render({ search }) {
    // 如果已登入，導向首頁
    if (authManager.isLoggedIn()) {
      const redirect = search.get('redirect') || '/'
      router.navigate(redirect, { replace: true })
      return
    }
    
    document.getElementById('app').innerHTML = `
      <div style="max-width:450px;margin:50px auto;">
        <div style="text-align:center;margin-bottom:40px;">
          <img src="https://i.postimg.cc/jSFPPTp5/photo-output.png" 
               alt="Ning's Card" 
               style="max-width:120px;margin-bottom:20px;opacity:0.9;">
          <h1 style="color:var(--navy);font-size:28px;margin-bottom:10px;">會員登入</h1>
          <p style="color:#666;">請使用手機號碼和生日登入</p>
        </div>
        
        <div style="background:white;padding:40px;border-radius:12px;box-shadow:0 5px 20px rgba(0,0,0,0.1);">
          <form id="loginForm" onsubmit="window.LoginPage.handleLogin(event)">
            <div style="margin-bottom:20px;">
              <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">
                📱 手機號碼
              </label>
              <input 
                type="tel" 
                id="loginPhone" 
                class="form-input"
                placeholder="09xxxxxxxx"
                maxlength="10"
                required
                style="width:100%;padding:12px 15px;border:2px solid #e0e7ff;border-radius:8px;font-size:15px;transition:all 0.3s;"
                onfocus="this.style.borderColor='var(--navy)'"
                onblur="this.style.borderColor='#e0e7ff'"
              >
            </div>
            
            <div style="margin-bottom:20px;">
              <label style="display:block;margin-bottom:8px;font-weight:600;color:#333;">
                🎂 生日（月日四碼）
              </label>
              <input 
                type="text" 
                id="loginBday" 
                class="form-input"
                placeholder="MMDD (例如：0815)"
                maxlength="4"
                required
                style="width:100%;padding:12px 15px;border:2px solid #e0e7ff;border-radius:8px;font-size:15px;transition:all 0.3s;"
                onfocus="this.style.borderColor='var(--navy)'"
                onblur="this.style.borderColor='#e0e7ff'"
              >
              <small style="color:#999;font-size:12px;margin-top:5px;display:block;">
                例如：8月15日請輸入 0815
              </small>
            </div>
            
            <div style="margin-bottom:25px;">
              <label style="display:flex;align-items:center;cursor:pointer;">
                <input type="checkbox" id="rememberMe" checked style="margin-right:8px;">
                <span style="color:#666;font-size:14px;">記住我的登入狀態（7天）</span>
              </label>
            </div>
            
            <button type="submit" class="btn btn-primary" style="width:100%;padding:14px;font-size:16px;">
              登入
            </button>
          </form>
          
          <div style="margin-top:25px;padding-top:20px;border-top:1px solid #eee;text-align:center;">
            <p style="color:#999;font-size:13px;margin:0 0 10px;">還沒有帳號？</p>
            <p style="color:#666;font-size:14px;margin:0;">
              請先在 LINE 官方帳號註冊，或直接
              <a href="/products" style="color:var(--navy);font-weight:bold;">瀏覽商品</a>
            </p>
          </div>
        </div>
        
        <div style="text-align:center;margin-top:30px;">
          <a href="/" style="color:#666;text-decoration:none;font-size:14px;">
            ← 返回首頁
          </a>
        </div>
      </div>
    `
    
    // 自動 focus 手機號碼欄位
    setTimeout(() => {
      document.getElementById('loginPhone')?.focus()
    }, 100)
  },
  
  async handleLogin(event) {
    event.preventDefault()
    
    const phone = document.getElementById('loginPhone').value.trim()
    const birthday = document.getElementById('loginBday').value.trim()
    const remember = document.getElementById('rememberMe').checked
    
    // 驗證格式
    if (!phone || !/^09\d{8}$/.test(phone)) {
      app.showToast('❌ 請輸入正確的手機號碼（09開頭，共10碼）')
      return
    }
    
    if (!birthday || !/^\d{4}$/.test(birthday)) {
      app.showToast('❌ 請輸入正確的生日（MMDD格式，共4碼）')
      return
    }
    
    try {
      // 呼叫登入 API
      const user = await authManager.login(phone, birthday, remember)
      
      app.showToast(`✅ 歡迎回來，${user.nickname || user.phone}！`)
      
      // 導向原本要去的頁面，或首頁
      const redirect = router.getQuery('redirect') || '/'
      router.navigate(redirect, { replace: true })
      
    } catch (error) {
      app.showToast(`❌ ${error.message}`)
      console.error('登入失敗:', error)
    }
  }
}
