const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://hmqwcpstzkxfwabasqgx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcXdjcHN0emt4ZndhYmFzcWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzcyNzk1MzIsImV4cCI6MjA1Mjg1NTUzMn0.fxGZLUYW1tKkSoMQU_OvM2qDJnmMx54z_j5WCpC9eWU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTable(tableName, description) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 檢查資料表: ${tableName} (${description})`);
  console.log('='.repeat(60));
  
  try {
    // 查詢資料數量
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: false })
      .limit(3);
    
    if (error) {
      console.log(`❌ 錯誤: ${error.message}`);
      return { table: tableName, count: 0, error: error.message };
    }
    
    console.log(`✅ 資料筆數: ${count || 0}`);
    
    if (data && data.length > 0) {
      console.log(`\n📋 欄位列表:`);
      const fields = Object.keys(data[0]);
      fields.forEach(field => {
        const sampleValue = data[0][field];
        const valueType = typeof sampleValue;
        const displayValue = sampleValue === null ? 'null' : 
                            valueType === 'string' ? `"${sampleValue.substring(0, 30)}${sampleValue.length > 30 ? '...' : ''}"` :
                            JSON.stringify(sampleValue);
        console.log(`  - ${field}: ${valueType} (範例: ${displayValue})`);
      });
      
      console.log(`\n📝 範例資料 (前3筆):`);
      data.forEach((row, idx) => {
        console.log(`\n  第 ${idx + 1} 筆:`);
        // 只顯示關鍵欄位
        const keyFields = getKeyFields(tableName);
        keyFields.forEach(field => {
          if (row.hasOwnProperty(field)) {
            const value = row[field];
            const displayValue = value === null ? 'null' :
                                typeof value === 'string' ? `"${value}"` :
                                JSON.stringify(value);
            console.log(`    ${field}: ${displayValue}`);
          }
        });
      });
    } else {
      console.log(`⚠️  資料表是空的`);
    }
    
    return { table: tableName, count: count || 0, fields: data && data.length > 0 ? Object.keys(data[0]) : [] };
    
  } catch (err) {
    console.log(`❌ 異常: ${err.message}`);
    return { table: tableName, count: 0, error: err.message };
  }
}

function getKeyFields(tableName) {
  const keyFieldsMap = {
    'users': ['phone', 'nickname', 'birthday', 'email', 'address'],
    'product_catalog': ['item_name', 'card_no', 'price', 'category', 'is_box_preorder', 'can_draw_sp', 'total_quantity', 'current_quantity'],
    'order_entries': ['phone', 'nickname', 'item_name', 'card_no', 'quantity', 'total_fee', 'is_cleared', 'is_shipped', 'order_date', 'user_id'],
    'break_records': ['phone', 'nickname', 'break_name', 'created_at', 'user_id'],
    'payment_notifications': ['phone', 'payment_date', 'amount', 'payment_method'],
    'psa_orders': ['phone', 'nickname', 'card_info', 'service_type', 'status'],
    'break_credits': ['phone', 'credit_amount', 'created_at'],
    'daily_fortunes': ['phone', 'fortune_date', 'fortune_result']
  };
  
  return keyFieldsMap[tableName] || ['id', 'created_at'];
}

async function checkGASConnection() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔗 檢查 GAS API 連線`);
  console.log('='.repeat(60));
  
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbwZh0V-98u_BN4_3KHtMGDjgV4j7pv6A_cUC5v79Wl55OfkUpIx8HQEBXcU8MdDCJI/exec';
  
  try {
    const response = await fetch(GAS_URL + '?action=exportAllUsers');
    const data = await response.json();
    
    if (data.success) {
      console.log(`✅ GAS API 正常`);
      console.log(`📊 用戶數據: ${data.users?.length || 0} 筆`);
      return true;
    } else {
      console.log(`❌ GAS API 錯誤: ${data.message}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ GAS API 連線失敗: ${err.message}`);
    return false;
  }
}

async function compareWithGAS() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔍 比對 GAS 和 Supabase 資料`);
  console.log('='.repeat(60));
  
  const GAS_URL = 'https://script.google.com/macros/s/AKfycbwZh0V-98u_BN4_3KHtMGDjgV4j7pv6A_cUC5v79Wl55OfkUpIx8HQEBXcU8MdDCJI/exec';
  
  const comparisons = [
    { action: 'exportAllUsers', table: 'users', name: '用戶' },
    { action: 'exportAllProducts', table: 'product_catalog', name: '商品' },
    { action: 'exportAllOrders', table: 'order_entries', name: '訂單' }
  ];
  
  for (const comp of comparisons) {
    try {
      // 從 GAS 取得資料
      const gasResponse = await fetch(GAS_URL + '?action=' + comp.action);
      const gasData = await gasResponse.json();
      const gasCount = gasData[Object.keys(gasData).find(k => Array.isArray(gasData[k]))]?.length || 0;
      
      // 從 Supabase 取得資料
      const { count } = await supabase
        .from(comp.table)
        .select('*', { count: 'exact', head: true });
      
      const diff = Math.abs(gasCount - (count || 0));
      const status = diff === 0 ? '✅ 一致' : `⚠️  差異 ${diff} 筆`;
      
      console.log(`\n${comp.name}:`);
      console.log(`  GAS: ${gasCount} 筆`);
      console.log(`  Supabase: ${count || 0} 筆`);
      console.log(`  狀態: ${status}`);
      
    } catch (err) {
      console.log(`\n${comp.name}: ❌ 比對失敗 - ${err.message}`);
    }
  }
}

async function main() {
  console.log('\n🚀 開始全面資料驗證...\n');
  
  // 1. 檢查 GAS API
  await checkGASConnection();
  
  // 2. 檢查所有資料表
  const tables = [
    { name: 'users', desc: '用戶資料' },
    { name: 'product_catalog', desc: '商品目錄' },
    { name: 'order_entries', desc: '訂單記錄' },
    { name: 'break_records', desc: '團拆記錄' },
    { name: 'payment_notifications', desc: '付款通知' },
    { name: 'psa_orders', desc: 'PSA 訂單' },
    { name: 'break_credits', desc: '團拆積分' },
    { name: 'daily_fortunes', desc: '每日運勢' }
  ];
  
  const results = [];
  for (const table of tables) {
    const result = await checkTable(table.name, table.desc);
    results.push(result);
  }
  
  // 3. 比對 GAS 資料
  await compareWithGAS();
  
  // 4. 總結報告
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 驗證總結`);
  console.log('='.repeat(60));
  
  results.forEach(r => {
    const status = r.error ? '❌ 錯誤' : r.count > 0 ? '✅ 有資料' : '⚠️  空表';
    console.log(`${status} ${r.table}: ${r.count} 筆`);
    if (r.error) console.log(`     錯誤: ${r.error}`);
  });
  
  console.log('\n✅ 驗證完成！\n');
}

main().catch(console.error);
