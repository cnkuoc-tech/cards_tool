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
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          console.error('Parse error:', e);
          console.error('Raw data:', data);
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    // 先查詢用戶 ID
    console.log('=== 查詢用戶 ===');
    const users = await supabaseRequest('users', '?phone=eq.0975313096&select=id,phone,nickname');
    console.log('Users response:', users);
    
    if (!users || !Array.isArray(users) || users.length === 0) {
      console.log('找不到用戶 0975313096 或回應格式錯誤');
      console.log('Response type:', typeof users);
      console.log('Is array:', Array.isArray(users));
      return;
    }
    const userId = users[0].id;
    console.log('用戶 ID:', userId);
    console.log('用戶資料:', users[0]);

    // 查詢訂單資料表結構
    console.log('\n=== 訂單資料表結構（前5筆） ===');
    const allOrders = await supabaseRequest('order_entries', '?limit=5&select=*');
    if (allOrders && allOrders.length > 0) {
      console.log('第一筆訂單的所有欄位:');
      console.log(JSON.stringify(allOrders[0], null, 2));
      
      console.log('\n訂單欄位列表:');
      console.log(Object.keys(allOrders[0]));
    } else {
      console.log('訂單資料表是空的');
    }

    // 查詢該用戶的訂單
    console.log('\n=== 查詢用戶訂單（使用 user_id） ===');
    const userOrders = await supabaseRequest('order_entries', `?user_id=eq.${userId}&limit=10&select=*`);
    console.log(`找到 ${userOrders ? userOrders.length : 0} 筆訂單`);
    if (userOrders && userOrders.length > 0) {
      console.log('\n前3筆訂單:');
      userOrders.slice(0, 3).forEach((order, idx) => {
        console.log(`\n訂單 ${idx + 1}:`);
        console.log('  item_name:', order.item_name);
        console.log('  card_no:', order.card_no);
        console.log('  quantity:', order.quantity);
        console.log('  total_fee:', order.total_fee);
        console.log('  is_cleared:', order.is_cleared);
        console.log('  is_shipped:', order.is_shipped);
        console.log('  order_date:', order.order_date);
        console.log('  user_id:', order.user_id);
      });
    }

    // 嘗試使用 phone 查詢
    console.log('\n=== 查詢用戶訂單（使用 phone） ===');
    const ordersByPhone = await supabaseRequest('order_entries', '?phone=eq.0975313096&limit=10&select=*');
    console.log(`找到 ${ordersByPhone ? ordersByPhone.length : 0} 筆訂單（使用 phone）`);

    // 查詢團拆記錄
    console.log('\n=== 查詢團拆記錄 ===');
    const breaks = await supabaseRequest('break_records', `?user_id=eq.${userId}&limit=5&select=*`);
    console.log(`找到 ${breaks ? breaks.length : 0} 筆團拆記錄`);
    if (breaks && breaks.length > 0) {
      console.log('第一筆團拆記錄:');
      console.log(JSON.stringify(breaks[0], null, 2));
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
})();
