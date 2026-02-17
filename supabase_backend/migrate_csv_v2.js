/**
 * CSV → Supabase 遷移腳本 v2
 * 完全對應實際的 Supabase 資料表結構
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const ONLY_ORDERS = process.env.ONLY_ORDERS === '1';
const ONLY_PRODUCTS = process.env.ONLY_PRODUCTS === '1';

console.log(`
╔══════════════════════════════════════════════════════════╗
║        📦 CSV → Supabase 資料遷移腳本 v2              ║
╚══════════════════════════════════════════════════════════╝
`);

// 用戶 phone → user_id 對應表
const userMap = new Map();

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeProductText(value) {
  return String(value || '')
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function loadUserMap() {
  const { data: allUsers, error } = await supabase.from('users').select('id, phone, nickname, real_name');
  if (error) {
    console.error('❌ 讀取 users 失敗:', error.message);
    return;
  }
  if (allUsers) {
    allUsers.forEach(u => {
      if (u.phone) userMap.set(normalizeKey(u.phone), u.id);
      if (u.nickname) userMap.set(normalizeKey(u.nickname), u.id);
      if (u.real_name) userMap.set(normalizeKey(u.real_name), u.id);
    });
  }
  console.log(`✅ 建立了 ${userMap.size} 個用戶對應`);
}

function readCSV(filename) {
  return new Promise((resolve, reject) => {
    const results = [];
    const filePath = path.join(__dirname, filename);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  檔案不存在: ${filename}`);
      resolve([]);
      return;
    }
    
    fs.createReadStream(filePath)
      .pipe(csv({ skipLines: 0, mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '') })) // 移除 BOM
      .on('data', (data) => results.push(data))
      .on('end', () => {
        console.log(`✅ 讀取 ${filename}: ${results.length} 筆`);
        resolve(results);
      })
      .on('error', reject);
  });
}

function parseBool(value) {
  if (!value) return false;
  const v = String(value).trim().toUpperCase();
  return v === 'Y' || v === 'YES' || v === '是' || v === 'TRUE' || v === 'T' || v === '1';
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch (e) {
    return null;
  }
}

/**
 * 1. 遷移用戶 (建立 phone → user_id 對應表)
 */
async function migrateUsers(userData) {
  console.log('\n📌 遷移用戶資料...');
  
  const users = userData.map(row => ({
    phone: String(row['電話'] || '').trim(),
    nickname: String(row['群組暱稱'] || '').trim(),
    birthday: String(row['生日'] || '').trim(),
    email: String(row['email'] || '').trim() || null,
    address: String(row['備註'] || '').trim() || null,
    real_name: String(row['姓名'] || '').trim() || null
  })).filter(u => u.phone);
  
  console.log(`準備插入 ${users.length} 筆用戶`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('users')
      .upsert(batch, { onConflict: 'phone' })
      .select('id, phone');
    
    if (error) {
      console.error(`❌ 插入用戶失敗:`, error.message);
    } else {
      inserted += batch.length;
      // 建立對應表
      if (data) {
        data.forEach(u => {
          if (u.phone) userMap.set(normalizeKey(u.phone), u.id);
        });
      }
      console.log(`✅ 已插入 ${inserted}/${users.length} 筆用戶`);
    }
  }
  
  // 查詢所有用戶建立完整對應表
  const { data: allUsers } = await supabase.from('users').select('id, phone, nickname, real_name');
  if (allUsers) {
    allUsers.forEach(u => {
      if (u.phone) userMap.set(normalizeKey(u.phone), u.id);
      if (u.nickname) userMap.set(normalizeKey(u.nickname), u.id);
      if (u.real_name) userMap.set(normalizeKey(u.real_name), u.id);
    });
  }
  
  console.log(`✅ 建立了 ${userMap.size} 個用戶對應`);
  return inserted;
}

/**
 * 2. 遷移商品
 */
async function migrateProducts(productData) {
  console.log('\n📌 遷移商品資料...');
  console.log(`原始資料筆數: ${productData.length}`);
  
  const products = [];
  for (const row of productData) {
    // 取得所有可能的「品項」key (處理 BOM 或特殊字元問題)
    const keys = Object.keys(row);
    const itemKey = keys.find(k => k.includes('品項')) || '品項';
    const cardKey = keys.find(k => k.includes('卡號')) || '卡號';
    
    const itemName = normalizeProductText(row[itemKey]);
    
    // 跳過空的品項
    if (!itemName || itemName.length === 0) continue;
    
    products.push({
      item_name: itemName,
      card_no: normalizeProductText(row[cardKey]) || '',
      price: parseFloat(row['單價']) || 0,
      threshold_price: parseFloat(row['門檻價']) || null,
      discount_threshold: parseInt(row['優惠門檻']) || null,
      min_group_quantity: parseInt(row['最低開團張數']) || null,
      can_draw_sp: String(row['可抽_SP'] || '').trim() || null,
      can_draw_signature: String(row['可抽_簽名'] || '').trim() || null,
      can_draw_relic: String(row['可抽_Relic'] || '').trim() || null,
      can_draw_auto_relic: String(row['可抽_auto_relic'] || '').trim() || null,
      is_available: parseBool(row['是否開放']),
      image_url_1: String(row['圖片連結_1'] || '').trim() || null,
      image_url_2: String(row['圖片連結_2'] || '').trim() || null,
      image_url_3: String(row['圖片連結_3'] || '').trim() || null,
      image_url_4: String(row['圖片連結_4'] || '').trim() || null,
      stock_status: String(row['到貨狀況'] || '').trim() || null,
      is_box_preorder: parseBool(row['卡盒預購']),
      can_direct_order: parseBool(row['是否可直接訂購']),
      remaining_stock: parseInt(row['剩餘數量']) || 0,
      description: String(row['說明'] || '').trim() || null,
      ordered_quantity: parseInt(row['已訂單卡張數']) || 0,
      scheduled_list_time: parseDate(row['預定上架時間']),
      scheduled_delist_time: parseDate(row['預定下架時間']),
      is_arrival_notified: parseBool(row['已通知到貨']),
      category: String(row['分類'] || '').trim() || null
    });
  }
  
  console.log(`準備插入 ${products.length} 筆商品`);
  if (products.length > 0) {
    console.log('範例商品:', JSON.stringify(products[0], null, 2));
  }
  
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('product_catalog')
      .upsert(batch, { onConflict: 'item_name,card_no' });
    
    if (error) {
      console.error(`❌ 插入商品失敗:`, error.message);
      console.error('問題商品:', batch[0]);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${products.length} 筆商品`);
    }
  }
  
  return inserted;
}

/**
 * 3. 遷移訂單 (使用 userMap 查詢 user_id)
 */
async function migrateOrders(orderData) {
  console.log('\n📌 遷移訂單資料...');
  
  const orders = orderData.map(row => {
    const buyer = String(row['訂購人'] || '').trim();
    const contact = String(row['聯絡方式'] || '').trim();
    const userId = userMap.get(normalizeKey(buyer)) || userMap.get(normalizeKey(contact)) || null;
    
    return {
      user_id: userId,
      timestamp: parseDate(row['時間戳記']),
      item: String(row['品項'] || '').trim(),
      card_no: String(row['卡號'] || '').trim(),
      quantity: parseInt(row['張數']) || 0,
      unit_price: parseFloat(row['單價']) || 0,
      total_fee: parseFloat(row['總價']) || 0,
      deposit: parseFloat(row['訂金']) || 0,
      balance_amount: parseFloat(row['尾款']) || 0,
      is_invoiced: parseBool(row['開單']),
      is_shipped: parseBool(row['寄出']),
      is_cleared: parseBool(row['結清']),
      status: String(row['狀態'] || '').trim() || null,
      arrival_status: String(row['到貨狀態'] || '').trim() || null,
      image_url: String(row['圖片連結'] || '').trim() || null,
      box_order: parseBool(row['卡盒訂單']),
      notes: String(row['備註'] || '').trim() || null,
      payment_method: String(row['付款方式'] || '').trim() || null,
      merchant_trade_no: String(row['綠界訂單號'] || '').trim() || null,
      payment_date: parseDate(row['付款時間'])
    };
  }).filter(o => o.item);
  
  console.log(`準備插入 ${orders.length} 筆訂單 (${orders.filter(o => o.user_id).length} 筆有 user_id)`);
  
  const batchSize = 100;
  let inserted = 0;
  let skipped = 0;
  
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('orders')
      .insert(batch);
    
    if (error) {
      console.error(`❌ 插入訂單失敗 (批次 ${i}-${i+batch.length}):`, error.message);
      skipped += batch.length;
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${orders.length} 筆訂單`);
    }
  }
  
  if (skipped > 0) {
    console.log(`⚠️  跳過 ${skipped} 筆訂單`);
  }
  
  return inserted;
}

/**
 * 4. 遷移團拆紀錄
 */
async function migrateBreaks(breakData) {
  console.log('\n📌 遷移團拆紀錄...');
  
  const breaks = breakData.map(row => {
    return {
      break_id: String(row['團拆編號'] || '').trim(),
      name: String(row['團名'] || '').trim(),
      category: String(row['種類'] || '').trim() || null,
      format: String(row['團拆形式'] || '').trim() || null,
      item: String(row['購買品項'] || '').trim(),
      total_fee: parseFloat(row['總團費']) || 0,
      paid: parseFloat(row['已付金額']) || 0,
      // balance 改為不設定，讓資料庫自動計算
      is_opened: parseBool(row['是否已拆']),
      is_shipped: parseBool(row['卡片是否寄出']),
      is_cleared: parseBool(row['結清']) || false,
      status: String(row['狀態'] || '').trim() || null,
      payment_method: String(row['付款方式'] || '').trim() || null,
      merchant_trade_no: String(row['綠界訂單號'] || '').trim() || null,
      payment_date: parseDate(row['付款時間'])
    };
  }).filter(b => b.break_id);
  
  console.log(`準備插入 ${breaks.length} 筆團拆紀錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < breaks.length; i += batchSize) {
    const batch = breaks.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('breaks')
      .insert(batch);
    
    if (error) {
      console.error(`❌ 插入團拆失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${breaks.length} 筆團拆`);
    }
  }
  
  return inserted;
}

/**
 * 主執行函數
 */
async function main() {
  try {
    console.log('🔗 連線到 Supabase:', process.env.SUPABASE_URL);
    console.log('');
    
    if (ONLY_ORDERS) {
      const ordersTopps = await readCSV('Topps_Now_訂購總表.csv');
      await loadUserMap();

      console.log('\n========================================');
      console.log('開始遷移訂單 (ONLY_ORDERS=1)...');
      console.log('========================================\n');

      const stats = {
        orders: await migrateOrders(ordersTopps)
      };

      console.log('\n');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║                  ✅ 遷移完成統計                       ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`📋 訂單資料:        ${stats.orders} 筆`);
      console.log('');
      console.log(`💡 用戶對應表:      ${userMap.size} 個 phone → user_id 對應`);
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  🎉 訂單遷移完成！                                    ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      return;
    }

    if (ONLY_PRODUCTS) {
      const products = await readCSV('下單商品.csv');

      console.log('\n========================================');
      console.log('開始遷移商品 (ONLY_PRODUCTS=1)...');
      console.log('========================================\n');

      const stats = {
        products: await migrateProducts(products)
      };

      console.log('\n');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║                  ✅ 遷移完成統計                       ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`📦 商品資料:        ${stats.products} 筆`);
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  🎉 商品遷移完成！                                    ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      return;
    }

    // 讀取 CSV
    const [users, products, ordersTopps, breaks] = await Promise.all([
      readCSV('客戶資料.csv'),
      readCSV('下單商品.csv'),
      readCSV('Topps_Now_訂購總表.csv'),
      readCSV('團拆紀錄.csv')
    ]);
    
    console.log('\n========================================');
    console.log('開始遷移資料...');
    console.log('========================================\n');
    
    const stats = {
      users: await migrateUsers(users),
      products: await migrateProducts(products),
      orders: await migrateOrders(ordersTopps),
      breaks: await migrateBreaks(breaks)
    };
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                  ✅ 遷移完成統計                       ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📊 用戶資料:        ${stats.users} 筆`);
    console.log(`📦 商品資料:        ${stats.products} 筆`);
    console.log(`📋 訂單資料:        ${stats.orders} 筆`);
    console.log(`🎯 團拆紀錄:        ${stats.breaks} 筆`);
    console.log('');
    console.log(`💡 用戶對應表:      ${userMap.size} 個 phone → user_id 對應`);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎉 核心資料遷移完成！                                ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n❌ 遷移過程發生錯誤:');
    console.error(error);
    process.exit(1);
  }
}

main();
