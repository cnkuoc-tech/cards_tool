const https = require('https');

const supabaseUrl = 'hmqwcpstzkxfwabasqgx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcXdjcHN0emt4ZndhYmFzcWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyNzk1MzIsImV4cCI6MjA1Mjg1NTUzMn0.fxGZLUYW1tKkSoMQU_OvM2qDJnmMx54z_j5WCpC9eWU';

function supabaseRequest(table, query = '') {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: supabaseUrl,
      path: `/rest/v1/${table}${query}`,
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  try {
    // 檢查用戶生日
    const users = await supabaseRequest('users', '?phone=eq.0975313096&select=phone,birthday');
    console.log('=== 用戶資料 ===');
    console.log('Raw response:', JSON.stringify(users));
    if (users && users[0]) {
      console.log('Phone:', users[0].phone);
      console.log('Birthday:', users[0].birthday);
      console.log('Birthday type:', typeof users[0].birthday);
      console.log('Birthday 原始值:', JSON.stringify(users[0].birthday));
    }

    // 檢查商品資料
    const products = await supabaseRequest('product_catalog', '?limit=3&select=item_name,is_box_preorder,category,can_draw_sp,total_quantity,current_quantity');
    console.log('\n=== 商品資料範例 ===');
    console.log('Raw products:', JSON.stringify(products));
    if (Array.isArray(products)) {
      products.forEach(p => {
      console.log(`\n商品: ${p.item_name}`);
      console.log(`  is_box_preorder: ${JSON.stringify(p.is_box_preorder)} (type: ${typeof p.is_box_preorder})`);
      console.log(`  category: ${JSON.stringify(p.category)} (type: ${typeof p.category})`);
      console.log(`  can_draw_sp: ${JSON.stringify(p.can_draw_sp)} (type: ${typeof p.can_draw_sp})`);
      console.log(`  total_quantity: ${JSON.stringify(p.total_quantity)} (type: ${typeof p.total_quantity})`);
      console.log(`  current_quantity: ${JSON.stringify(p.current_quantity)} (type: ${typeof p.current_quantity})`);
    });
    } else {
      console.log('Products is not an array:', products);
    }

    // 統計卡盒
    const boxes = await supabaseRequest('product_catalog', '?is_box_preorder=eq.true&select=item_name');
    console.log('\n=== 卡盒統計 ===');
    console.log('Raw boxes:', JSON.stringify(boxes));
    if (Array.isArray(boxes)) {
      console.log(`找到 ${boxes.length} 筆 is_box_preorder=true 的商品`);
    }
    
    // 檢查訂單資料
    const orders = await supabaseRequest('order_entries', '?limit=3&select=phone,item_name,quantity,total_price');
    console.log('\n=== 訂單資料範例 ===');
    console.log('Raw orders:', JSON.stringify(orders));
    if (Array.isArray(orders)) {
      orders.forEach(o => {
      console.log(`\n訂單: ${o.phone} - ${o.item_name}`);
      console.log(`  quantity: ${JSON.stringify(o.quantity)} (type: ${typeof o.quantity})`);
      console.log(`  total_price: ${JSON.stringify(o.total_price)} (type: ${typeof o.total_price})`);
    });
    } else {
      console.log('Orders is not an array:', orders);
    }

  } catch (error) {
    console.error('Error:', error);
  }
})();
