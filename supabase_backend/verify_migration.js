/**
 * 🔍 遷移後資料驗證腳本
 * 
 * 執行方式:
 * node verify_migration.js
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

console.log(`
╔══════════════════════════════════════════════════════════╗
║              🔍 資料遷移驗證報告                       ║
╚══════════════════════════════════════════════════════════╝
`);

/**
 * 檢查資料筆數
 */
async function checkCounts() {
  console.log('📊 檢查資料筆數...\n');
  
  const tables = [
    'users',
    'product_catalog',
    'orders',
    'breaks',
    'shipments',
    'break_credits',
    'notifications',
    'lottery',
    'ecpay_records',
    'psa_orders',
    'order_history'
  ];
  
  const results = {};
  
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`  ❌ ${table.padEnd(20)} - 查詢失敗: ${error.message}`);
      results[table] = -1;
    } else {
      const icon = count > 0 ? '✅' : '⚠️ ';
      console.log(`  ${icon} ${table.padEnd(20)} - ${count} 筆`);
      results[table] = count;
    }
  }
  
  console.log('');
  return results;
}

/**
 * 檢查外鍵完整性
 */
async function checkForeignKeys() {
  console.log('🔗 檢查外鍵完整性...\n');
  
  const checks = [
    { name: '訂單的用戶', table: 'orders', column: 'user_id' },
    { name: '團拆的用戶', table: 'breaks', column: 'user_id' },
    { name: '出貨的用戶', table: 'shipments', column: 'user_id' },
    { name: '團拆金的用戶', table: 'break_credits', column: 'user_id' },
    { name: '抽籤的用戶', table: 'lottery', column: 'user_id' },
    { name: '綠界記錄的用戶', table: 'ecpay_records', column: 'user_id' }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    // 先取得所有 user_id
    const { data: records, error: recordError } = await supabase
      .from(check.table)
      .select(check.column);
    
    if (recordError) {
      console.log(`  ❌ ${check.name}: 查詢失敗`);
      allPassed = false;
      continue;
    }
    
    if (!records || records.length === 0) {
      console.log(`  ⚠️  ${check.name}: 無資料`);
      continue;
    }
    
    // 檢查有多少筆沒有 user_id
    const withoutUserId = records.filter(r => !r[check.column]).length;
    const withUserId = records.length - withoutUserId;
    
    // 取樣檢查前 10 筆的 user_id 是否存在
    const sampleUserIds = records
      .filter(r => r[check.column])
      .slice(0, 10)
      .map(r => r[check.column]);
    
    if (sampleUserIds.length > 0) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id')
        .in('id', sampleUserIds);
      
      if (userError) {
        console.log(`  ❌ ${check.name}: 用戶查詢失敗`);
        allPassed = false;
      } else {
        const foundCount = users ? users.length : 0;
        if (foundCount === sampleUserIds.length) {
          console.log(`  ✅ ${check.name}: ${withUserId} 筆有效, ${withoutUserId} 筆無 user_id`);
        } else {
          console.log(`  ⚠️  ${check.name}: 抽樣發現 ${sampleUserIds.length - foundCount} 筆孤立記錄`);
          allPassed = false;
        }
      }
    } else {
      console.log(`  ⚠️  ${check.name}: ${records.length} 筆都沒有 user_id`);
    }
  }
  
  console.log('');
  return allPassed;
}

/**
 * 檢查必填欄位
 */
async function checkRequiredFields() {
  console.log('📝 檢查必填欄位...\n');
  
  let allPassed = true;
  
  // 檢查用戶必填欄位
  const { data: invalidUsers } = await supabase
    .from('users')
    .select('id, phone, birthday')
    .or('phone.is.null,phone.eq.,birthday.is.null,birthday.eq.');
  
  if (invalidUsers && invalidUsers.length > 0) {
    console.log(`  ❌ users: ${invalidUsers.length} 筆缺少 phone 或 birthday`);
    allPassed = false;
  } else {
    console.log(`  ✅ users: 所有記錄都有 phone 和 birthday`);
  }
  
  // 檢查訂單必填欄位
  const { data: invalidOrders } = await supabase
    .from('orders')
    .select('id, item, total_fee')
    .or('item.is.null,item.eq.,total_fee.is.null');
  
  if (invalidOrders && invalidOrders.length > 0) {
    console.log(`  ❌ orders: ${invalidOrders.length} 筆缺少 item 或 total_fee`);
    allPassed = false;
  } else {
    console.log(`  ✅ orders: 所有記錄都有 item 和 total_fee`);
  }
  
  // 檢查團拆必填欄位
  const { data: invalidBreaks } = await supabase
    .from('breaks')
    .select('id, break_id, total_fee')
    .or('break_id.is.null,break_id.eq.,total_fee.is.null');
  
  if (invalidBreaks && invalidBreaks.length > 0) {
    console.log(`  ❌ breaks: ${invalidBreaks.length} 筆缺少 break_id 或 total_fee`);
    allPassed = false;
  } else {
    console.log(`  ✅ breaks: 所有記錄都有 break_id 和 total_fee`);
  }
  
  // 檢查商品必填欄位
  const { data: invalidProducts } = await supabase
    .from('product_catalog')
    .select('id, item_name')
    .or('item_name.is.null,item_name.eq.');
  
  if (invalidProducts && invalidProducts.length > 0) {
    console.log(`  ❌ product_catalog: ${invalidProducts.length} 筆缺少 item_name`);
    allPassed = false;
  } else {
    console.log(`  ✅ product_catalog: 所有記錄都有 item_name`);
  }
  
  console.log('');
  return allPassed;
}

/**
 * 抽樣檢查資料
 */
async function sampleCheck() {
  console.log('🎲 抽樣檢查資料...\n');
  
  // 隨機抽取 1 個用戶
  const { data: users } = await supabase
    .from('users')
    .select('id, phone, nickname, birthday')
    .limit(1);
  
  if (users && users.length > 0) {
    const user = users[0];
    console.log(`  👤 隨機用戶: ${user.nickname} (${user.phone})`);
    
    // 檢查該用戶的訂單
    const { count: orderCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    console.log(`     - 訂單數: ${orderCount || 0} 筆`);
    
    // 檢查該用戶的團拆
    const { count: breakCount } = await supabase
      .from('breaks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    console.log(`     - 團拆數: ${breakCount || 0} 筆`);
    
    // 檢查該用戶的團拆金
    const { count: creditCount } = await supabase
      .from('break_credits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    
    console.log(`     - 團拆金: ${creditCount || 0} 筆`);
  } else {
    console.log(`  ⚠️  沒有用戶資料`);
  }
  
  console.log('');
}

/**
 * 檢查資料範圍
 */
async function checkDataRanges() {
  console.log('📐 檢查資料範圍...\n');
  
  // 檢查商品價格
  const { data: priceStats } = await supabase
    .rpc('get_price_stats')
    .single()
    .catch(() => null);
  
  // 手動查詢
  const { data: products } = await supabase
    .from('product_catalog')
    .select('price')
    .not('price', 'is', null)
    .limit(1000);
  
  if (products && products.length > 0) {
    const prices = products.map(p => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2);
    console.log(`  💰 商品價格: 最低 $${min}, 最高 $${max}, 平均 $${avg}`);
  }
  
  // 檢查訂單金額
  const { data: orders } = await supabase
    .from('orders')
    .select('total_fee')
    .not('total_fee', 'is', null)
    .limit(1000);
  
  if (orders && orders.length > 0) {
    const fees = orders.map(o => o.total_fee);
    const min = Math.min(...fees);
    const max = Math.max(...fees);
    const avg = (fees.reduce((a, b) => a + b, 0) / fees.length).toFixed(2);
    console.log(`  📋 訂單金額: 最低 $${min}, 最高 $${max}, 平均 $${avg}`);
  }
  
  console.log('');
}

/**
 * 主執行函數
 */
async function main() {
  try {
    console.log('🔗 連線到 Supabase:', process.env.SUPABASE_URL);
    console.log('');
    
    const counts = await checkCounts();
    const fkPassed = await checkForeignKeys();
    const fieldsPassed = await checkRequiredFields();
    await sampleCheck();
    await checkDataRanges();
    
    // 總結
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    驗證總結                            ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    
    const totalRecords = Object.values(counts).reduce((a, b) => a + (b > 0 ? b : 0), 0);
    console.log(`📊 總資料筆數: ${totalRecords}`);
    console.log(`🔗 外鍵完整性: ${fkPassed ? '✅ 通過' : '❌ 有問題'}`);
    console.log(`📝 必填欄位: ${fieldsPassed ? '✅ 通過' : '❌ 有問題'}`);
    console.log('');
    
    if (fkPassed && fieldsPassed) {
      console.log('🎉 所有驗證通過！資料遷移成功！');
    } else {
      console.log('⚠️  發現問題，請檢查上方詳細資訊');
    }
    console.log('');
    
  } catch (error) {
    console.error('\n❌ 驗證過程發生錯誤:');
    console.error(error);
    process.exit(1);
  }
}

main();
