/**
 * 清除並重新遷移團拆資料
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

function parseBool(value) {
  if (!value) return false;
  const v = String(value).trim().toUpperCase();
  return v === 'Y' || v === 'YES' || v === '是' || v === 'TRUE' || v === 'T' || v === '1';
}

async function main() {
  console.log('🔄 清除並重新遷移團拆資料...\n');
  
  // 1. 清空團拆表
  console.log('清空團拆表...');
  const { error: deleteError } = await supabase
    .from('breaks')
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
  console.log('讀取 breaks.csv...');
  const breaks = [];
  
  await new Promise((resolve, reject) => {
    fs.createReadStream('breaks.csv')
      .pipe(csv())
      .on('data', (row) => {
        const nickname = String(row['user_id'] || '').trim();
        const userId = userMap.get(normalizeKey(nickname)) || null;
        
        breaks.push({
          break_id: String(row['break_id'] || '').trim(),
          user_id: userId,
          name: String(row['name'] || '').trim(),
          category: String(row['category'] || '').trim() || null,
          format: String(row['format'] || '').trim() || null,
          item: String(row['item'] || '').trim(),
          total_fee: parseFloat(row['total_fee']) || 0,
          paid: parseFloat(row['paid']) || 0,
          is_opened: parseBool(row['is_opened']),
          is_shipped: parseBool(row['is_shipped']),
          is_cleared: parseBool(row['is_cleared']),
          status: String(row['status'] || '').trim() || null,
          payment_method: String(row['payment_method'] || '').trim() || null,
          merchant_trade_no: String(row['merchant_trade_no'] || '').trim() || null,
          payment_date: row['payment_date'] || null,
          remark: String(row['remark'] || '').trim() || null
        });
      })
      .on('end', resolve)
      .on('error', reject);
  });
  
  console.log(`✅ 讀取 ${breaks.length} 筆團拆\n`);
  
  const withUserId = breaks.filter(b => b.user_id).length;
  console.log(`📋 統計:`);
  console.log(`  - 有 user_id: ${withUserId} 筆`);
  console.log(`  - 無 user_id: ${breaks.length - withUserId} 筆\n`);
  
  // 4. 插入資料
  console.log('開始插入...');
  let inserted = 0;
  
  for (let i = 0; i < breaks.length; i += 100) {
    const batch = breaks.slice(i, i + 100);
    const { error } = await supabase.from('breaks').insert(batch);
    
    if (error) {
      console.error(`❌ 批次 ${i} 失敗:`, error.message);
    } else {
      inserted += batch.length;
      if (i % 500 === 0 || i + batch.length >= breaks.length) {
        console.log(`✅ 已插入 ${inserted}/${breaks.length}`);
      }
    }
  }
  
  console.log(`\n✅ 完成！成功插入 ${inserted} 筆團拆資料`);
}

main().catch(console.error);
