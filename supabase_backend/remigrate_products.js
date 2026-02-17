/**
 * 重新遷移商品資料
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

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

async function main() {
  console.log('🔄 重新遷移商品資料...\n');
  
  // 1. 刪除現有商品
  console.log('🗑️  清空現有商品資料...');
  const { error: deleteError } = await supabase
    .from('product_catalog')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // 刪除所有記錄
  
  if (deleteError) {
    console.error('❌ 刪除失敗:', deleteError.message);
    process.exit(1);
  }
  console.log('✅ 已清空');
  
  // 2. 從 GAS 取得商品資料
  console.log('\n📡 從 GAS 取得商品資料...');
  const data = await callGAS('exportAllProducts');
  const products = data.products || [];
  
  console.log(`📊 取得 ${products.length} 個商品`);
  
  if (products.length === 0) {
    console.log('⚠️  無商品資料');
    return;
  }
  
  // 顯示第一筆商品的欄位
  console.log('\n第一筆商品欄位:', Object.keys(products[0]));
  console.log('第一筆商品資料:', JSON.stringify(products[0], null, 2));
  
  // 3. 插入商品
  console.log('\n📝 開始插入商品...');
  let success = 0;
  let failed = 0;
  
  for (const product of products) {
    try {
      const { error } = await supabase
        .from('product_catalog')
        .insert({
          item_name: product.itemName,
          card_no: product.cardNo,
          price: product.price,
          threshold_price: product.thresholdPrice,
          discount_threshold: product.discountThreshold,
          min_group_quantity: product.minGroupQuantity,
          can_draw_sp: product.canDrawSP,
          can_draw_signature: product.canDrawSignature,
          can_draw_relic: product.canDrawRelic,
          can_draw_auto_relic: product.canDrawAutoRelic,
          is_available: product.isAvailable,
          image_url_1: product.imageUrl1,
          image_url_2: product.imageUrl2,
          image_url_3: product.imageUrl3,
          image_url_4: product.imageUrl4,
          stock_status: product.stockStatus,
          is_box_preorder: product.isBoxPreorder,
          can_direct_order: product.canDirectOrder,
          remaining_stock: product.remainingStock,
          description: product.description,
          ordered_quantity: product.orderedQuantity,
          scheduled_list_time: product.scheduledListTime,
          scheduled_delist_time: product.scheduledDelistTime,
          is_arrival_notified: product.isArrivalNotified,
          category: product.category
        });
      
      if (error) throw error;
      
      success++;
      if (success % 10 === 0) {
        process.stdout.write(`  進度: ${success}/${products.length}\r`);
      }
      
    } catch (error) {
      console.error(`\n  ✗ 商品失敗: ${product.itemName}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n✅ 商品遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

main().catch(console.error);
