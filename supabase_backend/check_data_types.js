import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkDataTypes() {
  console.log('=== 檢查 product_catalog 資料類型 ===\n');
  
  const { data: products } = await supabase
    .from('product_catalog')
    .select('*')
    .limit(3);
  
  if (products && products.length > 0) {
    const p = products[0];
    console.log('第一筆商品完整資料:');
    Object.keys(p).forEach(key => {
      const value = p[key];
      console.log(`  ${key}: ${JSON.stringify(value)} (type: ${typeof value})`);
    });
  }
  
  console.log('\n=== 檢查 users 資料類型 ===\n');
  
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .limit(2);
  
  if (users && users.length > 0) {
    const u = users[0];
    console.log('第一筆用戶完整資料:');
    Object.keys(u).forEach(key => {
      const value = u[key];
      console.log(`  ${key}: ${JSON.stringify(value)} (type: ${typeof value})`);
    });
  }
  
  console.log('\n=== 檢查 order_entries 資料類型 ===\n');
  
  const { data: orders } = await supabase
    .from('order_entries')
    .select('*')
    .limit(2);
  
  if (orders && orders.length > 0) {
    const o = orders[0];
    console.log('第一筆訂單完整資料:');
    Object.keys(o).forEach(key => {
      const value = o[key];
      console.log(`  ${key}: ${JSON.stringify(value)} (type: ${typeof value})`);
    });
  }
}

checkDataTypes();
