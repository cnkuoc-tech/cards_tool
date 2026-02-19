/**
 * 📦 完整資料遷移腳本 - 支援所有 11 個資料表
 * 
 * 執行方式:
 * node migrate_all_tables.js
 * 
 * 環境變數控制:
 * SKIP_USERS=1        - 跳過用戶遷移
 * SKIP_PRODUCTS=1     - 跳過商品遷移
 * SKIP_ORDERS=1       - 跳過訂單遷移
 * SKIP_BREAKS=1       - 跳過團拆遷移
 * SKIP_SHIPMENTS=1    - 跳過出貨遷移
 * SKIP_CREDITS=1      - 跳過團拆金遷移
 * SKIP_NOTIFICATIONS=1 - 跳過付款通知遷移
 * SKIP_LOTTERY=1      - 跳過抽籤遷移
 * SKIP_ECPAY=1        - 跳過綠界記錄遷移
 * SKIP_PSA=1          - 跳過PSA訂單遷移
 * SKIP_HISTORY=1      - 跳過訂單歷史遷移
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
║        📦 完整資料遷移腳本 v3 - 支援 11 個資料表      ║
╚══════════════════════════════════════════════════════════╝
`);

// 用戶對應表 (phone/nickname/real_name → user_id)
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
 * 建立用戶對應表
 */
async function loadUserMap() {
  console.log('🔍 載入用戶對應表...');
  const { data: allUsers, error } = await supabase
    .from('users')
    .select('id, phone, nickname, real_name');
  
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
  
  console.log(`✅ 建立了 ${userMap.size} 個用戶對應\n`);
}

/**
 * 1. 遷移用戶 (users)
 * CSV: 客戶資料.csv
 */
async function migrateUsers(userData) {
  console.log('📌 [1/11] 遷移用戶資料...');
  
  const users = userData.map(row => ({
    phone: String(row['電話'] || '').trim(),
    nickname: String(row['群組暱稱'] || '').trim(),
    birthday: String(row['生日'] || '').trim(),
    email: String(row['email'] || '').trim() || null,
    address: String(row['備註'] || '').trim() || null,
    real_name: String(row['姓名'] || '').trim() || null,
    cvs_store_name: String(row['收件用門市'] || '').trim() || null,
    cvs_store_id: String(row['711店號'] || '').trim() || null
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
      console.error(`❌ 插入用戶失敗:`, error.message);
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
  
  console.log(`✅ 用戶對應表: ${userMap.size} 個\n`);
  return inserted;
}

/**
 * 2. 遷移商品 (product_catalog)
 * CSV: 下單商品.csv
 */
async function migrateProducts(productData) {
  console.log('📌 [2/11] 遷移商品資料...');
  
  const products = [];
  for (const row of productData) {
    const keys = Object.keys(row);
    const itemKey = keys.find(k => k.includes('品項')) || '品項';
    const cardKey = keys.find(k => k.includes('卡號')) || '卡號';
    
    const itemName = normalizeProductText(row[itemKey]);
    if (!itemName || itemName.length === 0) continue;
    
    products.push({
      item_name: itemName,
      card_no: normalizeProductText(row[cardKey]) || '',
      price: parseFloat(row['單價']) || 0,
      threshold_price: parseFloat(row['門檻價']) || null,
      discount_threshold: parseInt(row['優惠門檻']) || null,
      is_available: parseBool(row['是否開放']),
      image_url_1: String(row['圖片連結_1'] || '').trim() || null,
      image_url_2: String(row['圖片連結_2'] || '').trim() || null,
      image_url_3: String(row['圖片連結_3'] || '').trim() || null,
      image_url_4: String(row['圖片連結_4'] || '').trim() || null,
      stock_status: String(row['到貨狀況'] || '').trim() || null,
      is_box_preorder: parseBool(row['卡盒預購']),
      can_direct_order: parseBool(row['是否可直接訂購']),
      remaining_stock: parseInt(row['剩餘數量']) || 0,
      scheduled_delist_time: parseDate(row['預定下架時間'])
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
      console.error(`❌ 插入商品失敗:`, error.message);
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
 * CSV: Topps_Now_訂購總表.csv
 */
async function migrateOrders(orderData) {
  console.log('📌 [3/11] 遷移訂單資料...');
  
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
      is_invoiced: parseBool(row['開單']) ? 'Y' : 'N',
      is_shipped: parseBool(row['寄出']) ? 'Y' : 'N',
      is_cleared: parseBool(row['結清']),
      status: String(row['狀態'] || '').trim() || null,
      arrival_status: String(row['到貨狀態'] || '').trim() || null,
      image_url: String(row['圖片連結'] || '').trim() || null,
      box_order: String(row['卡盒訂單'] || '').trim() || null,
      notes: String(row['備註'] || '').trim() || null,
      payment_method: String(row['付款方式'] || '').trim() || null,
      merchant_trade_no: String(row['綠界訂單號'] || '').trim() || null,
      payment_date: parseDate(row['付款時間'])
    };
  }).filter(o => o.item);
  
  console.log(`準備插入 ${orders.length} 筆訂單 (${orders.filter(o => o.user_id).length} 筆有 user_id)`);
  
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
  
  console.log('');
  return inserted;
}

/**
 * 4. 遷移團拆 (breaks)
 * CSV: 團拆紀錄.csv
 */
async function migrateBreaks(breakData) {
  console.log('📌 [4/11] 遷移團拆記錄...');
  
  const breaks = breakData.map(row => {
    const buyer = String(row['訂購人'] || '').trim();
    const userId = userMap.get(normalizeKey(buyer)) || null;
    
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
      is_cleared: parseBool(row['結清']),
      status: String(row['狀態'] || '').trim() || null,
      payment_method: String(row['付款方式'] || '').trim() || null,
      merchant_trade_no: String(row['綠界訂單號'] || '').trim() || null,
      payment_date: parseDate(row['付款時間']),
      remark: String(row['備註'] || '').trim() || null
    };
  }).filter(b => b.break_id);
  
  console.log(`準備插入 ${breaks.length} 筆團拆記錄`);
  
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
  
  console.log('');
  return inserted;
}

/**
 * 5. 遷移出貨記錄 (shipments)
 * CSV: 出貨紀錄.csv
 */
async function migrateShipments(shipmentData) {
  console.log('📌 [5/11] 遷移出貨記錄...');
  
  const shipments = shipmentData.map(row => {
    const nickname = String(row['群組暱稱'] || '').trim();
    const phone = String(row['電話'] || '').trim();
    const userId = userMap.get(normalizeKey(nickname)) || userMap.get(normalizeKey(phone)) || null;
    
    // 解析商品明細 (可能是 JSON 或純文字)
    let items = null;
    const itemsStr = String(row['商品明細'] || '').trim();
    try {
      items = JSON.parse(itemsStr);
    } catch (e) {
      // 如果不是 JSON，就包裝成陣列
      items = itemsStr ? [{ item: itemsStr }] : null;
    }
    
    return {
      shipment_no: String(row['出貨編號'] || '').trim(),
      user_id: userId,
      shipment_date: parseDate(row['出貨日期']),
      nickname: nickname || null,
      real_name: String(row['姓名'] || '').trim() || null,
      phone: phone || null,
      ship_store: String(row['收件門市'] || '').trim() || null,
      store_number: String(row['711店號'] || '').trim() || null,
      tracking_no: String(row['物流單號'] || '').trim() || null,
      items: items,
      status: 'shipped',
      remark: String(row['備註'] || '').trim() || null
    };
  }).filter(s => s.shipment_no);
  
  console.log(`準備插入 ${shipments.length} 筆出貨記錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < shipments.length; i += batchSize) {
    const batch = shipments.slice(i, i + batchSize);
    const { error } = await supabase.from('shipments').insert(batch);
    
    if (error) {
      console.error(`❌ 插入出貨記錄失敗:`, error.message);
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
 * CSV: 團拆金.csv
 */
async function migrateBreakCredits(creditData) {
  console.log('📌 [6/11] 遷移團拆金...');
  
  const credits = creditData.map(row => {
    const nickname = String(row['暱稱'] || '').trim();
    const userId = userMap.get(normalizeKey(nickname)) || null;
    
    const isUsed = parseBool(row['是否使用']);
    
    return {
      user_id: userId,
      amount: parseFloat(row['團拆金']) || 0,
      source: String(row['取得方式'] || '').trim() || null,
      is_used: isUsed,
      used_break_ids: isUsed ? String(row['使用的團拆'] || '').trim() || null : null,
      used_amount: parseFloat(row['已使用金額']) || 0
    };
  }).filter(c => c.user_id && c.amount > 0);
  
  console.log(`準備插入 ${credits.length} 筆團拆金`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < credits.length; i += batchSize) {
    const batch = credits.slice(i, i + batchSize);
    const { error } = await supabase.from('break_credits').insert(batch);
    
    if (error) {
      console.error(`❌ 插入團拆金失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${credits.length} 筆團拆金`);
    }
  }
  
  console.log('');
  return inserted;
}

/**
 * 7. 遷移付款通知 (notifications) - 暫無 CSV
 */
async function migrateNotifications() {
  console.log('📌 [7/11] 付款通知 - 跳過（無對應 CSV）\n');
  return 0;
}

/**
 * 8. 遷移每日抽籤 (lottery)
 * CSV: 每日抽籤紀錄.csv
 */
async function migrateLottery(lotteryData) {
  console.log('📌 [8/11] 遷移每日抽籤記錄...');
  
  const lottery = lotteryData.map(row => {
    const phone = String(row['手機號碼'] || '').trim();
    const nickname = String(row['暱稱'] || '').trim();
    const userId = userMap.get(normalizeKey(phone)) || userMap.get(normalizeKey(nickname)) || null;
    
    // 組合日期和時間
    const dateStr = String(row['抽籤日期'] || '').trim();
    const timeStr = String(row['抽籤時間'] || '').trim();
    let drawDate = null;
    if (dateStr && timeStr) {
      drawDate = parseDate(`${dateStr} ${timeStr}`);
    } else if (dateStr) {
      drawDate = parseDate(dateStr);
    }
    
    return {
      user_id: userId,
      result: String(row['運勢結果'] || '').trim(),
      draw_date: drawDate,
      status: '已完成'
    };
  }).filter(l => l.user_id && l.result);
  
  console.log(`準備插入 ${lottery.length} 筆抽籤記錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < lottery.length; i += batchSize) {
    const batch = lottery.slice(i, i + batchSize);
    const { error } = await supabase.from('lottery').insert(batch);
    
    if (error) {
      console.error(`❌ 插入抽籤記錄失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${lottery.length} 筆抽籤記錄`);
    }
  }
  
  console.log('');
  return inserted;
}

/**
 * 9. 遷移綠界付款記錄 (ecpay_records)
 * CSV: 綠界付款記錄.csv
 */
async function migrateEcpayRecords(ecpayData) {
  console.log('📌 [9/11] 遷移綠界付款記錄...');
  
  const records = ecpayData.map(row => {
    const phone = String(row['客戶電話'] || '').trim();
    const nickname = String(row['暱稱'] || '').trim();
    const userId = userMap.get(normalizeKey(phone)) || userMap.get(normalizeKey(nickname)) || null;
    
    // 解析訂單明細
    let orderDetails = null;
    const detailsStr = String(row['訂單明細'] || '').trim();
    try {
      orderDetails = JSON.parse(detailsStr);
    } catch (e) {
      orderDetails = null;
    }
    
    return {
      merchant_trade_no: String(row['付款單號'] || '').trim(),
      user_id: userId,
      trade_amt: parseFloat(row['金額']) || 0,
      trade_desc: String(row['商品名稱'] || '').trim() || null,
      item_name: String(row['商品名稱'] || '').trim() || null,
      payment_type: String(row['付款類型'] || '').trim() || 'order',
      return_code: String(row['狀態'] || '').trim() === 'success' ? '1' : '0',
      return_message: String(row['回傳訊息'] || '').trim() || null,
      trade_no: String(row['綠界交易編號'] || '').trim() || null,
      trade_date: parseDate(row['建立時間']),
      payment_date: parseDate(row['付款時間']),
      custom_field_1: phone || null,
      custom_field_2: String(row['訂單編號'] || '').trim() || null,
      order_details: orderDetails,
      status: String(row['狀態'] || '').trim() || 'pending'
    };
  }).filter(r => r.merchant_trade_no);
  
  console.log(`準備插入 ${records.length} 筆綠界記錄`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('ecpay_records')
      .upsert(batch, { onConflict: 'merchant_trade_no' });
    
    if (error) {
      console.error(`❌ 插入綠界記錄失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${records.length} 筆綠界記錄`);
    }
  }
  
  console.log('');
  return inserted;
}

/**
 * 10. 遷移 PSA 訂單 (psa_orders)
 * CSV: 主訂單.csv
 */
async function migratePsaOrders(psaData) {
  console.log('📌 [10/11] 遷移 PSA 訂單...');
  
  const orders = psaData.map(row => {
    const phone = String(row['電話'] || '').trim();
    const userId = userMap.get(normalizeKey(phone)) || null;
    
    return {
      order_id: String(row['訂單編號'] || '').trim(),
      user_id: userId,
      real_name: String(row['姓名'] || '').trim() || null,
      email: String(row['Email'] || '').trim() || null,
      phone: phone || null,
      shipping_method: String(row['寄送方式'] || '').trim() || null,
      total_cards: parseInt(row['總卡片數']) || 0,
      total_amount: parseFloat(row['總金額']) || 0,
      price_per_card: parseFloat(row['每張價格']) || 0,
      status: String(row['狀態'] || '').trim() || '已提交',
      timestamp: parseDate(row['訂單時間'])
    };
  }).filter(o => o.order_id);
  
  console.log(`準備插入 ${orders.length} 筆 PSA 訂單`);
  
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    const { error } = await supabase
      .from('psa_orders')
      .upsert(batch, { onConflict: 'order_id' });
    
    if (error) {
      console.error(`❌ 插入 PSA 訂單失敗:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`✅ 已插入 ${inserted}/${orders.length} 筆 PSA 訂單`);
    }
  }
  
  console.log('');
  return inserted;
}

/**
 * 11. 遷移訂單歷史 (order_history)
 * CSV: 訂單歷史紀錄.csv
 */
async function migrateOrderHistory(historyData) {
  console.log('📌 [11/11] 遷移訂單歷史記錄...');
  
  const history = historyData.map(row => {
    const buyer = String(row['訂購人'] || '').trim();
    const userId = userMap.get(normalizeKey(buyer)) || null;
    
    return {
      user_id: userId,
      action: 'order_created',
      order_type: 'order',
      item: String(row['品項'] || '').trim(),
      amount: parseFloat(row['張數']) || 0,
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
    
    const stats = {};
    
    // 讀取所有 CSV
    console.log('📂 讀取 CSV 檔案...\n');
    const [
      users,
      products,
      orders,
      breaks,
      shipments,
      credits,
      lottery,
      ecpay,
      psaOrders,
      history
    ] = await Promise.all([
      readCSV('客戶資料.csv'),
      readCSV('下單商品.csv'),
      readCSV('Topps_Now_訂購總表.csv'),
      readCSV('團拆紀錄.csv'),
      readCSV('出貨紀錄.csv'),
      readCSV('團拆金.csv'),
      readCSV('每日抽籤紀錄.csv'),
      readCSV('綠界付款記錄.csv'),
      readCSV('主訂單.csv'),
      readCSV('訂單歷史紀錄.csv')
    ]);
    
    console.log('\n========================================');
    console.log('開始遷移資料...');
    console.log('========================================\n');
    
    // 1. 先遷移用戶 (必須第一個)
    if (!process.env.SKIP_USERS && users.length > 0) {
      stats.users = await migrateUsers(users);
    } else {
      console.log('⏭️  跳過用戶遷移\n');
      await loadUserMap(); // 但要載入現有用戶對應表
    }
    
    // 2. 遷移商品
    if (!process.env.SKIP_PRODUCTS && products.length > 0) {
      stats.products = await migrateProducts(products);
    } else {
      console.log('⏭️  跳過商品遷移\n');
    }
    
    // 3. 遷移訂單
    if (!process.env.SKIP_ORDERS && orders.length > 0) {
      stats.orders = await migrateOrders(orders);
    } else {
      console.log('⏭️  跳過訂單遷移\n');
    }
    
    // 4. 遷移團拆
    if (!process.env.SKIP_BREAKS && breaks.length > 0) {
      stats.breaks = await migrateBreaks(breaks);
    } else {
      console.log('⏭️  跳過團拆遷移\n');
    }
    
    // 5. 遷移出貨記錄
    if (!process.env.SKIP_SHIPMENTS && shipments.length > 0) {
      stats.shipments = await migrateShipments(shipments);
    } else {
      console.log('⏭️  跳過出貨記錄遷移\n');
    }
    
    // 6. 遷移團拆金
    if (!process.env.SKIP_CREDITS && credits.length > 0) {
      stats.credits = await migrateBreakCredits(credits);
    } else {
      console.log('⏭️  跳過團拆金遷移\n');
    }
    
    // 7. 付款通知 (暫無 CSV)
    if (!process.env.SKIP_NOTIFICATIONS) {
      stats.notifications = await migrateNotifications();
    }
    
    // 8. 遷移每日抽籤
    if (!process.env.SKIP_LOTTERY && lottery.length > 0) {
      stats.lottery = await migrateLottery(lottery);
    } else {
      console.log('⏭️  跳過抽籤記錄遷移\n');
    }
    
    // 9. 遷移綠界記錄
    if (!process.env.SKIP_ECPAY && ecpay.length > 0) {
      stats.ecpay = await migrateEcpayRecords(ecpay);
    } else {
      console.log('⏭️  跳過綠界記錄遷移\n');
    }
    
    // 10. 遷移 PSA 訂單
    if (!process.env.SKIP_PSA && psaOrders.length > 0) {
      stats.psa = await migratePsaOrders(psaOrders);
    } else {
      console.log('⏭️  跳過 PSA 訂單遷移\n');
    }
    
    // 11. 遷移訂單歷史
    if (!process.env.SKIP_HISTORY && history.length > 0) {
      stats.history = await migrateOrderHistory(history);
    } else {
      console.log('⏭️  跳過訂單歷史遷移\n');
    }
    
    // 顯示統計
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                  ✅ 遷移完成統計                       ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    if (stats.users !== undefined) console.log(`📊 [1] 用戶資料:       ${stats.users} 筆`);
    if (stats.products !== undefined) console.log(`📦 [2] 商品資料:       ${stats.products} 筆`);
    if (stats.orders !== undefined) console.log(`📋 [3] 訂單資料:       ${stats.orders} 筆`);
    if (stats.breaks !== undefined) console.log(`🎯 [4] 團拆記錄:       ${stats.breaks} 筆`);
    if (stats.shipments !== undefined) console.log(`📮 [5] 出貨記錄:       ${stats.shipments} 筆`);
    if (stats.credits !== undefined) console.log(`💰 [6] 團拆金:         ${stats.credits} 筆`);
    if (stats.notifications !== undefined) console.log(`🔔 [7] 付款通知:       ${stats.notifications} 筆`);
    if (stats.lottery !== undefined) console.log(`🎲 [8] 抽籤記錄:       ${stats.lottery} 筆`);
    if (stats.ecpay !== undefined) console.log(`💳 [9] 綠界記錄:       ${stats.ecpay} 筆`);
    if (stats.psa !== undefined) console.log(`📜 [10] PSA 訂單:      ${stats.psa} 筆`);
    if (stats.history !== undefined) console.log(`📚 [11] 訂單歷史:      ${stats.history} 筆`);
    console.log('');
    console.log(`💡 用戶對應表:      ${userMap.size} 個 phone/nickname → user_id`);
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  🎉 完整資料遷移完成！                                ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n❌ 遷移過程發生錯誤:');
    console.error(error);
    process.exit(1);
  }
}

main();
