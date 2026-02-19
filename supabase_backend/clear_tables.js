import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function clearTables() {
  console.log('清空資料表...\n');
  
  const tables = [
    'break_credits',
    'shipments',
    'breaks',
    'orders',
    'product_catalog',
    'users'
  ];
  
  for (const table of tables) {
    const { error, count } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      console.error(`❌ 清空 ${table} 失敗:`, error.message);
    } else {
      console.log(`✅ 已清空 ${table}`);
    }
  }
  
  console.log('\n✅ 完成！');
}

clearTables();
