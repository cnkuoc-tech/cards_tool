import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf8');
const envLines = envContent.split('\n').filter(l => l.trim());
const SUPABASE_URL = envLines.find(l => l.startsWith('SUPABASE_URL')).split('=')[1].trim();
const SUPABASE_KEY = envLines.find(l => l.startsWith('SUPABASE_ANON_KEY')).split('=')[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔧 開始修復 arrival_status...\n');

// 讀取 CSV
const csvContent = readFileSync('orders.csv', 'utf8');
const lines = csvContent.split('\n');
const headers = lines[0].split(',');

// 找到欄位索引
const itemIndex = headers.indexOf('item');
const arrivalIndex = headers.indexOf('arrival_status');
const timestampIndex = headers.indexOf('timestamp');

console.log(`📋 CSV 欄位索引: item=${itemIndex}, arrival_status=${arrivalIndex}, timestamp=${timestampIndex}`);
console.log(`📝 CSV 總行數: ${lines.length - 1} (不含標題)\n`);

// 解析 CSV 數據
const records = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  
  const parts = lines[i].split(',');
  const item = parts[itemIndex]?.trim();
  const arrivalStatus = parts[arrivalIndex]?.trim();
  const timestamp = parts[timestampIndex]?.trim();
  
  if (item && arrivalStatus) {
    records.push({ item, arrivalStatus, timestamp });
  }
}

console.log(`✅ 解析到 ${records.length} 筆有 arrival_status 的記錄\n`);

// 顯示前幾筆數據
console.log('前 5 筆數據預覽:');
records.slice(0, 5).forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.item.substring(0, 30)} -> arrival: "${r.arrivalStatus}"`);
});
console.log('');

// 批量更新
let updated = 0;
let failed = 0;
let notFound = 0;

for (let i = 0; i < records.length; i++) {
  const { item, arrivalStatus, timestamp } = records[i];
  
  // 先查找這個訂單
  const { data: existing, error: findError } = await supabase
    .from('orders')
    .select('id, arrival_status')
    .eq('item', item)
    .is('arrival_status', null)
    .limit(1);
  
  if (findError) {
    console.error(`❌ 查找失敗 (${item.substring(0, 20)}):`, findError.message);
    failed++;
    continue;
  }
  
  if (!existing || existing.length === 0) {
    notFound++;
    if (notFound <= 3) {
      console.log(`⚠️  找不到訂單: ${item.substring(0, 30)}`);
    }
    continue;
  }
  
  // 更新 arrival_status
  const { error: updateError } = await supabase
    .from('orders')
    .update({ arrival_status: arrivalStatus })
    .eq('id', existing[0].id);
  
  if (updateError) {
    console.error(`❌ 更新失敗 (ID: ${existing[0].id}):`, updateError.message);
    failed++;
  } else {
    updated++;
    if (updated % 100 === 0) {
      console.log(`  ✅ 已更新 ${updated}/${records.length} 筆...`);
    }
  }
}

console.log(`\n📊 完成！`);
console.log(`  ✅ 成功更新: ${updated} 筆`);
console.log(`  ⚠️  找不到匹配: ${notFound} 筆`);
console.log(`  ❌ 更新失敗: ${failed} 筆`);

// 驗證結果
const { data: afterStats } = await supabase
  .from('orders')
  .select('arrival_status');

const distribution = afterStats.reduce((acc, row) => {
  const status = row.arrival_status || 'null';
  acc[status] = (acc[status] || 0) + 1;
  return acc;
}, {});

console.log('\n📈 更新後的分佈:');
Object.entries(distribution).forEach(([status, count]) => {
  const percentage = ((count / afterStats.length) * 100).toFixed(1);
  console.log(`  ${status}: ${count} 筆 (${percentage}%)`);
});
