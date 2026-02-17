/**
 * 資料遷移腳本 - 從 Google Sheets 匯入 Supabase
 * 
 * 使用方法：
 * 1. 安裝依賴：npm install @supabase/supabase-js
 * 2. 設定環境變數：SUPABASE_URL, SUPABASE_KEY, GAS_URL
 * 3. 執行：node data_migration.js
 */

import { createClient } from '@supabase/supabase-js';

// Supabase 設定
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// GAS API URL
const GAS_URL = process.env.GAS_URL || 'YOUR_GAS_URL';

/**
 * 從 GAS 獲取所有用戶資料
 */
async function fetchUsersFromGAS() {
  console.log('📥 正在從 GAS 獲取用戶資料...');
  
  // 這裡需要實作一個 GAS 端點返回所有用戶
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAllUsers' })
  });
  
  const data = await response.json();
  console.log(`✅ 獲取到 ${data.users?.length || 0} 個用戶`);
  return data.users || [];
}

/**
 * 從 GAS 獲取訂單資料
 */
async function fetchOrdersFromGAS() {
  console.log('📥 正在從 GAS 獲取訂單資料...');
  
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAllOrders' })
  });
  
  const data = await response.json();
  console.log(`✅ 獲取到 ${data.orders?.length || 0} 筆訂單`);
  return data.orders || [];
}

/**
 * 從 GAS 獲取團拆資料
 */
async function fetchBreaksFromGAS() {
  console.log('📥 正在從 GAS 獲取團拆資料...');
  
  const response = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getAllBreaks' })
  });
  
  const data = await response.json();
  console.log(`✅ 獲取到 ${data.breaks?.length || 0} 筆團拆`);
  return data.breaks || [];
}

/**
 * 遷移用戶資料到 Supabase
 */
async function migrateUsers(users) {
  console.log('🔄 正在遷移用戶資料...');
  
  const userMap = new Map(); // 用於保存 phone -> UUID 對應關係
  
  for (const user of users) {
    const { data, error } = await supabase
      .from('users')
      .upsert({
        phone: user.phone,
        nickname: user.nickname,
        birthday: user.birthday,
        email: user.email,
        address: user.address,
        real_name: user.realName
      }, { onConflict: 'phone' })
      .select()
      .single();
    
    if (error) {
      console.error(`❌ 用戶 ${user.nickname} 遷移失敗:`, error);
    } else {
      userMap.set(user.phone, data.id);
      console.log(`✅ 用戶 ${user.nickname} 遷移成功`);
    }
  }
  
  return userMap;
}

/**
 * 遷移訂單資料到 Supabase
 */
async function migrateOrders(orders, userMap) {
  console.log('🔄 正在遷移訂單資料...');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const order of orders) {
    const userId = userMap.get(order.phone);
    
    if (!userId) {
      console.warn(`⚠️  找不到用戶 (phone: ${order.phone}), 跳過訂單`);
      failCount++;
      continue;
    }
    
    const { error } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        timestamp: new Date(order.timestamp),
        item: order.item,
        card_no: order.cardNo,
        quantity: order.quantity || 1,
        total_fee: order.totalFee,
        paid: order.paid || 0,
        status: order.status,
        payment_method: order.paymentMethod,
        is_notified: order.isNotified === 'Y',
        is_cleared: order.isCleared === 'Y',
        remark: order.remark
      });
    
    if (error) {
      console.error(`❌ 訂單遷移失敗:`, error);
      failCount++;
    } else {
      successCount++;
    }
  }
  
  console.log(`✅ 訂單遷移完成: 成功 ${successCount} 筆, 失敗 ${failCount} 筆`);
}

/**
 * 遷移團拆資料到 Supabase
 */
async function migrateBreaks(breaks, userMap) {
  console.log('🔄 正在遷移團拆資料...');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const breakItem of breaks) {
    const userId = userMap.get(breakItem.phone);
    
    if (!userId) {
      console.warn(`⚠️  找不到用戶 (phone: ${breakItem.phone}), 跳過團拆`);
      failCount++;
      continue;
    }
    
    const { error } = await supabase
      .from('breaks')
      .insert({
        user_id: userId,
        break_id: breakItem.breakId,
        name: breakItem.name,
        category: breakItem.category,
        format: breakItem.format,
        item: breakItem.item,
        total_fee: breakItem.totalFee,
        paid: breakItem.paid || 0,
        status: breakItem.status,
        is_opened: breakItem.isOpened === 'Y',
        is_shipped: breakItem.isShipped === 'Y',
        is_cleared: breakItem.isCleared === 'Y',
        payment_method: breakItem.paymentMethod,
        remark: breakItem.remark
      });
    
    if (error) {
      console.error(`❌ 團拆遷移失敗:`, error);
      failCount++;
    } else {
      successCount++;
    }
  }
  
  console.log(`✅ 團拆遷移完成: 成功 ${successCount} 筆, 失敗 ${failCount} 筆`);
}

/**
 * 主執行函數
 */
async function main() {
  console.log('🚀 開始資料遷移...\n');
  
  try {
    // 1. 遷移用戶
    const users = await fetchUsersFromGAS();
    const userMap = await migrateUsers(users);
    console.log('\n');
    
    // 2. 遷移訂單
    const orders = await fetchOrdersFromGAS();
    await migrateOrders(orders, userMap);
    console.log('\n');
    
    // 3. 遷移團拆
    const breaks = await fetchBreaksFromGAS();
    await migrateBreaks(breaks, userMap);
    console.log('\n');
    
    console.log('🎉 資料遷移完成！');
    
  } catch (error) {
    console.error('❌ 遷移過程發生錯誤:', error);
    process.exit(1);
  }
}

// 執行遷移
main();
