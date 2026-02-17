/**
 * 📦 從 CSV 檔案遷移資料到 Supabase
 * 
 * 執行方式:
 * node migrate_from_csv.js
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
║        📦 CSV → Supabase 資料遷移腳本                  ║
╚══════════════════════════════════════════════════════════╝
`);

// CSV 檔案路徑
const CSV_FILES = {
  users: '客戶資料.csv',
  products: '下單商品.csv',
  orders_topps: 'Topps_Now_訂購總表.csv',
  breaks: '團拆紀錄.csv',
  break_credits: '團拆金.csv',
  ecpay_records: '綠界付款記錄.csv',
  shipments: '出貨紀錄.csv',
  daily_fortunes: '每日抽籤紀錄.csv',
  psa_orders: '主訂單.csv',
  psa_cards: '卡片明細.csv',
  order_history: '訂單歷史紀錄.csv'
};

/**
 * 讀取 CSV 檔案
 */
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
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        console.log(`✅ 讀取 ${filename}: ${results.length} 筆`);
        resolve(results);
      })
      .on('error', reject);
  });
}

/**
 * 解析布林值欄位
 */
function parseBool(value) {
  if (!value) return false;
  const v = String(value).trim().toUpperCase();
  return v === 'Y' || v === 'YES' || v === '是' || v === 'TRUE' || v === 'T' || v === '1';
}

/**
 * 格式化日期
 */
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
 * 1. 遷移用戶資料
 */
async function migrateUsers(userData) {
  console.log('\n📌 遷移用戶資料...');
  
  const users = userData.map(row => ({
    phone: String(row['電話'] || '').trim(),
    nickname: String(row['群組暱稱'] || '').trim(),
    name: String(row['姓名'] || '').trim(),
    birthday: String(row['生日'] || '').trim(),
    line_id: String(row['LineID'] || '').trim(),
    email: String(row['email'] || '').trim(),
    ship_store: String(row['7-11店到店門市'] || row['收件門市'] || '').trim(),
    store_number: String(row['711店號'] || row['收件門市店號'] || '').trim(),
    note: String(row['備註'] || '').trim()
  })).filter(u => u.phone);  // 過濾掉沒有電話的資料
  
  console.log(`準備插入 ${users.length} 筆用戶資料`);
  
  // 批次插入 (每次 100 筆)
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('users')
      .upsert(batch, { onConflict: 'phone' });
    
    if (error) {
      console.error(`❌ 插入用戶失敗 (批次 ${i}-${i+batch.length}):`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${users.length} 筆用戶`);
    }
  }
  
  return inserted;
}

/**
 * 2. 遷移商品資料
 */
async function migrateProducts(productData) {
  console.log('\n📌 遷移商品資料...');
  
  const products = productData.map(row => ({
    item_name: String(row['品項'] || '').trim(),
    card_no: String(row['卡號'] || '').trim(),
    price: parseFloat(row['單價']) || 0,
    threshold_price: parseFloat(row['門檻價']) || 0,
    threshold_qty: parseInt(row['優惠門檻']) || 0,
    min_group_qty: parseInt(row['最低開團張數']) || 0,
    can_draw_sp: String(row['可抽_SP'] || '').trim(),
    can_draw_auto: String(row['可抽_簽名'] || '').trim(),
    can_draw_relic: String(row['可抽_Relic'] || '').trim(),
    can_draw_auto_relic: String(row['可抽_auto_relic'] || '').trim(),
    is_open: parseBool(row['是否開放']),
    image_url_1: String(row['圖片連結_1'] || '').trim(),
    image_url_2: String(row['圖片連結_2'] || '').trim(),
    image_url_3: String(row['圖片連結_3'] || '').trim(),
    image_url_4: String(row['圖片連結_4'] || '').trim(),
    arrival_status: String(row['到貨狀況'] || '').trim(),
    is_box: parseBool(row['卡盒預購']),
    is_direct_order: parseBool(row['是否可直接訂購']),
    stock: parseInt(row['剩餘數量']) || 0,
    description: String(row['說明'] || '').trim(),
    total_ordered: parseInt(row['已訂單卡張數']) || 0,
    scheduled_online: parseDate(row['預定上架時間']),
    scheduled_offline: parseDate(row['預定下架時間']),
    arrival_notified: parseBool(row['已通知到貨']),
    category: String(row['分類'] || '').trim()
  })).filter(p => p.item_name);  // 過濾掉沒有品項名稱的資料
  
  console.log(`準備插入 ${products.length} 筆商品資料`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('product_catalog')
      .upsert(batch, { onConflict: 'item_name,card_no' });
    
    if (error) {
      console.error(`❌ 插入商品失敗 (批次 ${i}-${i+batch.length}):`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${products.length} 筆商品`);
    }
  }
  
  return inserted;
}

/**
 * 3. 遷移訂單資料 (Topps Now)
 */
async function migrateOrders(orderData) {
  console.log('\n📌 遷移訂單資料...');
  
  const orders = orderData.map(row => ({
    timestamp: parseDate(row['時間戳記']),
    nickname: String(row['訂購人'] || '').trim(),
    phone: String(row['聯絡方式'] || '').trim(),
    item_name: String(row['品項'] || '').trim(),
    card_no: String(row['卡號'] || '').trim(),
    unit_price: parseFloat(row['單價']) || 0,
    quantity: parseInt(row['張數']) || 0,
    total_price: parseFloat(row['總價']) || 0,
    deposit: parseFloat(row['訂金']) || 0,
    balance: parseFloat(row['尾款']) || 0,
    is_invoiced: parseBool(row['開單']),
    is_shipped: parseBool(row['寄出']),
    is_cleared: parseBool(row['結清']),
    status: String(row['狀態'] || '').trim(),
    arrival_status: String(row['到貨狀態'] || '').trim(),
    image_url: String(row['圖片連結'] || '').trim(),
    is_box_order: parseBool(row['卡盒訂單']),
    note: String(row['備註'] || '').trim(),
    payment_method: String(row['付款方式'] || '').trim(),
    ecpay_trade_no: String(row['綠界訂單號'] || '').trim(),
    payment_time: parseDate(row['付款時間']),
    manual_adjust: parseBool(row['手動調價'])
  })).filter(o => o.item_name);  // 過濾掉沒有品項的資料
  
  console.log(`準備插入 ${orders.length} 筆訂單`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('orders')
      .insert(batch);
    
    if (error) {
      console.error(`❌ 插入訂單失敗 (批次 ${i}-${i+batch.length}):`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${orders.length} 筆訂單`);
    }
  }
  
  return inserted;
}

/**
 * 4. 遷移團拆紀錄
 */
async function migrateBreaks(breakData) {
  console.log('\n📌 遷移團拆紀錄...');
  
  const breaks = breakData.map(row => ({
    nickname: String(row['訂購人'] || '').trim(),
    break_id: String(row['團拆編號'] || '').trim(),
    category: String(row['種類'] || '').trim(),
    break_name: String(row['團名'] || '').trim(),
    break_type: String(row['團拆形式'] || '').trim(),
    item_purchased: String(row['購買品項'] || '').trim(),
    total_fee: parseFloat(row['總團費']) || 0,
    paid_amount: parseFloat(row['已付金額']) || 0,
    is_broken: parseBool(row['是否已拆']),
    is_shipped: parseBool(row['卡片是否寄出']),
    status: String(row['狀態'] || '').trim(),
    payment_method: String(row['付款方式'] || '').trim(),
    ecpay_trade_no: String(row['綠界訂單號'] || '').trim(),
    payment_time: parseDate(row['付款時間'])
  })).filter(b => b.break_id);
  
  console.log(`準備插入 ${breaks.length} 筆團拆紀錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < breaks.length; i += batchSize) {
    const batch = breaks.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('breaks')
      .insert(batch);
    
    if (error) {
      console.error(`❌ 插入團拆失敗 (批次 ${i}-${i+batch.length}):`, error.message);
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
  console.log('\n📌 遷移團拆金...');
  
  const credits = creditData.map(row => ({
    nickname: String(row['暱稱'] || '').trim(),
    credit_amount: parseFloat(row['團拆金']) || 0,
    source: String(row['取得方式'] || '').trim(),
    is_used: parseBool(row['是否使用']),
    used_break: String(row['使用的團拆'] || '').trim(),
    used_amount: parseFloat(row['已使用金額']) || 0
  })).filter(c => c.nickname);
  
  console.log(`準備插入 ${credits.length} 筆團拆金`);
  
  const { data, error } = await supabase
    .from('break_credits')
    .insert(credits);
  
  if (error) {
    console.error('❌ 插入團拆金失敗:', error.message);
    return 0;
  }
  
  console.log(`✅ 已插入 ${credits.length} 筆團拆金`);
  return credits.length;
}

/**
 * 6. 遷移綠界付款記錄
 */
async function migrateEcpayRecords(ecpayData) {
  console.log('\n📌 遷移綠界付款記錄...');
  
  const records = ecpayData.map(row => ({
    payment_number: String(row['付款單號'] || '').trim(),
    customer_phone: String(row['客戶電話'] || '').trim(),
    nickname: String(row['暱稱'] || '').trim(),
    order_number: String(row['訂單編號'] || '').trim(),
    amount: parseFloat(row['金額']) || 0,
    product_name: String(row['商品名稱'] || '').trim(),
    status: String(row['狀態'] || '').trim(),
    created_at: parseDate(row['建立時間']),
    payment_time: parseDate(row['付款時間']),
    ecpay_trade_no: String(row['綠界交易編號'] || '').trim(),
    return_message: String(row['回傳訊息'] || '').trim(),
    updated_at: parseDate(row['更新時間']),
    order_details: String(row['訂單明細'] || '').trim(),
    payment_type: String(row['付款類型'] || '').trim()
  })).filter(r => r.payment_number);
  
  console.log(`準備插入 ${records.length} 筆綠界記錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('ecpay_records')
      .insert(batch);
    
    if (error) {
      console.error(`❌ 插入綠界記錄失敗 (批次 ${i}-${i+batch.length}):`, error.message);
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
  console.log('\n📌 遷移每日抽籤紀錄...');
  
  const fortunes = fortuneData.map(row => ({
    phone: String(row['手機號碼'] || '').trim(),
    nickname: String(row['暱稱'] || '').trim(),
    fortune_date: String(row['抽籤日期'] || '').trim(),
    fortune_time: String(row['抽籤時間'] || '').trim(),
    result: String(row['運勢結果'] || '').trim()
  })).filter(f => f.phone && f.fortune_date);
  
  console.log(`準備插入 ${fortunes.length} 筆抽籤紀錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < fortunes.length; i += batchSize) {
    const batch = fortunes.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('lottery')
      .insert(batch);
    
    if (error) {
      console.error(`❌ 插入抽籤紀錄失敗 (批次 ${i}-${i+batch.length}):`, error.message);
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
  console.log('\n📌 遷移出貨紀錄...');
  
  const shipments = shipmentData.map(row => ({
    shipment_number: String(row['出貨編號'] || '').trim(),
    shipment_date: parseDate(row['出貨日期']),
    nickname: String(row['群組暱稱'] || '').trim(),
    name: String(row['姓名'] || '').trim(),
    phone: String(row['電話'] || '').trim(),
    ship_store: String(row['收件門市'] || '').trim(),
    store_number: String(row['711店號'] || '').trim(),
    items: String(row['商品明細'] || '').trim(),
    tracking_number: String(row['物流單號'] || '').trim(),
    note: String(row['備註'] || '').trim()
  })).filter(s => s.shipment_number);
  
  console.log(`準備插入 ${shipments.length} 筆出貨紀錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < shipments.length; i += batchSize) {
    const batch = shipments.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('shipments')
      .insert(batch);
    
    if (error) {
      console.error(`❌ 插入出貨紀錄失敗 (批次 ${i}-${i+batch.length}):`, error.message);
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
  console.log('\n📌 遷移 PSA 訂單...');
  
  const orders = psaData.map(row => ({
    timestamp: parseDate(row['時間戳記']),
    order_id: String(row['訂單 ID'] || '').trim(),
    name: String(row['姓名'] || '').trim(),
    nickname: String(row['暱稱'] || '').trim(),
    email: String(row['Email'] || '').trim(),
    phone: String(row['手機號碼'] || '').trim(),
    shipping_method: String(row['寄送方式'] || '').trim(),
    total_cards: parseInt(row['總卡片張數']) || 0,
    total_amount: parseFloat(row['總金額']) || 0,
    main_status: String(row['主要狀態'] || '').trim(),
    status_updated_at: parseDate(row['狀態更新時間'])
  })).filter(o => o.order_id);
  
  console.log(`準備插入 ${orders.length} 筆 PSA 訂單`);
  
  const { data, error } = await supabase
    .from('psa_orders')
    .insert(orders);
  
  if (error) {
    console.error('❌ 插入 PSA 訂單失敗:', error.message);
    return 0;
  }
  
  console.log(`✅ 已插入 ${orders.length} 筆 PSA 訂單`);
  return orders.length;
}

/**
 * 10. 遷移訂單歷史
 */
async function migrateOrderHistory(historyData) {
  console.log('\n📌 遷移訂單歷史...');
  
  const history = historyData.map(row => ({
    order_time: parseDate(row['下單時間']),
    nickname: String(row['訂購人'] || '').trim(),
    item_name: String(row['品項'] || '').trim(),
    card_no: String(row['卡號'] || '').trim(),
    quantity: parseInt(row['張數']) || 0
  })).filter(h => h.item_name);
  
  console.log(`準備插入 ${history.length} 筆訂單歷史`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < history.length; i += batchSize) {
    const batch = history.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('order_history')
      .insert(batch);
    
    if (error) {
      console.error(`❌ 插入訂單歷史失敗 (批次 ${i}-${i+batch.length}):`, error.message);
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
    
    // 讀取所有 CSV 檔案
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
      readCSV(CSV_FILES.users),
      readCSV(CSV_FILES.products),
      readCSV(CSV_FILES.orders_topps),
      readCSV(CSV_FILES.breaks),
      readCSV(CSV_FILES.break_credits),
      readCSV(CSV_FILES.ecpay_records),
      readCSV(CSV_FILES.shipments),
      readCSV(CSV_FILES.daily_fortunes),
      readCSV(CSV_FILES.psa_orders),
      readCSV(CSV_FILES.order_history)
    ]);
    
    console.log('\n========================================');
    console.log('開始遷移資料...');
    console.log('========================================\n');
    
    const stats = {
      users: await migrateUsers(users),
      products: await migrateProducts(products),
      orders: await migrateOrders(ordersTopps),
      breaks: await migrateBreaks(breaks),
      breakCredits: await migrateBreakCredits(breakCredits),
      ecpayRecords: await migrateEcpayRecords(ecpayRecords),
      shipments: await migrateShipments(shipments),
      dailyFortunes: await migrateDailyFortunes(dailyFortunes),
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
    console.log(`🚚 出貨紀錄:        ${stats.shipments} 筆`);
    console.log(`🎲 抽籤紀錄:        ${stats.dailyFortunes} 筆`);
    console.log(`🏆 PSA 訂單:        ${stats.psaOrders} 筆`);
    console.log(`📜 訂單歷史:        ${stats.orderHistory} 筆`);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎉 資料遷移成功完成！                                ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n❌ 遷移過程發生錯誤:');
    console.error(error);
    process.exit(1);
  }
}

// 執行遷移
main();
