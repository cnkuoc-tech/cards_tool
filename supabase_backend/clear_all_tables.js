/**
 * 清空所有資料表（重新遷移前使用）
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function clearAllTables() {
  console.log('\n⚠️  警告：這將清空所有資料表的資料！');
  console.log('以下資料表將被清空：');
  console.log('  - orders (訂單)');
  console.log('  - breaks (團拆記錄)');
  console.log('  - payments (付款通知)');
  console.log('  - product_catalog (商品)');
  console.log('  - users (用戶)');
  console.log('  - psa_orders (PSA訂單)');
  console.log('  - break_credits (團拆積分)');
  console.log('  - topps_now (Topps Now)');
  console.log('  - order_history (訂單歷史)');
  console.log('');
  
  const answer = await question('確定要繼續嗎？(輸入 YES 確認): ');
  
  if (answer !== 'YES') {
    console.log('已取消');
    rl.close();
    return;
  }
  
  const tables = [
    'order_history',
    'topps_now',
    'break_credits',
    'psa_orders',
    'payments',
    'breaks',
    'orders',
    'product_catalog',
    'users'
  ];
  
  console.log('\n開始清空資料...\n');
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // 刪除所有記錄
      
      if (error) {
        console.log(`❌ ${table}: ${error.message}`);
      } else {
        console.log(`✅ ${table}: 已清空`);
      }
    } catch (err) {
      console.log(`❌ ${table}: ${err.message}`);
    }
  }
  
  console.log('\n✅ 所有資料表已清空！');
  console.log('現在可以執行 node migrate_fixed.js 重新遷移資料\n');
  
  rl.close();
}

clearAllTables();
