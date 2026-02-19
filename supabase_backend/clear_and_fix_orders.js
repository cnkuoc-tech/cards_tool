/**
 * 清除重複訂單並重新遷移
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import csv from 'csv-parser';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const userMap = new Map();
const normalizeKey = (v) => String(v || '').trim().toLowerCase();

async function main() {
  console.log('🔄 清除並重新遷移訂單...\n');
  
  // 1. 清空訂單表
  console.log('清空所有訂單...');
  const { error: deleteError } = await supabase
    .from('orders')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (deleteError) {
    console.error('❌ 清空失敗:', deleteError);
    return;
  }
  console.log('✅ 已清空\n');
  
  // 2. 載入 userMap
  console.log('載入用戶對應表...');
  const { data: users } = await supabase.from('users').select('id, phone, nickname, real_name');
  users.forEach(u => {
    if (u.phone) userMap.set(normalizeKey(u.phone), u.id);
    if (u.nickname) userMap.set(normalizeKey(u.nickname), u.id);
    if (u.real_name) userMap.set(normalizeKey(u.real_name), u.id);
  });
  console.log(`✅ ${userMap.size} 個映射\n`);
  
  // 3. 讀取 CSV
  console.log('讀取 orders.csv...');
  const orders = [];
  
  await new Promise((resolve, reject) => {
    fs.createReadStream('orders.csv')
      .pipe(csv())
      .on('data', (row) => {
        const nickname = String(row['user_id'] || '').trim();
        const userId = userMap.get(normalizeKey(nickname)) || null;
        
        orders.push({
          user_id: userId,
          timestamp: row['timestamp'] || new Date().toISOString(),
          item: String(row['item'] || '').trim(),
          card_no: String(row['card_no'] || '').trim() || null,
          quantity: parseInt(row['quantity']) || 0,
          unit_price: parseFloat(row['unit_price']) || 0,
          total_fee: parseFloat(row['total_fee']) || 0,
          deposit: parseFloat(row['deposit']) || 0,
          balance_amount: parseFloat(row['balance_amount']) || 0,
          status: String(row['status'] || '').trim() || null,
          image_url: String(row['image_url '] || row['image_url'] || '').trim() || null,
          box_order: String(row['box_order'] || '').trim() || null,
          notes: String(row['notes'] || '').trim() || null,
          remark: String(row['remark'] || '').trim() || null,
          payment_method: String(row['payment_method'] || '').trim() || null,
          merchant_trade_no: String(row['merchant_trade_no'] || '').trim() || null
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });
  
  console.log(`✅ 讀取 ${orders.length} 筆訂單\n`);
  
  // 檢查樣本
  const withCardNo = orders.filter(o => o.card_no).length;
  const withRemark = orders.filter(o => o.remark).length;
  const withImage = orders.filter(o => o.image_url).length;
  console.log(`📋 統計:`);
  console.log(`  - card_no: ${withCardNo} 筆`);
  console.log(`  - remark: ${withRemark} 筆`);
  console.log(`  - image_url: ${withImage} 筆\n`);
  
  // 4. 插入資料
  console.log('開始插入...');
  let inserted = 0;
  
  for (let i = 0; i < orders.length; i += 100) {
    const batch = orders.slice(i, i + 100);
    const { error } = await supabase.from('orders').insert(batch);
    
    if (error) {
      console.error(`❌ 批次 ${i} 失敗:`, error.message);
    } else {
      inserted += batch.length;
      if (i % 500 === 0 || i + batch.length >= orders.length) {
        console.log(`✅ 已插入 ${inserted}/${orders.length}`);
      }
    }
  }
  
  console.log(`\n✅ 完成！成功插入 ${inserted} 筆訂單`);
}

main().catch(console.error);
