import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env', 'utf8');
const envLines = envContent.split('\n').filter(l => l.trim() && !l.startsWith('#'));
const SUPABASE_URL = envLines.find(l => l.startsWith('SUPABASE_URL'))?.split('=')[1]?.trim();
const SUPABASE_KEY = envLines.find(l => l.startsWith('SUPABASE_ANON_KEY'))?.split('=')[1]?.trim();

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ 環境變數錯誤');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔧 修復 arrival_status\n');

const csvContent = readFileSync('orders.csv', 'utf8');
const lines = csvContent.split('\n');
const headers = lines[0].split(',');

const itemIdx = headers.indexOf('item');
const arrivalIdx = headers.indexOf('arrival_status');
const timestampIdx = headers.indexOf('timestamp');

console.log(`欄位位置: item=${itemIdx}, arrival_status=${arrivalIdx}, timestamp=${timestampIdx}\n`);

let updated = 0, skipped = 0, failed = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const cols = line.split(',');
  const item = cols[itemIdx]?.trim();
  const arrival = cols[arrivalIdx]?.trim();
  const timestamp = cols[timestampIdx]?.trim();
  
  if (!item || !arrival || !timestamp) {
    skipped++;
    continue;
  }
  
  // 轉換日期格式 2025/12/1 或 2025/12/31 8:40 -> 2025-12-01
  const dateOnly = timestamp.split(' ')[0]; // 移除時間部分
  const dateParts = dateOnly.split('/');
  const isoDate = `${dateParts[0]}-${dateParts[1].padStart(2,'0')}-${dateParts[2].padStart(2,'0')}`;
  
  const { data, error } = await supabase
    .from('orders')
    .update({ arrival_status: arrival })
    .eq('item', item)
    .gte('timestamp', `${isoDate}T00:00:00`)
    .lt('timestamp', `${isoDate}T23:59:59`)
    .select();
  
  if (error) {
    failed++;
    if (failed <= 3) console.error(`❌ [${i}] ${error.message}`);
  } else if (data?.length > 0) {
    updated++;
    if (updated % 100 === 0) console.log(`✅ ${updated} 筆...`);
  } else {
    skipped++;
  }
}

console.log(`\n結果: ✅${updated} ⏭️${skipped} ❌${failed}`);

const { data: result } = await supabase.from('orders').select('arrival_status');
const dist = result.reduce((acc, r) => {
  acc[r.arrival_status || 'null'] = (acc[r.arrival_status || 'null'] || 0) + 1;
  return acc;
}, {});

console.log('\n分佈:');
Object.entries(dist).forEach(([s, c]) => 
  console.log(`  ${s}: ${c} (${((c/result.length)*100).toFixed(1)}%)`)
);
