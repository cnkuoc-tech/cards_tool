/**
 * 重新遷移失敗的付款記錄
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const GAS_URL = process.env.GAS_EXPORT_URL;

// 呼叫 GAS API
async function callGAS(action) {
  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || '未知錯誤');
    }
    
    return result;
  } catch (error) {
    console.error(`❌ 呼叫 GAS 失敗 (${action}):`, error.message);
    throw error;
  }
}

// 不區分大小寫查找用戶
async function findUserByNickname(nickname) {
  const { data } = await supabase
    .from('users')
    .select('id, phone, nickname')
    .ilike('nickname', nickname)
    .limit(1);
  
  return data && data.length > 0 ? data[0] : null;
}

async function findUserByPhone(phone) {
  const { data } = await supabase
    .from('users')
    .select('id, phone, nickname')
    .eq('phone', phone)
    .limit(1);
  
  return data && data.length > 0 ? data[0] : null;
}

// 遷移付款記錄
async function migratePayments() {
  console.log('🚀 重新遷移付款記錄...\n');
  
  const result = await callGAS('exportAllPayments');
  const payments = result.payments || [];
  
  console.log(`📊 取得 ${payments.length} 筆付款記錄\n`);
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const payment of payments) {
    try {
      // 檢查是否已存在
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('merchant_trade_no', payment.merchantTradeNo)
        .limit(1);
      
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
      
      // 查找用戶
      let userId = null;
      
      if (payment.phone) {
        const user = await findUserByPhone(payment.phone);
        if (user) userId = user.id;
      }
      
      if (!userId && payment.nickname) {
        const user = await findUserByNickname(payment.nickname);
        if (user) userId = user.id;
      }
      
      // 準備資料 - 截斷 product_name 到 900 字元（保險起見）
      const paymentData = {
        user_id: userId,
        merchant_trade_no: payment.merchantTradeNo || null,
        trade_no: payment.tradeNo || null,
        payment_date: payment.paymentDate || null,
        payment_type: payment.paymentType || null,
        amount: payment.tradeAmt || null,
        product_name: payment.productName ? payment.productName.substring(0, 900) : null,
        status: payment.status || null,
        rtn_msg: payment.rtnMsg || null,
        created_at: payment.createdAt || new Date().toISOString()
      };
      
      const { error } = await supabase
        .from('payments')
        .insert([paymentData]);
      
      if (error) {
        console.log(`  ✗ 失敗: ${payment.productName?.substring(0, 80)}`);
        console.log(`    錯誤: ${error.message}\n`);
        failed++;
      } else {
        success++;
        if (success % 10 === 0) {
          console.log(`  ✓ 已完成 ${success} 筆`);
        }
      }
      
    } catch (err) {
      console.log(`  ✗ 失敗: ${payment.productName?.substring(0, 80)}`);
      console.log(`    錯誤: ${err.message}\n`);
      failed++;
    }
  }
  
  console.log(`\n✅ 付款記錄遷移完成: 成功 ${success}, 跳過 ${skipped}, 失敗 ${failed}\n`);
}

// 主函數
async function main() {
  const startTime = Date.now();
  
  console.log('╔══════════════════════════════════════╗');
  console.log('║   重新遷移付款記錄                ║');
  console.log('╚══════════════════════════════════════╝\n');
  
  try {
    await migratePayments();
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('╔══════════════════════════════════════╗');
    console.log('║        🎉 遷移完成！              ║');
    console.log(`║        耗時: ${elapsed} 秒`);
    console.log('╚══════════════════════════════════════╝');
  } catch (error) {
    console.error('❌ 遷移過程發生錯誤:', error);
    process.exit(1);
  }
}

main();
