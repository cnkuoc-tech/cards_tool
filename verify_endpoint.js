/**
 * 將此函數加入到 worker_supabase_integrated.js 中的 API 端點
 * 
 * 在 switch (action) 中加入:
 * case 'verifyData': result = await handleVerifyData(body, supabase); break;
 */

async function handleVerifyData(body, supabase) {
  const results = {};
  
  try {
    // 1. 檢查所有資料表筆數
    const tables = [
      'users',
      'product_catalog', 
      'order_entries',
      'break_records',
      'payment_notifications',
      'psa_orders',
      'break_credits',
      'daily_fortunes'
    ];
    
    results.tableCounts = {};
    for (const table of tables) {
      const data = await supabase.query(table, {});
      results.tableCounts[table] = Array.isArray(data) ? data.length : 0;
    }
    
    // 2. 檢查 users 範例
    const users = await supabase.query('users', {});
    if (Array.isArray(users) && users.length > 0) {
      results.usersSample = users.slice(0, 2).map(u => ({
        phone: u.phone,
        nickname: u.nickname,
        birthday: u.birthday,
        birthdayType: typeof u.birthday
      }));
      results.usersFields = Object.keys(users[0]);
    }
    
    // 3. 檢查 product_catalog 範例
    const products = await supabase.query('product_catalog', {});
    if (Array.isArray(products) && products.length > 0) {
      results.productsSample = products.slice(0, 2).map(p => ({
        item_name: p.item_name,
        category: p.category,
        is_box_preorder: p.is_box_preorder,
        is_box_type: typeof p.is_box_preorder,
        total_quantity: p.total_quantity,
        current_quantity: p.current_quantity,
        close_time: p.close_time
      }));
      results.productsFields = Object.keys(products[0]);
      
      // 統計分類
      const categories = {};
      const boxCount = { true: 0, false: 0, other: 0 };
      products.forEach(p => {
        categories[p.category] = (categories[p.category] || 0) + 1;
        if (p.is_box_preorder === 'true') boxCount.true++;
        else if (p.is_box_preorder === 'false') boxCount.false++;
        else boxCount.other++;
      });
      results.productStats = { categories, boxCount };
    }
    
    // 4. 檢查 order_entries 範例
    const orders = await supabase.query('order_entries', {});
    if (Array.isArray(orders) && orders.length > 0) {
      results.ordersSample = orders.slice(0, 2).map(o => ({
        phone: o.phone,
        nickname: o.nickname,
        item_name: o.item_name,
        user_id: o.user_id,
        has_user_id: !!o.user_id,
        is_cleared: o.is_cleared,
        is_shipped: o.is_shipped,
        order_date: o.order_date
      }));
      results.ordersFields = Object.keys(orders[0]);
      
      // 統計 user_id
      let hasUserId = 0;
      let noUserId = 0;
      orders.forEach(o => {
        if (o.user_id) hasUserId++;
        else noUserId++;
      });
      results.orderStats = { hasUserId, noUserId, total: orders.length };
    }
    
    // 5. 檢查特定用戶訂單
    const phone = '0975313096';
    const userOrders = await supabase.query('order_entries', { eq: { phone } });
    results.testUserOrders = {
      phone,
      count: Array.isArray(userOrders) ? userOrders.length : 0,
      sample: Array.isArray(userOrders) && userOrders.length > 0 ? userOrders.slice(0, 2).map(o => ({
        item_name: o.item_name,
        quantity: o.quantity,
        order_date: o.order_date
      })) : []
    };
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      results
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      partialResults: results
    };
  }
}

// 將此內容複製並加入到 worker_supabase_integrated.js 中
