import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function clearAllData() {
  console.log('🗑️  清空所有資料表...\n');
  
  const tables = [
    'psa_card_details',
    'psa_orders',
    'order_history',
    'lottery',
    'topps_now',
    'payments',
    'shipments',
    'product_catalog',
    'break_credits',
    'breaks',
    'orders',
    'users'
  ];
  
  for (const table of tables) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // 刪除所有資料
      
      if (error) {
        console.log(`  ❌ ${table}: ${error.message}`);
      } else {
        console.log(`  ✅ ${table}: 已清空`);
      }
    } catch (err) {
      console.log(`  ⚠️  ${table}: ${err.message}`);
    }
  }
  
  console.log('\n✨ 清空完成，可以重新執行遷移');
}

clearAllData();
