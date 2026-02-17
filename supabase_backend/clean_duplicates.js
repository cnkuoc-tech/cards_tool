/**
 * 清理重複資料並重新遷移
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
║        🗑️  清理重複資料腳本                           ║
╚══════════════════════════════════════════════════════════╝
`);

async function cleanDuplicates() {
  try {
    // 只清理訂單和團拆（這兩個有重複）
    console.log('📌 清空 orders 表...');
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 刪除所有
    
    if (ordersError) {
      console.error('❌ 清空 orders 失敗:', ordersError.message);
    } else {
      console.log('✅ orders 已清空');
    }
    
    console.log('📌 清空 breaks 表...');
    const { error: breaksError } = await supabase
      .from('breaks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // 刪除所有
    
    if (breaksError) {
      console.error('❌ 清空 breaks 失敗:', breaksError.message);
    } else {
      console.log('✅ breaks 已清空');
    }
    
    console.log('\n✅ 清理完成！現在可以執行 migrate_csv_v2.js 重新遷移');
    
  } catch (error) {
    console.error('❌ 清理過程發生錯誤:', error);
  }
}

cleanDuplicates();
