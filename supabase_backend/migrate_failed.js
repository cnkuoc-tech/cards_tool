/**
 * 重新遷移失敗的資料
 * 執行前請先在 Supabase Dashboard 執行 fix_remaining_issues.sql
 * 
 * 使用方法：node migrate_failed.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * 從 GAS 呼叫 API
 */
async function callGAS(action) {
  console.log(`📡 呼叫 GAS: ${action}`);
  
  const response = await fetch(process.env.GAS_EXPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(`GAS API 錯誤: ${data.message}`);
  }

  return data;
}

/**
 * 根據暱稱查找用戶（不區分大小寫）
 */
async function findUserByNickname(nickname) {
  if (!nickname) return null;
  
  const { data } = await supabase
    .from('users')
    .select('id, phone, nickname')
    .ilike('nickname', nickname)
    .limit(1);
  
  return data && data.length > 0 ? data[0] : null;
}

/**
 * 根據電話查找用戶
 */
async function findUserByPhone(phone) {
  if (!phone) return null;
  
  const { data } = await supabase
    .from('users')
    .select('id, phone, nickname')
    .eq('phone', phone)
    .limit(1);
  
  return data && data.length > 0 ? data[0] : null;
}

/**
 * 建立用戶快取
 */
async function buildUserCache() {
  console.log('🔄 建立用戶快取...');
  const { data: users } = await supabase
    .from('users')
    .select('id, phone, nickname');
  
  const userMap = new Map();
  for (const user of users || []) {
    if (user.phone) userMap.set(user.phone, user.id);
    if (user.nickname) userMap.set(user.nickname.toLowerCase(), user.id);
  }
  
  console.log(`✅ 快取了 ${users?.length || 0} 個用戶`);
  return userMap;
}

/**
 * 重新遷移訂單（只遷移失敗的）
 */
async function retryOrders(userMap) {
  console.log('\n🚀 重新遷移失敗的訂單...');
  
  const data = await callGAS('exportAllOrders');
  const orders = data.orders || [];
  
  console.log(`📊 取得 ${orders.length} 筆訂單`);
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const order of orders) {
    try {
      // 檢查是否已存在
      const { data: existing } = await supabase
        .from('orders')
        .select('id')
        .eq('item', order.itemName)
        .eq('timestamp', order.orderDate)
        .limit(1);
      
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
      
      // 查找用戶
      let userId = userMap.get(order.phone);
      
      if (!userId && order.nickname) {
        userId = userMap.get(order.nickname.toLowerCase());
        
        if (!userId) {
          const user = await findUserByNickname(order.nickname);
          if (user) {
            userId = user.id;
            userMap.set(order.nickname.toLowerCase(), userId);
          }
        }
      }
      
      if (!userId) {
        console.warn(`  ⚠️  找不到用戶: ${order.nickname} (${order.phone})`);
        failed++;
        continue;
      }
      
      const { error } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          timestamp: order.orderDate,
          item: order.itemName,
          card_no: order.cardNo,
          unit_price: order.unitPrice,
          quantity: order.quantity,
          total_fee: order.totalFee,
          deposit: order.deposit,
          balance_amount: order.balance,
          is_invoiced: order.isNotified,
          is_shipped: order.isShipped,
          is_cleared: order.isCleared,
          status: order.status,
          arrival_status: order.arrivalStatus,
          payment_method: order.paymentMethod,
          merchant_trade_no: order.merchantTradeNo,
          payment_date: order.paymentDate,
          notes: order.notes
        });
      
      if (error) throw error;
      success++;
      
      if (success % 50 === 0) {
        console.log(`  ✓ 已完成 ${success} 筆`);
      }
      
    } catch (error) {
      console.error(`  ✗ 失敗: ${order.nickname} - ${order.itemName}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 訂單重新遷移完成: 成功 ${success}, 跳過 ${skipped}, 失敗 ${failed}`);
}

/**
 * 重新遷移團拆（只遷移失敗的）
 */
async function retryBreaks(userMap) {
  console.log('\n🚀 重新遷移失敗的團拆...');
  
  const data = await callGAS('exportAllBreaks');
  const breaks = data.breaks || [];
  
  console.log(`📊 取得 ${breaks.length} 筆團拆`);
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const breakItem of breaks) {
    try {
      // 檢查是否已存在
      const { data: existing } = await supabase
        .from('breaks')
        .select('id')
        .eq('break_id', breakItem.breakId)
        .limit(1);
      
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
      
      // 查找用戶
      let userId = userMap.get(breakItem.nickname.toLowerCase());
      
      if (!userId) {
        const user = await findUserByNickname(breakItem.nickname);
        if (user) {
          userId = user.id;
          userMap.set(breakItem.nickname.toLowerCase(), userId);
        }
      }
      
      if (!userId) {
        console.warn(`  ⚠️  找不到用戶: ${breakItem.nickname}`);
        failed++;
        continue;
      }
      
      const { error } = await supabase
        .from('breaks')
        .insert({
          user_id: userId,
          break_id: breakItem.breakId,
          category: breakItem.category,
          break_name: breakItem.breakName,
          format: breakItem.format,
          item: breakItem.itemName,
          total_fee: breakItem.totalFee,
          paid: breakItem.paid,
          is_opened: breakItem.isOpened,
          is_shipped: breakItem.isShipped,
          status: breakItem.status,
          payment_method: breakItem.paymentMethod,
          merchant_trade_no: breakItem.merchantTradeNo,
          payment_date: breakItem.paymentDate
        });
      
      if (error) throw error;
      success++;
      
      if (success % 50 === 0) {
        console.log(`  ✓ 已完成 ${success} 筆`);
      }
      
    } catch (error) {
      console.error(`  ✗ 失敗: ${breakItem.nickname} - ${breakItem.breakId}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 團拆重新遷移完成: 成功 ${success}, 跳過 ${skipped}, 失敗 ${failed}`);
}

/**
 * 重新遷移團拆金
 */
async function retryBreakCredits(userMap) {
  console.log('\n🚀 重新遷移團拆金...');
  
  const data = await callGAS('exportAllBreakCredits');
  const credits = data.breakCredits || [];
  
  console.log(`📊 取得 ${credits.length} 筆團拆金`);
  
  if (credits.length === 0) {
    console.log('⚠️  無團拆金資料');
    return;
  }
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const credit of credits) {
    try {
      // 查找用戶
      let userId = userMap.get(credit.nickname.toLowerCase());
      
      if (!userId) {
        const user = await findUserByNickname(credit.nickname);
        if (user) {
          userId = user.id;
          userMap.set(credit.nickname.toLowerCase(), userId);
        }
      }
      
      if (!userId) {
        console.warn(`  ⚠️  找不到用戶: ${credit.nickname}`);
        failed++;
        continue;
      }
      
      // 檢查是否已存在
      const { data: existing } = await supabase
        .from('break_credits')
        .select('id')
        .eq('user_id', userId)
        .eq('amount', credit.amount)
        .limit(1);
      
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
      
      const { error } = await supabase
        .from('break_credits')
        .insert({
          user_id: userId,
          amount: credit.amount,
          source: credit.source,
          is_used: credit.isUsed,
          used_break_ids: credit.usedBreakIds,
          used_amount: credit.usedAmount
        });
      
      if (error) throw error;
      success++;
      
    } catch (error) {
      console.error(`  ✗ 失敗: ${credit.nickname}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 團拆金遷移完成: 成功 ${success}, 跳過 ${skipped}, 失敗 ${failed}`);
}

/**
 * 重新遷移付款記錄
 */
async function retryPayments(userMap) {
  console.log('\n🚀 重新遷移付款記錄...');
  
  const data = await callGAS('exportAllPayments');
  const payments = data.payments || [];
  
  console.log(`📊 取得 ${payments.length} 筆付款記錄`);
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const payment of payments) {
    try {
      // 檢查是否已存在
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('merchant_trade_no', payment.merchantTradeNo || payment.paymentNo)
        .limit(1);
      
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
      
      // 查找用戶
      let userId = userMap.get(payment.phone);
      
      if (!userId && payment.nickname) {
        userId = userMap.get(payment.nickname.toLowerCase());
        
        if (!userId) {
          const user = await findUserByNickname(payment.nickname);
          if (user) {
            userId = user.id;
            userMap.set(payment.nickname.toLowerCase(), userId);
          }
        }
      }
      
      if (!userId) {
        console.warn(`  ⚠️  找不到用戶: ${payment.nickname} (${payment.phone})`);
        failed++;
        continue;
      }
      
      const { error } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          payment_no: payment.merchantTradeNo || payment.paymentNo,
          merchant_trade_no: payment.merchantTradeNo || payment.paymentNo || payment.orderNo,
          order_no: payment.orderNo,
          amount: payment.tradeAmt || null,
          product_name: (payment.productName || '').substring(0, 500),
          status: payment.status,
          payment_type: payment.paymentType,
          payment_date: payment.paymentDate,
          trade_no: payment.tradeNo,
          rtn_msg: payment.rtnMsg,
          order_details: payment.orderDetails,
          created_at: payment.createdAt
        });
      
      if (error) throw error;
      success++;
      
      if (success % 50 === 0) {
        console.log(`  ✓ 已完成 ${success} 筆`);
      }
      
    } catch (error) {
      console.error(`  ✗ 失敗: ${payment.orderNo}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 付款記錄遷移完成: 成功 ${success}, 跳過 ${skipped}, 失敗 ${failed}`);
}

/**
 * 主程序
 */
async function main() {
  const startTime = Date.now();
  
  console.log('╔══════════════════════════════════════╗');
  console.log('║   重新遷移失敗的資料              ║');
  console.log('╚══════════════════════════════════════╝\n');
  
  try {
    // 建立用戶快取
    const userMap = await buildUserCache();
    
    // 重新遷移各項資料
    await retryOrders(userMap);
    await retryBreaks(userMap);
    await retryBreakCredits(userMap);
    await retryPayments(userMap);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║        🎉 重新遷移完成！           ║');
    console.log(`║        耗時: ${elapsed} 秒`);
    console.log('╚══════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n❌ 遷移失敗:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
