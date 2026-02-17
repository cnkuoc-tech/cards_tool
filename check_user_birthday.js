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
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    // 檢查用戶 0975313096 的生日
    const users = await supabaseRequest('users', '?phone=eq.0975313096&select=phone,birthday');
    
    console.log('=== 用戶資料 ===');
    if (users && users.length > 0) {
      const user = users[0];
      console.log('Phone:', user.phone);
      console.log('Birthday (原始):', JSON.stringify(user.birthday));
      console.log('Birthday (值):', user.birthday);
      console.log('Birthday (類型):', typeof user.birthday);
      console.log('Birthday (長度):', user.birthday ? user.birthday.length : 0);
      
      // 嘗試不同的比較方式
      const testBirthday = '0712';
      console.log('\n=== 比較測試 ===');
      console.log('測試生日:', testBirthday);
      console.log('直接比較 (===):', user.birthday === testBirthday);
      console.log('轉字串比較:', String(user.birthday) === String(testBirthday));
      console.log('Trim 比較:', String(user.birthday).trim() === String(testBirthday).trim());
      
      // 檢查是否有隱藏字元
      console.log('\n=== 字元分析 ===');
      console.log('DB Birthday bytes:', Array.from(user.birthday).map(c => c.charCodeAt(0)));
      console.log('Test Birthday bytes:', Array.from(testBirthday).map(c => c.charCodeAt(0)));
    } else {
      console.log('找不到用戶');
    }

    // 同時檢查幾筆商品的 category
    console.log('\n=== 商品分類 ===');
    const products = await supabaseRequest('product_catalog', '?limit=10&select=item_name,category,is_box_preorder');
    if (Array.isArray(products)) {
      products.forEach(p => {
        console.log(`${p.item_name}: category="${p.category}", is_box="${p.is_box_preorder}"`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
})();
