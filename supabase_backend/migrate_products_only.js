import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import csv from 'csv-parser';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// 工具函數
function normalizeProductText(value) {
  return String(value || '')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseBool(value) {
  if (!value) return false;
  const v = String(value).trim().toUpperCase();
  return v === 'Y' || v === 'YES' || v === '是' || v === 'TRUE' || v === 'T' || v === '1';
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

console.log('清空 product_catalog...');
await supabase.from('product_catalog').delete().neq('id', '00000000-0000-0000-0000-000000000000');

console.log('讀取 CSV...');
const products = [];
await new Promise((resolve) => {
  fs.createReadStream('product_catalog.csv')
    .pipe(csv())
    .on('data', (row) => {
      const itemName = normalizeProductText(row['item_name'] || '');
      if (!itemName) return;
      
      products.push({
        item_name: itemName,
        card_no: normalizeProductText(row['card_no']) || '',
        price: parseFloat(row['price']) || 0,
        threshold_price: parseFloat(row['threshold_price']) || null,
        discount_threshold: parseInt(row['discount_threshold']) || null,
        min_group_quantity: parseInt(row['min_group_quantity']) || null,
        can_draw_sp: parseBool(row['can_draw_sp']),
        can_draw_signature: parseBool(row['can_draw_signature']),
        can_draw_relic: parseBool(row['can_draw_relic']),
        can_draw_auto_relic: parseBool(row['can_draw_auto_relic']),
        is_available: parseBool(row['is_available']),
        image_url_1: String(row['image_url_1'] || '').trim() || null,
        image_url_2: String(row['image_url_2'] || '').trim() || null,
        image_url_3: String(row['image_url_3'] || '').trim() || null,
        image_url_4: String(row['image_url_4'] || '').trim() || null,
        stock_status: String(row['stock_status'] || '').trim() || null,
        is_box_preorder: parseBool(row['is_box_preorder']),
        can_direct_order: parseBool(row['can_direct_order']),
        remaining_stock: parseInt(row['remaining_stock']) || 0,
        description: String(row['description'] || '').trim() || null,
        category: String(row['category'] || '').trim() || null,
        scheduled_delist_time: parseDate(row['scheduled_delist_time'])
      });
    })
    .on('end', resolve);
});

console.log(`讀取 ${products.length} 筆商品`);

let inserted = 0;
for (let i = 0; i < products.length; i += 50) {
  const batch = products.slice(i, i + 50);
  const { error } = await supabase.from('product_catalog').upsert(batch, { onConflict: 'item_name,card_no' });
  if (error) {
    console.error(`批次 ${i} 錯誤:`, error.message);
  } else {
    inserted += batch.length;
  }
}

console.log(`✅ 完成！插入 ${inserted} 筆商品`);

// 驗證
const { data } = await supabase.from('product_catalog').select('item_name, category, description, min_group_quantity, can_draw_sp').limit(3);
console.log('\n驗證樣本:');
data.forEach(p => console.log(`- ${p.item_name}: category=${p.category}, min_qty=${p.min_group_quantity}, can_draw_sp=${p.can_draw_sp}, desc=${p.description?.substring(0,30)}`));
