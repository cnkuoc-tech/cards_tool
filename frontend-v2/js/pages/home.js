/**
 * 首頁
 */

window.HomePage = {
  async render() {
    const user = authManager.getUser()
    
    document.getElementById('app').innerHTML = `
      <div style="text-align:center;padding:40px 20px;">
        <img src="https://i.postimg.cc/jSFPPTp5/photo-output.png" 
             alt="Ning's Card" 
             style="max-width:200px;margin-bottom:30px;opacity:0.9;">
        
        <h1 style="color:var(--navy);font-size:32px;margin-bottom:15px;">
          歡迎來到 Ning's Card
        </h1>
        
        <p style="color:#666;font-size:18px;margin-bottom:40px;">
          您的棒球卡專業收藏平台
        </p>
        
        ${user ? `
          <p style="color:#333;font-size:16px;margin-bottom:30px;">
            👋 嗨，<strong>${user.nickname || user.phone}</strong>！
          </p>
          
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;max-width:800px;margin:0 auto;">
            <a href="/products" class="home-card">
              <div class="home-card-icon">🃏</div>
              <h3>Topps Now</h3>
              <p>瀏覽最新商品</p>
            </a>
            
            <a href="/orders" class="home-card">
              <div class="home-card-icon">🧾</div>
              <h3>我的訂單</h3>
              <p>查看訂單狀態</p>
            </a>
            
            <a href="/breaks" class="home-card">
              <div class="home-card-icon">🎲</div>
              <h3>我的團拆</h3>
              <p>查看團拆記錄</p>
            </a>
            
            <a href="/fortune" class="home-card">
              <div class="home-card-icon">🔮</div>
              <h3>運勢抽籤</h3>
              <p>試試今天的運氣</p>
            </a>
          </div>
        ` : `
          <div style="max-width:400px;margin:0 auto;">
            <p style="color:#666;margin-bottom:25px;">
              請先登入以使用完整功能
            </p>
            
            <button onclick="router.navigate('/login')" class="btn btn-primary" style="width:100%;padding:15px;font-size:16px;">
              👤 立即登入
            </button>
            
            <p style="margin-top:20px;color:#999;font-size:14px;">
              或
            </p>
            
            <button onclick="router.navigate('/products')" class="btn btn-secondary" style="width:100%;padding:15px;font-size:16px;margin-top:10px;">
              🃏 先看看商品
            </button>
          </div>
        `}
        
        <div style="margin-top:60px;padding-top:40px;border-top:2px solid #eee;">
          <h2 style="color:var(--navy);margin-bottom:20px;">📢 最新公告</h2>
          <div style="background:#fff3cd;padding:20px;border-radius:8px;border-left:4px solid #ff9800;max-width:600px;margin:0 auto;text-align:left;">
            <p style="margin:0 0 10px;"><strong>🎉 新功能上線！</strong></p>
            <p style="margin:0;color:#666;">現在支援 URL 分頁功能，重新整理頁面不會回到首頁囉！</p>
          </div>
        </div>
      </div>
      
      <style>
        .home-card {
          background: white;
          padding: 30px 20px;
          border-radius: 12px;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
          border: 2px solid #eee;
          text-decoration: none;
          color: #333;
          transition: all 0.3s;
          display: block;
        }
        
        .home-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          border-color: var(--navy);
        }
        
        .home-card-icon {
          font-size: 48px;
          margin-bottom: 15px;
        }
        
        .home-card h3 {
          color: var(--navy);
          font-size: 20px;
          margin-bottom: 8px;
        }
        
        .home-card p {
          color: #666;
          font-size: 14px;
          margin: 0;
        }
      </style>
    `
  }
}
