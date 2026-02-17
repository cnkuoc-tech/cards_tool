/**
 * 完整版資料遷移腳本
 * 包含所有資料表 + user_id 對應關係
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
║        📦 完整資料遷移腳本 (含 user_id 對應)         ║
╚══════════════════════════════════════════════════════════╝
`);

// 對應表
const userMap = new Map(); // phone → user_id
const nicknameMap = new Map(); // nickname → user_id

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
      .pipe(csv({ mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '') }))
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
 * 1. 遷移用戶 (建立 phone 和 nickname 對應表)
 */
async function migrateUsers(userData) {
  console.log('\n📌 1. 遷移用戶資料...');
  
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
      .select('id, phone, nickname');
    
    if (error) {
      console.error(`❌ 插入用戶失敗:`, error.message);
    } else {
      inserted += batch.length;
      if (data) {
        data.forEach(u => {
          userMap.set(u.phone, u.id);
          if (u.nickname) nicknameMap.set(u.nickname, u.id);
        });
      }
      console.log(`✅ 已插入 ${inserted}/${users.length} 筆用戶`);
    }
  }
  
  // 查詢所有用戶建立完整對應表
  const { data: allUsers } = await supabase.from('users').select('id, phone, nickname');
  if (allUsers) {
    allUsers.forEach(u => {
      userMap.set(u.phone, u.id);
      if (u.nickname) nicknameMap.set(u.nickname, u.id);
    });
  }
  
  console.log(`✅ 建立了 ${userMap.size} 個 phone 對應, ${nicknameMap.size} 個 nickname 對應`);
  return inserted;
}

/**
 * 2. 遷移商品
 */
async function migrateProducts(productData) {
  console.log('\n📌 2. 遷移商品資料...');
  
  const products = [];
  for (const row of productData) {
    const keys = Object.keys(row);
    const itemKey = keys.find(k => k.includes('品項')) || '品項';
    const cardKey = keys.find(k => k.includes('卡號')) || '卡號';
    
    const itemName = String(row[itemKey] || '').trim();
    if (!itemName) continue;
    
    products.push({
      item_name: itemName,
      card_no: String(row[cardKey] || '').trim(),
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
  
  const batchSize = 50;
  let inserted = 0;
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const { error } = await supabase
      .from('product_catalog')
      .insert(batch);
    
    if (error) {
      console.error(`❌ 插入商品失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${products.length} 筆商品`);
    }
  }
  
  return inserted;
}

/**
 * 3. 遷移訂單 (使用 nickname → user_id)
 */
async function migrateOrders(orderData) {
  console.log('\n📌 3. 遷移訂單資料...');
  
  const orders = orderData.map(row => {
    const nickname = String(row['訂購人'] || '').trim();
    const userId = nicknameMap.get(nickname) || null;
    
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
  
  const withUserId = orders.filter(o => o.user_id).length;
  console.log(`準備插入 ${orders.length} 筆訂單 (${withUserId} 筆有 user_id)`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    const { error } = await supabase.from('orders').insert(batch);
    
    if (error) {
      console.error(`❌ 插入訂單失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${orders.length} 筆訂單`);
    }
  }
  
  return inserted;
}

/**
 * 4. 遷移團拆紀錄 (使用 nickname → user_id)
 */
async function migrateBreaks(breakData) {
  console.log('\n📌 4. 遷移團拆紀錄...');
  
  const breaks = breakData.map(row => {
    const nickname = String(row['訂購人'] || '').trim();
    const userId = nicknameMap.get(nickname) || null;
    
    return {
      break_id: String(row['團拆編號'] || '').trim(),
      user_id: userId,
      name: String(row['團名'] || '').trim(),
      category: String(row['種類'] || '').trim() || null,
      format: String(row['團拆形式'] || '').trim() || null,
      item: String(row['購買品項'] || '').trim(),
      total_fee: parseFloat(row['總團費']) || 0,
      paid: parseFloat(row['已付金額']) || 0,
      is_opened: parseBool(row['是否已拆']),
      is_shipped: parseBool(row['卡片是否寄出']),
      is_cleared: parseBool(row['結清']) || false,
      status: String(row['狀態'] || '').trim() || null,
      payment_method: String(row['付款方式'] || '').trim() || null,
      merchant_trade_no: String(row['綠界訂單號'] || '').trim() || null,
      payment_date: parseDate(row['付款時間'])
    };
  }).filter(b => b.break_id);
  
  const withUserId = breaks.filter(b => b.user_id).length;
  console.log(`準備插入 ${breaks.length} 筆團拆紀錄 (${withUserId} 筆有 user_id)`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < breaks.length; i += batchSize) {
    const batch = breaks.slice(i, i + batchSize);
    const { error } = await supabase.from('breaks').insert(batch);
    
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
 * 5. 遷移團拆金
 */
async function migrateBreakCredits(creditData) {
  console.log('\n📌 5. 遷移團拆金...');
  
  const credits = creditData.map(row => {
    const nickname = String(row['暱稱'] || '').trim();
    const userId = nicknameMap.get(nickname) || null;
    
    return {
      user_id: userId,
      amount: parseFloat(row['團拆金']) || 0,
      source: String(row['取得方式'] || '').trim() || null,
      is_used: parseBool(row['是否使用']),
      used_break_ids: String(row['使用的團拆'] || '').trim() || null,
      used_amount: parseFloat(row['已使用金額']) || 0
    };
  }).filter(c => c.user_id);
  
  console.log(`準備插入 ${credits.length} 筆團拆金`);
  
  if (credits.length > 0) {
    const { error } = await supabase.from('break_credits').insert(credits);
    if (error) {
      console.error('❌ 插入團拆金失敗:', error.message);
      return 0;
    }
  }
  
  console.log(`✅ 已插入 ${credits.length} 筆團拆金`);
  return credits.length;
}

/**
 * 6. 遷移綠界付款記錄
 */
async function migrateEcpayRecords(ecpayData) {
  console.log('\n📌 6. 遷移綠界付款記錄...');
  
  const records = ecpayData.map(row => {
    const phone = String(row['客戶電話'] || '').trim();
    const userId = userMap.get(phone) || null;
    
    const merchantTradeNo = String(row['付款單號'] || '').trim();
    if (!merchantTradeNo) return null;
    
    const orderDetails = String(row['訂單明細'] || '').trim();
    
    return {
      merchant_trade_no: merchantTradeNo,
      user_id: userId,
      trade_no: String(row['綠界交易編號'] || '').trim() || null,
      trade_amt: parseFloat(row['金額']) || 0,
      payment_date: parseDate(row['付款時間']),
      payment_type: String(row['付款類型'] || '').trim() || null,
      custom_field_1: String(row['訂單編號'] || '').trim().substring(0, 100) || null,
      custom_field_2: String(row['商品名稱'] || '').trim().substring(0, 100) || null,
      custom_field_3: String(row['狀態'] || '').trim() || null,
      custom_field_4: orderDetails.substring(0, 100) || null
    };
  }).filter(r => r !== null);
  
  console.log(`準備插入 ${records.length} 筆綠界記錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase.from('ecpay_records').insert(batch);
    
    if (error) {
      console.error(`❌ 插入綠界記錄失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${records.length} 筆綠界記錄`);
    }
  }
  
  return inserted;
}

/**
 * 7. 遷移每日抽籤紀錄
 */
async function migrateDailyFortunes(fortuneData) {
  console.log('\n📌 7. 遷移每日抽籤紀錄...');
  
  const fortunes = fortuneData.map(row => {
    const phone = String(row['手機號碼'] || '').trim();
    const userId = userMap.get(phone) || null;
    
    // lottery 表的結構與其他表不同，需要適配
    return {
      user_id: userId,
      item: String(row['運勢結果'] || '').trim() || '抽籤',
      quantity: 1,
      total_fee: 0,
      paid: 0,
      status: '已完成',
      created_at: parseDate(row['抽籤日期']) || new Date().toISOString()
    };
  }).filter(f => f.user_id);
  
  console.log(`準備插入 ${fortunes.length} 筆抽籤紀錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < fortunes.length; i += batchSize) {
    const batch = fortunes.slice(i, i + batchSize);
    const { error } = await supabase.from('lottery').insert(batch);
    
    if (error) {
      console.error(`❌ 插入抽籤紀錄失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${fortunes.length} 筆抽籤紀錄`);
    }
  }
  
  return inserted;
}

/**
 * 8. 遷移出貨紀錄
 */
async function migrateShipments(shipmentData) {
  console.log('\n📌 8. 遷移出貨紀錄...');
  
  const shipments = shipmentData.map(row => {
    const phone = String(row['電話'] || '').trim();
    const userId = userMap.get(phone) || null;
    
    return {
      user_id: userId,
      shipment_no: String(row['出貨編號'] || '').trim(),
      shipment_date: parseDate(row['出貨日期']),
      nickname: String(row['群組暱稱'] || '').trim() || null,
      real_name: String(row['姓名'] || '').trim() || null,
      phone: phone || null,
      ship_store: String(row['收件門市'] || '').trim() || null,
      store_number: String(row['711店號'] || '').trim() || null,
      items: String(row['商品明細'] || '').trim() || null,
      tracking_no: String(row['物流單號'] || '').trim() || null,
      remark: String(row['備註'] || '').trim() || null,
      status: '已出貨'
    };
  }).filter(s => s.shipment_no);
  
  console.log(`準備插入 ${shipments.length} 筆出貨紀錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < shipments.length; i += batchSize) {
    const batch = shipments.slice(i, i + batchSize);
    const { error } = await supabase.from('shipments').insert(batch);
    
    if (error) {
      console.error(`❌ 插入出貨紀錄失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${shipments.length} 筆出貨紀錄`);
    }
  }
  
  return inserted;
}

/**
 * 9. 遷移 PSA 訂單
 */
async function migratePsaOrders(psaData) {
  console.log('\n📌 9. 遷移 PSA 訂單...');
  
  const orders = psaData.map(row => {
    const phone = String(row['手機號碼'] || '').trim();
    const userId = userMap.get(phone) || null;
    
    return {
      user_id: userId,
      order_id: String(row['訂單 ID'] || '').trim(),
      real_name: String(row['姓名'] || '').trim() || null,
      email: String(row['Email'] || '').trim() || null,
      phone: phone || null,
      shipping_method: String(row['寄送方式'] || '').trim() || null,
      total_cards: parseInt(row['總卡片張數']) || 0,
      total_amount: parseFloat(row['總金額']) || 0,
      status: String(row['主要狀態'] || '').trim() || '處理中',
      timestamp: parseDate(row['時間戳記']),
      status_updated_at: parseDate(row['狀態更新時間'])
    };
  }).filter(o => o.order_id);
  
  console.log(`準備插入 ${orders.length} 筆 PSA 訂單`);
  
  if (orders.length > 0) {
    const { error } = await supabase.from('psa_orders').upsert(orders, { onConflict: 'order_id' });
    if (error) {
      console.error('❌ 插入 PSA 訂單失敗:', error.message);
      return 0;
    }
  }
  
  console.log(`✅ 已插入 ${orders.length} 筆 PSA 訂單`);
  return orders.length;
}

/**
 * 10. 遷移訂單歷史
 */
async function migrateOrderHistory(historyData) {
  console.log('\n📌 10. 遷移訂單歷史...');
  
  const history = historyData.map(row => {
    const nickname = String(row['訂購人'] || '').trim();
    const userId = nicknameMap.get(nickname) || null;
    
    return {
      user_id: userId,
      action: '下單',
      order_type: '商品訂單',
      item: String(row['品項'] || '').trim(),
      amount: parseInt(row['張數']) || 0,
      timestamp: parseDate(row['下單時間'])
    };
  }).filter(h => h.item);
  
  console.log(`準備插入 ${history.length} 筆訂單歷史`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < history.length; i += batchSize) {
    const batch = history.slice(i, i + batchSize);
    const { error } = await supabase.from('order_history').insert(batch);
    
    if (error) {
      console.error(`❌ 插入訂單歷史失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${history.length} 筆訂單歷史`);
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
    
    // 讀取所有 CSV
    const [
      users,
      products,
      ordersTopps,
      breaks,
      breakCredits,
      ecpayRecords,
      shipments,
      dailyFortunes,
      psaOrders,
      orderHistory
    ] = await Promise.all([
      readCSV('客戶資料.csv'),
      readCSV('下單商品.csv'),
      readCSV('Topps_Now_訂購總表.csv'),
      readCSV('團拆紀錄.csv'),
      readCSV('團拆金.csv'),
      readCSV('綠界付款記錄.csv'),
      readCSV('出貨紀錄.csv'),
      readCSV('每日抽籤紀錄.csv'),
      readCSV('主訂單.csv'),
      readCSV('訂單歷史紀錄.csv')
    ]);
    
    console.log('\n========================================');
    console.log('開始遷移資料...');
    console.log('========================================');
    
    const stats = {
      users: await migrateUsers(users),
      products: await migrateProducts(products),
      orders: await migrateOrders(ordersTopps),
      breaks: await migrateBreaks(breaks),
      breakCredits: await migrateBreakCredits(breakCredits),
      ecpayRecords: await migrateEcpayRecords(ecpayRecords),
      dailyFortunes: await migrateDailyFortunes(dailyFortunes),
      shipments: await migrateShipments(shipments),
      psaOrders: await migratePsaOrders(psaOrders),
      orderHistory: await migrateOrderHistory(orderHistory)
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
    console.log(`💰 團拆金:          ${stats.breakCredits} 筆`);
    console.log(`💳 綠界記錄:        ${stats.ecpayRecords} 筆`);
    console.log(`🎲 抽籤紀錄:        ${stats.dailyFortunes} 筆`);
    console.log(`🚚 出貨紀錄:        ${stats.shipments} 筆`);
    console.log(`🏆 PSA 訂單:        ${stats.psaOrders} 筆`);
    console.log(`📜 訂單歷史:        ${stats.orderHistory} 筆`);
    console.log('');
    console.log(`💡 用戶對應:        ${userMap.size} 個 phone, ${nicknameMap.size} 個 nickname`);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎉 所有資料遷移完成！                                ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n❌ 遷移過程發生錯誤:');
    console.error(error);
    process.exit(1);
  }
}

main();
