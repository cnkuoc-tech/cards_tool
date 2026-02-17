// 測試累積張數計算
const SUPABASE_URL = 'https://ygomzfsawnjsxbjjxmsy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlnb216ZnNhd25qc3hiamp4bXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc0NjEzMDAsImV4cCI6MjA1MzAzNzMwMH0.hzzJbsJyENRdKh8cIY9C6f8xQI96LF4D1SJgcJG_YOE';

async function testAccumulated() {
  // 查詢所有訂單
  const ordersResp = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=item,card_no,quantity&limit=10`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const orders = await ordersResp.json();
  
  console.log('前10筆訂單:');
  console.log(JSON.stringify(orders, null, 2));
  
  // 計算累積
  const accMap = new Map();
  orders.forEach(o => {
    const key = (o.item || '') + '||' + (o.card_no || '');
    accMap.set(key, (accMap.get(key) || 0) + (parseInt(o.quantity) || 0));
  });
  
  console.log('\n累積張數:');
  for (const [key, qty] of accMap) {
    console.log(`${key}: ${qty} 張`);
  }
}

testAccumulated().catch(console.error);
