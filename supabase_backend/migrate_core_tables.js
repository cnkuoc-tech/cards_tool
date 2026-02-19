/**
 * 📦 核心資料遷移腳本 - 6 個核心表
 * 
 * 遷移表格：
 * 1. users
 * 2. product_catalog
 * 3. orders
 * 4. breaks
 * 5. shipments
 * 6. break_credits
 * 
 * 執行方式:
 * node migrate_core_tables.js
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

console.log(`
╔══════════════════════════════════════════════════════════╗
║        📦 核心資料遷移腳本 - 6 個核心表               ║
╚══════════════════════════════════════════════════════════╝
`);

// 用戶對應表
const userMap = new Map();

// 工具函數
function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

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
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch (e) {
    return null;
  }
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
      .pipe(csv({ skipLines: 0, mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '') }))
      .on('data', (data) => results.push(data))
      .on('end', () => {
        console.log(`✅ 讀取 ${filename}: ${results.length} 筆`);
        resolve(results);
      })
      .on('error', reject);
  });
}

/**
 * 1. 遷移用戶 (users)
 */
async function migrateUsers(userData) {
  console.log('\n📌 [1/6] 遷移用戶資料...');
  
  const users = userData.map(row => ({
    phone: String(row['phone'] || '').trim(),
    nickname: String(row['nickname'] || '').trim(),
    birthday: String(row['birthday'] || '').trim(),
    email: String(row['email'] || '').trim() || null,
    address: String(row['address'] || '').trim() || null,
    real_name: String(row['real_name'] || '').trim() || null,
    cvs_store_name: String(row['cvs_store_name'] || '').trim() || null,
    cvs_store_id: String(row['cvs_store_id'] || '').trim() || null
  })).filter(u => u.phone);
  
  console.log(`準備插入 ${users.length} 筆用戶`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('users')
      .upsert(batch, { onConflict: 'phone' })
      .select('id, phone, nickname, real_name');
    
    if (error) {
      console.error(`❌ 插入用戶失敗 (批次 ${i}):`, error.message);
    } else {
      inserted += batch.length;
      // 更新用戶對應表
      if (data) {
        data.forEach(u => {
          if (u.phone) userMap.set(normalizeKey(u.phone), u.id);
          if (u.nickname) userMap.set(normalizeKey(u.nickname), u.id);
          if (u.real_name) userMap.set(normalizeKey(u.real_name), u.id);
        });
      }
      console.log(`✅ 已插入 ${inserted}/${users.length} 筆用戶`);
    }
  }
  
  console.log(`✅ 用戶對應表: ${userMap.size} 個映射\n`);
  return inserted;
}

/**
 * 2. 遷移商品 (product_catalog)
 */
async function migrateProducts(productData) {
  console.log('📌 [2/6] 遷移商品資料...');
  
  const products = [];
  for (const row of productData) {
    const itemName = normalizeProductText(row['item_name'] || '');
    if (!itemName || itemName.length === 0) continue;
    
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
  }
  
  console.log(`準備插入 ${products.length} 筆商品`);
  
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const { error } = await supabase
      .from('product_catalog')
      .upsert(batch, { onConflict: 'item_name,card_no' });
    
    if (error) {
      console.error(`❌ 插入商品失敗 (批次 ${i}):`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${products.length} 筆商品`);
    }
  }
  
  console.log('');
  return inserted;
}

/**
 * 3. 遷移訂單 (orders)
 */
async function migrateOrders(orderData, userMap) {
  console.log('📌 [3/6] 遷移訂單資料...');
  
  const orders = orderData.map(row => {
    // CSV user_id 欄位存的是暱稱，需要轉換成 UUID
    const nickname = String(row['user_id'] || '').trim();
    const userId = userMap.get(normalizeKey(nickname)) || null;
    
    return {
      user_id: userId,
      timestamp: parseDate(row['timestamp']),
      item: String(row['item'] || '').trim(),
      card_no: String(row['card_no'] || '').trim(),
      quantity: parseInt(row['quantity']) || 0,
      unit_price: parseFloat(row['unit_price']) || 0,
      total_fee: parseFloat(row['total_fee']) || 0,
      deposit: parseFloat(row['deposit']) || 0,
      balance_amount: parseFloat(row['balance_amount']) || 0,
      is_invoiced: String(row['is_invoiced'] || '').trim() || null,
      is_shipped: String(row['is_shipped'] || '').trim() || null,
      is_cleared: parseBool(row['is_cleared']),
      status: String(row['status'] || '').trim() || null,
      arrival_status: String(row['arrival_status'] || '').trim() || null,
      image_url: String(row['image_url '] || row['image_url'] || '').trim() || null,  // CSV 欄位名稱有空格
      box_order: String(row['box_order'] || '').trim() || null,
      notes: String(row['notes'] || '').trim() || null,
      remark: String(row['remark'] || '').trim() || null,
      payment_method: String(row['payment_method'] || '').trim() || null,
      merchant_trade_no: String(row['merchant_trade_no'] || '').trim() || null,
      payment_date: parseDate(row['payment_date'])
    };
  }).filter(o => o.item);
  
  const withUserId = orders.filter(o => o.user_id).length;
  const withoutUserId = orders.length - withUserId;
  
  console.log(`準備插入 ${orders.length} 筆訂單`);
  console.log(`  ✅ ${withUserId} 筆有 user_id`);
  if (withoutUserId > 0) {
    console.log(`  ⚠️  ${withoutUserId} 筆無 user_id (將設為 NULL)`);
  }
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    const { error } = await supabase.from('orders').insert(batch);
    
    if (error) {
      console.error(`❌ 插入訂單失敗 (批次 ${i}):`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${orders.length} 筆訂單`);
    }
  }
  
  console.log('');
  return inserted;
}

/**
 * 4. 遷移團拆 (breaks)
 */
async function migrateBreaks(breakData, userMap) {
  console.log('📌 [4/6] 遷移團拆記錄...');
  
  const breaks = breakData.map(row => {
    // CSV user_id 欄位存的是暱稱，需要轉換成 UUID
    const nickname = String(row['user_id'] || '').trim();
    const userId = userMap.get(normalizeKey(nickname)) || null;
    
    return {
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
      payment_date: parseDate(row['payment_date']),
      remark: String(row['remark'] || '').trim() || null
    };
  }).filter(b => b.break_id);
  
  const withUserId = breaks.filter(b => b.user_id).length;
  const withoutUserId = breaks.length - withUserId;
  
  console.log(`準備插入 ${breaks.length} 筆團拆記錄`);
  console.log(`  ✅ ${withUserId} 筆有 user_id`);
  if (withoutUserId > 0) {
    console.log(`  ⚠️  ${withoutUserId} 筆無 user_id (將設為 NULL)`);
  }
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < breaks.length; i += batchSize) {
    const batch = breaks.slice(i, i + batchSize);
    const { error } = await supabase.from('breaks').insert(batch);
    
    if (error) {
      console.error(`❌ 插入團拆失敗 (批次 ${i}):`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${breaks.length} 筆團拆`);
    }
  }
  
  console.log('');
  return inserted;
}

/**
 * 5. 遷移出貨記錄 (shipments)
 */
async function migrateShipments(shipmentData, userMap) {
  console.log('📌 [5/6] 遷移出貨記錄...');
  
  const shipments = shipmentData.map(row => {
    // CSV user_id 欄位存的是暱稱，需要轉換成 UUID
    const nickname = String(row['user_id'] || '').trim();
    const userId = userMap.get(normalizeKey(nickname)) || null;
    
    // 解析商品明細
    let items = null;
    const itemsStr = String(row['items'] || '').trim();
    try {
      items = JSON.parse(itemsStr);
    } catch (e) {
      items = itemsStr ? [{ item: itemsStr }] : null;
    }
    
    return {
      shipment_no: String(row['shipment_no'] || '').trim(),
      user_id: userId,
      shipment_date: parseDate(row['shipment_date']),
      nickname: String(row['nickname'] || '').trim() || null,
      real_name: String(row['real_name'] || '').trim() || null,
      phone: String(row['phone'] || '').trim() || null,
      ship_store: String(row['ship_store'] || '').trim() || null,
      store_number: String(row['store_number'] || '').trim() || null,
      tracking_no: String(row['tracking_no'] || '').trim() || null,
      items: items,
      status: String(row['status'] || 'shipped').trim(),
      remark: String(row['remark'] || '').trim() || null
    };
  }).filter(s => s.shipment_no);
  
  const withUserId = shipments.filter(s => s.user_id).length;
  const withoutUserId = shipments.length - withUserId;
  
  console.log(`準備插入 ${shipments.length} 筆出貨記錄`);
  console.log(`  ✅ ${withUserId} 筆有 user_id`);
  if (withoutUserId > 0) {
    console.log(`  ⚠️  ${withoutUserId} 筆無 user_id (將設為 NULL)`);
  }
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < shipments.length; i += batchSize) {
    const batch = shipments.slice(i, i + batchSize);
    const { error } = await supabase.from('shipments').insert(batch);
    
    if (error) {
      console.error(`❌ 插入出貨記錄失敗 (批次 ${i}):`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${shipments.length} 筆出貨記錄`);
    }
  }
  
  console.log('');
  return inserted;
}

/**
 * 6. 遷移團拆金 (break_credits)
 */
async function migrateBreakCredits(creditData, userMap) {
  console.log('📌 [6/6] 遷移團拆金...');
  
  const credits = creditData.map(row => {
    // CSV user_id 欄位存的是暱稱，需要轉換成 UUID
    const nickname = String(row['user_id'] || '').trim();
    const userId = userMap.get(normalizeKey(nickname)) || null;
    
    const isUsed = parseBool(row['is_used']);
    
    return {
      user_id: userId,
      amount: parseFloat(row['amount']) || 0,
      source: String(row['source'] || '').trim() || null,
      is_used: isUsed,
      used_break_ids: String(row['used_break_ids'] || '').trim() || null,
      used_amount: parseFloat(row['used_amount']) || 0
    };
  }).filter(c => c.user_id && c.amount > 0);
  
  console.log(`準備插入 ${credits.length} 筆團拆金`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < credits.length; i += batchSize) {
    const batch = credits.slice(i, i + batchSize);
    const { error } = await supabase.from('break_credits').insert(batch);
    
    if (error) {
      console.error(`❌ 插入團拆金失敗 (批次 ${i}):`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${credits.length} 筆團拆金`);
    }
  }
  
  console.log('');
  return inserted;
}

/**
 * 主執行函數
 */
async function main() {
  try {
    console.log('🔗 連線到 Supabase:', process.env.SUPABASE_URL);
    console.log('');
    
    // 檢查必要的 CSV 檔案
    const requiredFiles = [
      'users.csv',
      'product_catalog.csv',
      'orders.csv',
      'breaks.csv',
      'shipments.csv',
      'break_credits.csv'
    ];
    
    console.log('📂 檢查 CSV 檔案...\n');
    for (const file of requiredFiles) {
      const exists = fs.existsSync(path.join(__dirname, file));
      if (exists) {
        console.log(`  ✅ ${file}`);
      } else {
        console.log(`  ❌ ${file} - 檔案不存在！`);
        throw new Error(`缺少必要檔案: ${file}`);
      }
    }
    console.log('');
    
    // 讀取 CSV
    console.log('📖 讀取 CSV 檔案...\n');
    const [users, products, orders, breaks, shipments, credits] = await Promise.all([
      readCSV('users.csv'),
      readCSV('product_catalog.csv'),
      readCSV('orders.csv'),
      readCSV('breaks.csv'),
      readCSV('shipments.csv'),
      readCSV('break_credits.csv')
    ]);
    
    console.log('\n========================================');
    console.log('開始遷移資料...');
    console.log('========================================\n');
    
    const stats = {};
    
    // 1. 遷移用戶 (必須第一個) - 同時建立 userMap
    stats.users = await migrateUsers(users);
    
    // 2. 遷移商品
    stats.products = await migrateProducts(products);
    
    // 3. 遷移訂單 (需要 userMap)
    stats.orders = await migrateOrders(orders, userMap);
    
    // 4. 遷移團拆 (需要 userMap)
    stats.breaks = await migrateBreaks(breaks, userMap);
    
    // 5. 遷移出貨記錄 (需要 userMap)
    stats.shipments = await migrateShipments(shipments, userMap);
    
    // 6. 遷移團拆金 (需要 userMap)
    stats.credits = await migrateBreakCredits(credits, userMap);
    
    // 顯示統計
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                  ✅ 遷移完成統計                       ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📊 [1] 用戶資料:       ${stats.users} 筆`);
    console.log(`📦 [2] 商品資料:       ${stats.products} 筆`);
    console.log(`📋 [3] 訂單資料:       ${stats.orders} 筆`);
    console.log(`🎯 [4] 團拆記錄:       ${stats.breaks} 筆`);
    console.log(`📮 [5] 出貨記錄:       ${stats.shipments} 筆`);
    console.log(`💰 [6] 團拆金:         ${stats.credits} 筆`);
    console.log('');
    console.log(`💡 用戶對應表:      ${userMap.size} 個 phone/nickname/real_name → user_id`);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎉 核心資料遷移完成！                                ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📝 下一步：');
    console.log('  1. 執行驗證腳本: node verify_migration.js');
    console.log('  2. 登入前端測試功能');
    console.log('  3. 檢查資料是否正確');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ 遷移過程發生錯誤:');
    console.error(error);
    process.exit(1);
  }
}

main();
