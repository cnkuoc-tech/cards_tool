import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkSchema() {
  const tables = ['users', 'orders', 'breaks', 'product_catalog', 'psa_orders', 'order_history', 'break_credits', 'ecpay_records', 'shipments', 'lottery'];
  
  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (error) {
      console.log(`錯誤: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log('欄位:', Object.keys(data[0]).join(', '));
    } else {
      // 表是空的，試著插入一個空物件看錯誤訊息
      const { error: insertError } = await supabase
        .from(table)
        .insert({});
      if (insertError) {
        console.log(`無資料，錯誤訊息: ${insertError.message}`);
      }
    }
  }
}

checkSchema();
