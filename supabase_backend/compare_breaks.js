import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import csv from 'csv-parser';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function compareBreaksData() {
  console.log('📊 比對團拆資料...\n');
  
  // 1. 讀取 CSV 資料
  const csvData = [];
  await new Promise((resolve) => {
    fs.createReadStream('團拆紀錄.csv')
      .pipe(csv())
      .on('data', (data) => csvData.push(data))
      .on('end', resolve);
  });
  
  console.log(`CSV 資料: ${csvData.length} 筆\n`);
  
  // 顯示 CSV 欄位
  if (csvData.length > 0) {
    console.log('CSV 欄位:', Object.keys(csvData[0]).join(', '));
    console.log('\n前 5 筆 CSV 資料:');
    csvData.slice(0, 5).forEach((row, i) => {
      console.log(`${i+1}. 訂購人="${row['訂購人']}" 團拆編號="${row['團拆編號']}" 團名="${row['團名']}" 購買品項="${row['購買品項']}"`);
    });
  }
  
  // 2. 讀取 Supabase 資料
  const { data: supabaseData, error } = await supabase
    .from('breaks')
    .select('*')
    .order('id')
    .limit(100);
  
  if (error) {
    console.error('Supabase 查詢錯誤:', error.message);
    return;
  }
  
  console.log(`\n\nSupabase 資料: ${supabaseData.length} 筆\n`);
  console.log('Supabase 欄位:', Object.keys(supabaseData[0]).join(', '));
  
  // 3. 統計分析
  const withName = supabaseData.filter(d => d.name && d.name.trim());
  const emptyName = supabaseData.filter(d => !d.name || !d.name.trim());
  const withUserId = supabaseData.filter(d => d.user_id);
  const emptyNameWithUserId = supabaseData.filter(d => (!d.name || !d.name.trim()) && d.user_id);
  
  console.log('\n📈 Supabase 統計:');
  console.log(`總筆數: ${supabaseData.length}`);
  console.log(`有團名的: ${withName.length}`);
  console.log(`團名為空的: ${emptyName.length}`);
  console.log(`有 user_id 的: ${withUserId.length}`);
  console.log(`團名空但有 user_id 的: ${emptyNameWithUserId.length}`);
  
  // 4. 顯示團名為空的資料
  if (emptyName.length > 0) {
    console.log('\n⚠️  團名為空的前 10 筆:');
    emptyName.slice(0, 10).forEach((d, i) => {
      console.log(`${i+1}. break_id="${d.break_id}" user_id=${d.user_id ? 'HAS' : 'NULL'} item="${d.item}" category="${d.category}"`);
    });
  }
  
  // 5. 比對：檢查 CSV 中對應的團拆編號
  console.log('\n🔍 CSV 中的對應資料:');
  emptyName.slice(0, 5).forEach((d, i) => {
    const csvMatch = csvData.find(row => String(row['團拆編號'] || '').trim() === d.break_id);
    if (csvMatch) {
      console.log(`${i+1}. break_id="${d.break_id}"`);
      console.log(`   CSV: 訂購人="${csvMatch['訂購人']}" 團名="${csvMatch['團名']}" 購買品項="${csvMatch['購買品項']}"`);
      console.log(`   Supabase: name="${d.name}" item="${d.item}"`);
    } else {
      console.log(`${i+1}. break_id="${d.break_id}" - CSV 中找不到對應資料`);
    }
  });
  
  // 6. 檢查遷移邏輯
  console.log('\n\n🔧 遷移腳本邏輯檢查:');
  console.log('migrate_csv_v2.js 中的對應關係:');
  console.log('  CSV["團名"] → Supabase.name');
  console.log('  CSV["購買品項"] → Supabase.item');
  
  // 檢查 CSV 中有多少筆團名是空的
  const csvEmptyName = csvData.filter(row => !row['團名'] || !String(row['團名']).trim());
  console.log(`\nCSV 中團名為空的: ${csvEmptyName.length} 筆`);
  
  if (csvEmptyName.length > 0) {
    console.log('CSV 團名為空的範例:');
    csvEmptyName.slice(0, 3).forEach((row, i) => {
      console.log(`${i+1}. 訂購人="${row['訂購人']}" 團拆編號="${row['團拆編號']}" 團名="${row['團名']}" 購買品項="${row['購買品項']}"`);
    });
  }
}

compareBreaksData();
