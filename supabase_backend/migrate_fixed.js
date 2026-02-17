/**
 * 修正版資料遷移腳本 - 從 GAS 導出並匯入 Supabase
 * 
 * 修正內容：
 * 1. 正確的資料表名稱（order_entries, break_records, payment_notifications）
 * 2. 正確的欄位對應（依照 export_data_production_fixed.gs）
 * 3. 處理 user_id 為 null 的情況（保留 phone 和 nickname）
 * 
 * 使用方法：
 * 1. cd supabase_backend
 * 2. npm install
 * 3. node migrate_fixed.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// 檢查環境變數
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GAS_EXPORT_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ 缺少環境變數: ${envVar}`);
    console.error('請在 .env 檔案中設定：');
    console.error('SUPABASE_URL=https://你的專案.supabase.co');
    console.error('SUPABASE_ANON_KEY=你的anon key');
    console.error('GAS_EXPORT_URL=https://script.google.com/macros/s/.../exec');
    process.exit(1);
  }
}

// 建立 Supabase 客戶端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * 從 GAS 呼叫 API
 */
async function callGAS(action) {
  console.log(`📡 呼叫 GAS: ${action}`);
  
  try {
    const url = process.env.GAS_EXPORT_URL + '?action=' + action;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(`GAS API 錯誤: ${data.message}`);
    }

    return data;
  } catch (error) {
    console.error(`❌ GAS API 呼叫失敗: ${error.message}`);
    throw error;
  }
}

/**
 * 步驟 1: 遷移用戶
 */
async function migrateUsers() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 步驟 1: 遷移用戶資料');
  console.log('='.repeat(60));
  
  const data = await callGAS('exportAllUsers');
  const users = data.users || [];
  
  console.log(`📊 從 GAS 取得 ${users.length} 個用戶`);
  
  if (users.length === 0) {
    console.log('⚠️  無用戶資料，跳過');
    return new Map();
  }
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  const userMap = new Map(); // phone -> user_id
  
  for (const user of users) {
    try {
      // 檢查是否已存在
      const { data: existing } = await supabase
        .from('users')
        .select('id, phone')
        .eq('phone', user.phone)
        .single();
      
      if (existing) {
        console.log(`  ⏭️  用戶已存在: ${user.nickname} (${user.phone})`);
        userMap.set(user.phone, existing.id);
        skipped++;
        continue;
      }
      
      const { data: inserted, error } = await supabase
        .from('users')
        .insert({
          phone: user.phone,
          nickname: user.nickname,
          birthday: user.birthday,
          email: user.email || null,
          address: user.address || null,
          real_name: user.realName || null,
          password: user.password || user.birthday
        })
        .select()
        .single();
      
      if (error) throw error;
      
      userMap.set(user.phone, inserted.id);
      success++;
      
      if (success % 20 === 0) {
        console.log(`  ✓ 已完成 ${success}/${users.length}`);
      }
      
    } catch (error) {
      console.error(`  ✗ 用戶失敗: ${user.nickname} (${user.phone})`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 用戶遷移完成: 成功 ${success}, 跳過 ${skipped}, 失敗 ${failed}`);
  console.log(`📋 建立用戶對應表: ${userMap.size} 筆`);
  
  return userMap;
}

/**
 * 步驟 2: 遷移訂單
 */
async function migrateOrders(userMap) {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 步驟 2: 遷移訂單資料');
  console.log('='.repeat(60));
  
  const data = await callGAS('exportAllOrders');
  const orders = data.orders || [];
  
  console.log(`📊 從 GAS 取得 ${orders.length} 筆訂單`);
  
  if (orders.length === 0) {
    console.log('⚠️  無訂單資料，跳過');
    return;
  }
  
  let success = 0;
  let failed = 0;
  let noUser = 0;
  
  for (const order of orders) {
    try {
      // 嘗試查找用戶 ID
      const userId = userMap.get(order.phone) || null;
      
      if (!userId && order.phone) {
        // 嘗試直接查詢
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('phone', order.phone)
          .single();
        
        if (user) {
          userMap.set(order.phone, user.id);
        }
      }
      
      // 插入訂單（即使沒有 user_id 也插入，保留 phone 和 nickname）
      const { error } = await supabase
        .from('orders')
        .insert({
          user_id: userMap.get(order.phone) || null,
          phone: order.phone,
          nickname: order.nickname,
          item_name: order.itemName,
          card_no: order.cardNo,
          quantity: order.quantity,
          unit_price: order.unitPrice,
          total_fee: order.totalFee,
          deposit: order.deposit,
          balance: order.balance,
          is_notified: String(order.isNotified),
          is_shipped: String(order.isShipped),
          is_cleared: String(order.isCleared),
          status: order.status,
          arrival_status: order.arrivalStatus,
          order_date: order.orderDate,
          payment_method: order.paymentMethod,
          merchant_trade_no: order.merchantTradeNo,
          payment_date: order.paymentDate,
          notes: order.notes
        });
      
      if (error) throw error;
      
      if (!userMap.get(order.phone)) {
        noUser++;
      }
      
      success++;
      
      if (success % 100 === 0) {
        console.log(`  ✓ 已完成 ${success}/${orders.length}`);
      }
      
    } catch (error) {
      console.error(`  ✗ 訂單失敗: ${order.itemName} - ${order.nickname}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 訂單遷移完成: 成功 ${success}, 失敗 ${failed}`);
  console.log(`⚠️  其中 ${noUser} 筆訂單沒有對應的 user_id（保留了 phone 和 nickname）`);
}

/**
 * 步驟 3: 遷移團拆記錄
 */
async function migrateBreaks(userMap) {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 步驟 3: 遷移團拆記錄');
  console.log('='.repeat(60));
  
  const data = await callGAS('exportAllBreaks');
  const breaks = data.breaks || [];
  
  console.log(`📊 從 GAS 取得 ${breaks.length} 筆團拆記錄`);
  
  if (breaks.length === 0) {
    console.log('⚠️  無團拆資料，跳過');
    return;
  }
  
  let success = 0;
  let failed = 0;
  
  for (const breakRecord of breaks) {
    try {
      const userId = userMap.get(breakRecord.phone) || null;
      
      const { error } = await supabase
        .from('breaks')
        .insert({
          user_id: userId,
          phone: breakRecord.phone,
          nickname: breakRecord.nickname,
          break_name: breakRecord.breakName,
          break_date: breakRecord.breakDate,
          total_participants: breakRecord.totalParticipants,
          user_share: breakRecord.userShare,
          notes: breakRecord.notes
        });
      
      if (error) throw error;
      
      success++;
      
      if (success % 50 === 0) {
        console.log(`  ✓ 已完成 ${success}/${breaks.length}`);
      }
      
    } catch (error) {
      console.error(`  ✗ 團拆失敗: ${breakRecord.breakName}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 團拆遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 步驟 4: 遷移商品
 */
async function migrateProducts() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 步驟 4: 遷移商品資料');
  console.log('='.repeat(60));
  
  const data = await callGAS('exportAllProducts');
  const products = data.products || [];
  
  console.log(`📊 從 GAS 取得 ${products.length} 筆商品`);
  
  if (products.length === 0) {
    console.log('⚠️  無商品資料，跳過');
    return;
  }
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const product of products) {
    try {
      // 檢查是否已存在
      const { data: existing } = await supabase
        .from('product_catalog')
        .select('id')
        .eq('item_name', product.itemName)
        .eq('card_no', product.cardNo)
        .single();
      
      if (existing) {
        skipped++;
        continue;
      }
      
      const { error } = await supabase
        .from('product_catalog')
        .insert({
          item_name: product.itemName,
          card_no: product.cardNo,
          price: product.price,
          threshold_price: product.thresholdPrice,
          discount_threshold: product.discountThreshold,
          min_group_quantity: product.minGroupQuantity,
          can_draw_sp: String(product.canDrawSP),
          can_draw_signature: String(product.canDrawSignature),
          can_draw_relic: String(product.canDrawRelic),
          can_draw_auto_relic: String(product.canDrawAutoRelic),
          is_available: product.isAvailable,
          image_url_1: product.imageUrl1,
          image_url_2: product.imageUrl2,
          image_url_3: product.imageUrl3,
          image_url_4: product.imageUrl4,
          stock_status: product.stockStatus,
          remaining_stock: product.remainingStock,
          total_quantity: product.totalQuantity || 0,
          current_quantity: product.currentQuantity || 0,
          is_box_preorder: String(product.isBoxPreorder),
          can_direct_order: String(product.canDirectOrder),
          category: product.category,
          close_time: product.closeTime
        });
      
      if (error) throw error;
      
      success++;
      
      if (success % 50 === 0) {
        console.log(`  ✓ 已完成 ${success}/${products.length}`);
      }
      
    } catch (error) {
      console.error(`  ✗ 商品失敗: ${product.itemName}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 商品遷移完成: 成功 ${success}, 跳過 ${skipped}, 失敗 ${failed}`);
}

/**
 * 步驟 5: 遷移付款通知
 */
async function migratePayments() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 步驟 5: 遷移付款通知');
  console.log('='.repeat(60));
  
  const data = await callGAS('exportAllPayments');
  const payments = data.payments || [];
  
  console.log(`📊 從 GAS 取得 ${payments.length} 筆付款通知`);
  
  if (payments.length === 0) {
    console.log('⚠️  無付款通知資料，跳過');
    return;
  }
  
  let success = 0;
  let failed = 0;
  
  for (const payment of payments) {
    try {
      const { error } = await supabase
        .from('payments')
        .insert({
          phone: payment.phone,
          nickname: payment.nickname,
          payment_date: payment.paymentDate,
          payment_time: payment.paymentTime,
          amount: payment.amount,
          last_five_digits: payment.lastFiveDigits,
          account_number: payment.accountNumber,
          payment_method: payment.paymentMethod,
          merchant_trade_no: payment.merchantTradeNo,
          notes: payment.notes
        });
      
      if (error) throw error;
      
      success++;
      
      if (success % 50 === 0) {
        console.log(`  ✓ 已完成 ${success}/${payments.length}`);
      }
      
    } catch (error) {
      console.error(`  ✗ 付款通知失敗: ${payment.nickname}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 付款通知遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 主要執行函數
 */
async function main() {
  console.log('\n');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + '📦 Supabase 資料遷移腳本（修正版）' + ' '.repeat(11) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');
  
  const startTime = Date.now();
  
  try {
    // 測試 GAS 連線
    console.log('🔗 測試 GAS API 連線...');
    const testData = await callGAS('exportAllUsers');
    console.log(`✅ GAS API 正常，取得 ${testData.users?.length || 0} 筆用戶資料`);
    
    // 測試 Supabase 連線
    console.log('🔗 測試 Supabase 連線...');
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Supabase 連線正常');
    
    // 開始遷移
    const userMap = await migrateUsers();
    await migrateProducts();
    await migrateOrders(userMap);
    await migrateBreaks(userMap);
    await migratePayments();
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有資料遷移完成！');
    console.log(`⏱️  總耗時: ${elapsed} 秒`);
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ 遷移過程發生錯誤:');
    console.error(error);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// 執行
main();
