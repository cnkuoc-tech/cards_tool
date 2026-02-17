/**
 * 商品列表頁面
 */

window.ProductsPage = {
  async render({ search }) {
    const category = search.get('category') || 'all'
    const status = search.get('status') || 'all'
    
    document.getElementById('app').innerHTML = `
      <div>
        <h1 style="color:var(--navy);margin-bottom:20px;">🃏 Topps Now 商品</h1>
        
        <!-- 篩選器 -->
        <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:30px;">
          <div style="display:flex;gap:15px;flex-wrap:wrap;align-items:center;">
            <div>
              <label style="font-weight:600;margin-right:10px;">分類：</label>
              <select id="categoryFilter" onchange="window.ProductsPage.applyFilters()" style="padding:8px 12px;border-radius:6px;border:2px solid #ddd;">
                <option value="all">全部</option>
                <option value="topps_now">Topps Now</option>
                <option value="box">卡盒</option>
                <option value="special">特殊商品</option>
              </select>
            </div>
            
            <div>
              <label style="font-weight:600;margin-right:10px;">狀態：</label>
              <select id="statusFilter" onchange="window.ProductsPage.applyFilters()" style="padding:8px 12px;border-radius:6px;border:2px solid #ddd;">
                <option value="all">全部</option>
                <option value="available">可訂購</option>
                <option value="in_stock">現貨</option>
                <option value="pre_order">預購中</option>
              </select>
            </div>
            
            <div style="flex:1;"></div>
            
            <div id="productCount" style="color:#666;font-size:14px;">
              載入中...
            </div>
          </div>
        </div>
        
        <!-- 商品列表 -->
        <div id="productGrid" class="product-grid">
          <div style="text-align:center;padding:60px 20px;grid-column:1/-1;">
            <div class="spinner" style="margin:0 auto 20px;"></div>
            <p style="color:#666;">載入商品中...</p>
          </div>
        </div>
        
        <!-- 分頁 -->
        <div id="pagination" style="margin-top:40px;"></div>
      </div>
      
      <style>
        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        
        .product-card {
          background: white;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 3px 10px rgba(0,0,0,0.08);
          transition: all 0.3s;
          border: 2px solid #eee;
          cursor: pointer;
          display: flex;
          flex-direction: column;
        }
        
        .product-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.15);
          border-color: var(--navy);
        }
        
        .product-image {
          position: relative;
          padding-top: 140%;
          background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%);
          overflow: hidden;
        }
        
        .product-image img {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: auto;
          height: 82%;
          object-fit: contain;
        }
        
        .product-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          color: white;
          z-index: 2;
        }
        
        .badge-stock {
          background: var(--green);
        }
        
        .badge-pre {
          background: var(--orange);
        }
        
        .product-info {
          padding: 15px;
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        
        .product-title {
          font-size: 15px;
          font-weight: bold;
          color: #333;
          margin-bottom: 8px;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          height: 42px;
        }
        
        .product-price {
          font-size: 20px;
          font-weight: bold;
          color: var(--navy);
          margin-top: auto;
        }
        
        .product-old-price {
          font-size: 14px;
          color: #999;
          text-decoration: line-through;
          margin-left: 8px;
        }
        
        @media (max-width: 768px) {
          .product-grid {
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 15px;
          }
        }
      </style>
    `
    
    // 設定篩選器的值
    document.getElementById('categoryFilter').value = category
    document.getElementById('statusFilter').value = status
    
    // 載入商品
    await this.loadProducts()
  },
  
  async loadProducts() {
    try {
      const category = document.getElementById('categoryFilter')?.value || 'all'
      const status = document.getElementById('statusFilter')?.value || 'all'
      
      // 呼叫 API 取得商品列表
      const response = await api.get('/api/products', { category, status })
      
      if (!response.success) {
        throw new Error(response.message || '取得商品失敗')
      }
      
      const products = response.products || []
      
      // 更新商品數量
      document.getElementById('productCount').textContent = `共 ${products.length} 項商品`
      
      // 渲染商品列表
      const grid = document.getElementById('productGrid')
      
      if (products.length === 0) {
        grid.innerHTML = `
          <div style="text-align:center;padding:60px 20px;grid-column:1/-1;">
            <p style="font-size:48px;margin-bottom:15px;">📭</p>
            <p style="color:#666;font-size:16px;">目前沒有商品</p>
          </div>
        `
        return
      }
      
      grid.innerHTML = products.map(product => `
        <div class="product-card" onclick="router.navigate('/products/${product.id}')">
          <div class="product-image">
            ${product.image_url_1 ? `
              <img src="${product.image_url_1}" alt="${product.item_name}" loading="lazy">
            ` : ''}
            ${product.stock_status === 'Y' ? '<div class="product-badge badge-stock">現貨</div>' : ''}
            ${product.stock_status === 'P' ? '<div class="product-badge badge-pre">預購</div>' : ''}
          </div>
          <div class="product-info">
            <div class="product-title">${product.item_name}</div>
            <div class="product-price">
              ${formatMoney(product.price)}
              ${product.threshold_price && product.threshold_price < product.price ? 
                `<span class="product-old-price">${formatMoney(product.threshold_price)}</span>` : ''}
            </div>
          </div>
        </div>
      `).join('')
      
    } catch (error) {
      console.error('載入商品失敗:', error)
      document.getElementById('productGrid').innerHTML = `
        <div style="text-align:center;padding:60px 20px;grid-column:1/-1;">
          <p style="font-size:48px;margin-bottom:15px;">❌</p>
          <p style="color:#666;font-size:16px;margin-bottom:20px;">${error.message}</p>
          <button onclick="window.ProductsPage.loadProducts()" class="btn btn-primary">重新載入</button>
        </div>
      `
    }
  },
  
  applyFilters() {
    const category = document.getElementById('categoryFilter').value
    const status = document.getElementById('statusFilter').value
    
    // 更新 URL（會觸發重新渲染）
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    if (status !== 'all') params.set('status', status)
    
    const query = params.toString()
    router.navigate(`/products${query ? '?' + query : ''}`)
  }
}
