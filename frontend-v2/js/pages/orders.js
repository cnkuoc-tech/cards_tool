/**
 * 訂單列表頁面（支援分頁）
 */

window.OrdersPage = {
  async render({ search }) {
    const page = parseInt(search.get('page') || '1')
    const searchKeyword = search.get('search') || ''
    
    document.getElementById('app').innerHTML = `
      <div>
        <h1 style="color:var(--navy);margin-bottom:20px;">🧾 我的訂單</h1>
        
        <!-- 搜尋列 -->
        <div style="background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:30px;">
          <div style="display:flex;gap:10px;align-items:center;">
            <input 
              type="text" 
              id="searchInput" 
              placeholder="搜尋品項、卡號..."
              value="${searchKeyword}"
              style="flex:1;padding:10px 15px;border:2px solid #ddd;border-radius:6px;font-size:14px;"
              onkeypress="if(event.key==='Enter') window.OrdersPage.search()"
            >
            <button onclick="window.OrdersPage.search()" class="btn btn-primary">
              🔍 搜尋
            </button>
            ${searchKeyword ? `
              <button onclick="window.OrdersPage.clearSearch()" class="btn btn-secondary">
                清除
              </button>
            ` : ''}
          </div>
          
          <div id="orderStats" style="margin-top:15px;display:flex;gap:20px;flex-wrap:wrap;font-size:14px;color:#666;">
            <!-- 訂單統計會顯示在這裡 -->
          </div>
        </div>
        
        <!-- 訂單列表 -->
        <div id="orderList">
          <div style="text-align:center;padding:60px 20px;">
            <div class="spinner" style="margin:0 auto 20px;"></div>
            <p style="color:#666;">載入訂單中...</p>
          </div>
        </div>
        
        <!-- 分頁 -->
        <div id="pagination" style="margin-top:40px;"></div>
      </div>
      
      <style>
        .order-card {
          background: white;
          border: 2px solid #eee;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 15px;
          transition: all 0.3s;
        }
        
        .order-card:hover {
          border-color: var(--navy);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .order-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #eee;
        }
        
        .order-status {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
        }
        
        .status-pending {
          background: #fff3cd;
          color: #856404;
        }
        
        .status-paid {
          background: #d4edda;
          color: #155724;
        }
        
        .status-shipped {
          background: #cce5ff;
          color: #004085;
        }
        
        .order-info {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
          font-size: 14px;
        }
        
        .info-label {
          color: #666;
          font-weight: 600;
        }
        
        .info-value {
          color: #333;
        }
        
        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
        }
        
        .page-btn {
          padding: 8px 16px;
          border: 2px solid #ddd;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
        }
        
        .page-btn:hover:not(:disabled) {
          border-color: var(--navy);
          color: var(--navy);
        }
        
        .page-btn.active {
          background: var(--navy);
          color: white;
          border-color: var(--navy);
        }
        
        .page-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        @media (max-width: 768px) {
          .order-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 10px;
          }
          
          .order-info {
            grid-template-columns: 1fr;
          }
        }
      </style>
    `
    
    // 載入訂單
    await this.loadOrders(page, searchKeyword)
  },
  
  async loadOrders(page = 1, search = '') {
    try {
      const user = authManager.getUser()
      if (!user) {
        router.navigate('/login')
        return
      }
      
      // 呼叫 API
      const response = await api.get('/api/orders', {
        page,
        per_page: 20,
        search
      })
      
      if (!response.success) {
        throw new Error(response.message || '取得訂單失敗')
      }
      
      const { orders, stats, pagination } = response
      
      // 更新統計
      this.renderStats(stats)
      
      // 渲染訂單列表
      this.renderOrders(orders)
      
      // 渲染分頁
      this.renderPagination(pagination)
      
    } catch (error) {
      console.error('載入訂單失敗:', error)
      document.getElementById('orderList').innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <p style="font-size:48px;margin-bottom:15px;">❌</p>
          <p style="color:#666;font-size:16px;margin-bottom:20px;">${error.message}</p>
          <button onclick="window.OrdersPage.loadOrders()" class="btn btn-primary">重新載入</button>
        </div>
      `
    }
  },
  
  renderStats(stats) {
    if (!stats) return
    
    const statsEl = document.getElementById('orderStats')
    statsEl.innerHTML = `
      <div>📦 總訂單：<strong>${stats.total || 0}</strong></div>
      <div>⏳ 待付款：<strong>${stats.pending || 0}</strong></div>
      <div>✅ 已付款：<strong>${stats.paid || 0}</strong></div>
      <div>🚚 已出貨：<strong>${stats.shipped || 0}</strong></div>
    `
  },
  
  renderOrders(orders) {
    const listEl = document.getElementById('orderList')
    
    if (!orders || orders.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:60px 20px;">
          <p style="font-size:48px;margin-bottom:15px;">📭</p>
          <p style="color:#666;font-size:16px;">目前沒有訂單</p>
          <button onclick="router.navigate('/products')" class="btn btn-primary" style="margin-top:20px;">
            前往購物
          </button>
        </div>
      `
      return
    }
    
    listEl.innerHTML = orders.map(order => {
      let statusClass = 'status-pending'
      let statusText = '待付款'
      
      if (order.is_shipped) {
        statusClass = 'status-shipped'
        statusText = '已出貨'
      } else if (order.is_cleared) {
        statusClass = 'status-paid'
        statusText = '已付款'
      }
      
      return `
        <div class="order-card">
          <div class="order-header">
            <div>
              <strong style="font-size:16px;color:var(--navy);">${order.item_name}</strong>
              ${order.card_no ? `<div style="color:#666;font-size:13px;margin-top:4px;">卡號：${order.card_no}</div>` : ''}
            </div>
            <span class="order-status ${statusClass}">${statusText}</span>
          </div>
          
          <div class="order-info">
            <div>
              <div class="info-label">訂購日期</div>
              <div class="info-value">${formatDate(order.order_date)}</div>
            </div>
            <div>
              <div class="info-label">數量</div>
              <div class="info-value">${order.quantity} 張</div>
            </div>
            <div>
              <div class="info-label">單價</div>
              <div class="info-value">${formatMoney(order.unit_price)}</div>
            </div>
            <div>
              <div class="info-label">總金額</div>
              <div class="info-value" style="font-weight:bold;color:var(--navy);">${formatMoney(order.total_fee)}</div>
            </div>
            ${order.balance > 0 ? `
              <div>
                <div class="info-label">尾款</div>
                <div class="info-value" style="color:var(--red);font-weight:bold;">${formatMoney(order.balance)}</div>
              </div>
            ` : ''}
          </div>
          
          ${order.notes ? `
            <div style="margin-top:15px;padding-top:15px;border-top:1px solid #eee;">
              <div class="info-label" style="margin-bottom:5px;">備註</div>
              <div class="info-value">${order.notes}</div>
            </div>
          ` : ''}
        </div>
      `
    }).join('')
  },
  
  renderPagination(pagination) {
    if (!pagination) return
    
    const { current_page, total_pages, total } = pagination
    
    if (total_pages <= 1) {
      document.getElementById('pagination').innerHTML = ''
      return
    }
    
    const pages = []
    for (let i = 1; i <= total_pages; i++) {
      if (
        i === 1 || 
        i === total_pages || 
        (i >= current_page - 2 && i <= current_page + 2)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...')
      }
    }
    
    const searchKeyword = router.getQuery('search') || ''
    
    document.getElementById('pagination').innerHTML = `
      <div class="pagination">
        <button 
          class="page-btn" 
          ${current_page === 1 ? 'disabled' : ''}
          onclick="router.navigate('/orders?page=${current_page - 1}${searchKeyword ? '&search=' + searchKeyword : ''}')"
        >
          ← 上一頁
        </button>
        
        ${pages.map(page => {
          if (page === '...') {
            return '<span style="padding:8px;">...</span>'
          }
          return `
            <button 
              class="page-btn ${page === current_page ? 'active' : ''}"
              onclick="router.navigate('/orders?page=${page}${searchKeyword ? '&search=' + searchKeyword : ''}')"
            >
              ${page}
            </button>
          `
        }).join('')}
        
        <button 
          class="page-btn" 
          ${current_page === total_pages ? 'disabled' : ''}
          onclick="router.navigate('/orders?page=${current_page + 1}${searchKeyword ? '&search=' + searchKeyword : ''}')"
        >
          下一頁 →
        </button>
      </div>
      
      <div style="text-align:center;margin-top:15px;color:#666;font-size:14px;">
        第 ${current_page} / ${total_pages} 頁，共 ${total} 筆訂單
      </div>
    `
  },
  
  search() {
    const keyword = document.getElementById('searchInput').value.trim()
    const params = new URLSearchParams()
    if (keyword) params.set('search', keyword)
    params.set('page', '1') // 搜尋時回到第一頁
    
    router.navigate(`/orders?${params.toString()}`)
  },
  
  clearSearch() {
    router.navigate('/orders')
  }
}
