/**
 * 資料遷移腳本 - 從 GAS 導出並匯入 Supabase
 * 
 * 使用方法：
 * 1. 複製 .env.example 為 .env 並填入設定
 * 2. npm install
 * 3. npm run migrate
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// 檢查環境變數
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GAS_EXPORT_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ 缺少環境變數: ${envVar}`);
    console.error('請複製 .env.example 為 .env 並填入正確的值');
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
  
  return data;
}

/**
 * 步驟 1: 遷移用戶
 */
async function migrateUsers() {
  console.log('\n🚀 開始遷移用戶...');
  
  const data = await callGAS('exportAllUsers');
  const users = data.users || [];
  
  console.log(`📊 取得 ${users.length} 個用戶`);
  
  if (users.length === 0) {
    console.log('⚠️  無用戶資料');
    return new Map();
  }
  
  const userMap = new Map();
  let success = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      // 🔑 保留原始生日格式（MMDD），因為用於登入驗證
      const birthday = user.birthday ? String(user.birthday).trim() : null;
      
      const { data: insertedUser, error } = await supabase
        .from('users')
        .upsert({
          phone: user.phone,
          nickname: user.nickname,
          password: user.password,
          birthday: birthday,  // 保留原始格式（MMDD）
          email: user.email,
          address: user.address,
          real_name: user.realName
        }, { 
          onConflict: 'phone',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error) throw error;
      
      userMap.set(user.phone, insertedUser.id);
      success++;
      
      if (success % 50 === 0) {
        console.log(`  ✓ 已完成 ${success}/${users.length}`);
      }
      
    } catch (error) {
      console.error(`  ✗ 失敗: ${user.nickname} (${user.phone})`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 用戶遷移完成: 成功 ${success}, 失敗 ${failed}`);
  return userMap;
}

/**
 * 步驟 2: 遷移訂單
 */
async function migrateOrders(userMap) {
  console.log('\n🚀 開始遷移訂單...');
  
  const data = await callGAS('exportAllOrders');
  const orders = data.orders || [];
  
  console.log(`📊 取得 ${orders.length} 筆訂單`);
  
  if (orders.length === 0) {
    console.log('⚠️  無訂單資料');
    return;
  }
  
  
  let success = 0;
  let failed = 0;
  
  for (const order of orders) {
    try {
      // 優先用聯絡方式(手機)查找，若無則用暱稱查找
      let userId = userMap.get(order.phone);
      
      if (!userId && order.nickname) {
        // 用暱稱查找（不區分大小寫）
        const user = await findUserByNickname(order.nickname);
        if (user) {
          userId = user.id;
          userMap.set(order.nickname, userId); // 快取結果
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
          timestamp: order.timestamp,
          item: order.item,
          card_no: order.cardNo,
          unit_price: order.unitPrice,
          quantity: order.quantity,
          total_fee: order.totalFee,
          deposit: order.deposit,
          balance_amount: order.balance,
          is_invoiced: order.isInvoiced,
          is_shipped: order.isShipped,
          is_cleared: order.isCleared,
          status: order.status,
          arrival_status: order.arrivalStatus,
          image_url: order.imageUrl,
          box_order: order.boxOrder,
          payment_method: order.paymentMethod,
          merchant_trade_no: order.merchantTradeNo,
          payment_date: order.paymentDate,
          remark: order.remark
        });
      
      if (error) throw error;
      
      success++;
      
      if (success % 50 === 0) {
        console.log(`  ✓ 已完成 ${success}/${orders.length}`);
      }
      
    } catch (error) {
      console.error(`  ✗ 訂單失敗: ${order.item}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 訂單遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 步驟 3: 遷移團拆
 */
async function migrateBreaks(userMap) {
  console.log('\n🚀 開始遷移團拆...');
  
  const data = await callGAS('exportAllBreaks');
  const breaks = data.breaks || [];
  
  console.log(`📊 取得 ${breaks.length} 筆團拆`);
  
  if (breaks.length === 0) {
    console.log('⚠️  無團拆資料');
    return;
  }
  
  
  let success = 0;
  let failed = 0;
  
  for (const breakItem of breaks) {
    try {
      // 先用 nickname 查找用戶
      let userId = null;
      
      // 從 userMap 查找（key 是 phone）
      for (const [phone, id] of userMap) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('id', id)
          .eq('nickname', breakItem.nickname)
          .single();
        
        if (user) {
          userId = user.id;
          break;
        }
      }
      
      // 如果沒找到，嘗試直接用 nickname 查找（不區分大小寫）
      if (!userId) {
        const user = await findUserByNickname(breakItem.nickname);
        if (user) {
          userId = user.id;
          userMap.set(breakItem.nickname, userId); // 快取結果
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
          name: breakItem.name,
          category: breakItem.category,
          format: breakItem.format,
          item: breakItem.item,
          total_fee: breakItem.totalFee,
          paid: breakItem.paid,
          status: breakItem.status,
          is_opened: breakItem.isOpened === 'Y' || breakItem.isOpened === '是',
          is_shipped: breakItem.isShipped === 'Y' || breakItem.isShipped === '是',
          payment_method: breakItem.paymentMethod,
          merchant_trade_no: breakItem.merchantTradeNo,
          payment_date: breakItem.paymentDate
        });
      
      if (error) throw error;
      
      success++;
      
      if (success % 50 === 0) {
        console.log(`  ✓ 已完成 ${success}/${breaks.length}`);
      }
      
    } catch (error) {
      console.error(`  ✗ 團拆失敗: ${breakItem.breakId}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 團拆遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 步驟 4: 遷移團拆金
 */
async function migrateBreakCredits(userMap) {
  console.log('\n🚀 開始遷移團拆金...');
  
  const data = await callGAS('exportAllBreakCredits');
  const credits = data.credits || [];
  
  console.log(`📊 取得 ${credits.length} 筆團拆金`);
  
  if (credits.length === 0) {
    console.log('⚠️  無團拆金資料');
    return;
  }
  
  
  let success = 0;
  let failed = 0;
  
  for (const credit of credits) {
    try {
      // 從 nickname 找到 user_id（不區分大小寫）
      const user = await findUserByNickname(credit.nickname);
      
      if (!user) {
        console.warn(`  ⚠️  找不到用戶: ${credit.nickname}`);
        failed++;
        continue;
      }
      
      const { error } = await supabase
        .from('break_credits')
        .insert({
          user_id: user.id,
          amount: credit.amount,
          source: credit.source,
          is_used: credit.isUsed,
          used_break_ids: credit.usedBreakIds,
          used_amount: credit.usedAmount
        });
      
      if (error) throw error;
      
      success++;
      
    } catch (error) {
      console.error(`  ✗ 團拆金失敗: ${credit.nickname}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 團拆金遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 步驟 5: 遷移商品目錄
 */
async function migrateProducts() {
  console.log('\n🚀 開始遷移商品目錄...');
  
  const data = await callGAS('exportAllProducts');
  const products = data.products || [];
  
  console.log(`📊 取得 ${products.length} 個商品`);
  
  if (products.length === 0) {
    console.log('⚠️  無商品資料');
    return;
  }
  
  
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
      
    } catch (error) {
      console.error(`  ✗ 商品失敗: ${product.itemName}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 商品目錄遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 步驟 6: 遷移付款記錄
 */
async function migratePayments(userMap) {
  console.log('\n🚀 開始遷移付款記錄...');
  
  const data = await callGAS('exportAllPayments');
  const payments = data.payments || [];
  
  console.log(`📊 取得 ${payments.length} 筆付款記錄`);
  
  if (payments.length === 0) {
    console.log('⚠️  無付款記錄');
    return;
  }
  
  
  let success = 0;
  let failed = 0;
  
  for (const payment of payments) {
    try {
      // 先用 phone 查找用戶
      let userId = userMap.get(payment.phone);
      
      // 如果沒找到，嘗試用 nickname 查找（不區分大小寫）
      if (!userId && payment.nickname) {
        const user = await findUserByNickname(payment.nickname);
        if (user) {
          userId = user.id;
          userMap.set(payment.nickname, userId); // 快取結果
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
          payment_no: payment.paymentNo,
          merchant_trade_no: payment.merchantTradeNo || payment.paymentNo || payment.orderNo,
          order_no: payment.orderNo,
          amount: payment.tradeAmt || null,
          product_name: (payment.productName || '').substring(0, 500),
          status: payment.status,
          payment_type: payment.paymentType,
          trade_no: payment.tradeNo,
          return_message: payment.returnMessage,
          payment_date: payment.paymentDate,
          order_details: payment.orderDetails,
          created_at: payment.createdAt,
          updated_at: payment.updatedAt
        });
      
      if (error) throw error;
      
      success++;
      
    } catch (error) {
      console.error(`  ✗ 付款記錄失敗: ${payment.paymentNo || payment.orderNo}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 付款記錄遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 步驟 7: 遷移 PSA 主訂單
 */
async function migratePsaOrders(userMap) {
  console.log('\n🚀 開始遷移 PSA 主訂單...');
  
  const data = await callGAS('exportAllPSAOrders');
  const psaOrders = data.psaOrders || [];
  
  console.log(`📊 取得 ${psaOrders.length} 筆 PSA 訂單`);
  
  if (psaOrders.length === 0) {
    console.log('⚠️  無 PSA 訂單');
    return;
  }
  
  let success = 0;
  let failed = 0;
  
  for (const order of psaOrders) {
    try {
      // 先用 phone 查找用戶
      let userId = userMap.get(order.phone);
      
      // 如果沒找到，嘗試用 nickname 查找
      if (!userId && order.nickname) {
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('nickname', order.nickname)
          .single();
        
        if (user) {
          userId = user.id;
        }
      }
      
      if (!userId) {
        console.warn(`  ⚠️  找不到用戶: ${order.nickname} (${order.phone})`);
        failed++;
        continue;
      }
      
      const { error } = await supabase
        .from('psa_orders')
        .insert({
          user_id: userId,
          order_id: order.orderId,
          real_name: order.realName,
          email: order.email,
          phone: order.phone,
          shipping_method: order.shippingMethod,
          total_cards: order.totalCards,
          price_per_card: order.pricePerCard,
          total_amount: order.totalAmount,
          status: order.status,
          timestamp: order.timestamp,
          status_updated_at: order.statusUpdatedAt
        });
      
      if (error) throw error;
      
      success++;
      
    } catch (error) {
      console.error(`  ✗ PSA 訂單失敗: ${order.orderId}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ PSA 訂單遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 步驟 8: 遷移 PSA 卡片明細
 */
async function migratePsaCards() {
  console.log('\n🚀 開始遷移 PSA 卡片明細...');
  
  const data = await callGAS('exportAllPSACards');
  const psaCards = data.psaCards || [];
  
  console.log(`📊 取得 ${psaCards.length} 筆 PSA 卡片`);
  
  if (psaCards.length === 0) {
    console.log('⚠️  無 PSA 卡片');
    return;
  }
  
  let success = 0;
  let failed = 0;
  
  for (const card of psaCards) {
    try {
      const { error } = await supabase
        .from('psa_card_details')
        .insert({
          order_id: card.orderId,
          card_number: card.cardNumber,
          year: card.year,
          player: card.player,
          is_signature: card.isSignature === 'Y' || card.isSignature === '是',
          is_relic: card.isRelic === 'Y' || card.isRelic === '是',
          grading_type: card.gradingType,
          limited: card.limited,
          limited_num: card.limitedNum,
          status: card.status,
          front_image_url: card.frontImageUrl,
          back_image_url: card.backImageUrl,
          timestamp: card.timestamp
        });
      
      if (error) throw error;
      
      success++;
      
    } catch (error) {
      console.error(`  ✗ PSA 卡片失敗: ${card.orderId} - 卡片 ${card.cardNumber}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ PSA 卡片遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 遷移出貨紀錄
 */
async function migrateShipments(userMap) {
  console.log('\n📦 開始遷移出貨紀錄...');
  
  const result = await callGAS('exportAllShipments');
  const shipments = result.shipments || [];
  
  console.log(`📋 取得 ${shipments.length} 筆出貨紀錄`);
  
  if (shipments.length === 0) {
    console.log('⚠️  沒有出貨紀錄資料');
    return;
  }
  
  let success = 0;
  let failed = 0;
  
  for (const shipment of shipments) {
    try {
      // 根據電話號碼查找用戶
      let userId = null;
      
      if (shipment.phone) {
        const phoneClean = String(shipment.phone).trim();
        userId = userMap.get(phoneClean);
      }
      
      // 如果電話找不到，嘗試用暱稱查找（不區分大小寫）
      if (!userId && shipment.nickname) {
        userId = userMap.get(shipment.nickname);
        
        if (!userId) {
          const user = await findUserByNickname(shipment.nickname);
          if (user) {
            userId = user.id;
            userMap.set(shipment.nickname, userId);
          }
        }
      }
      
      if (!userId) {
        console.log(`  ⚠️  找不到用戶: ${shipment.nickname} (${shipment.phone})`);
        // 出貨紀錄即使找不到用戶也可能需要保留，所以繼續處理
      }
      
      // 將商品明細解析為 JSON（如果是字串）
      let itemsJson = null;
      if (shipment.items) {
        try {
          // 嘗試解析為 JSON
          if (typeof shipment.items === 'string') {
            // 如果是純文字列表（用換行或逗號分隔），轉為陣列
            const itemsList = shipment.items.split(/[\n,]/).map(item => item.trim()).filter(item => item);
            itemsJson = itemsList;
          } else {
            itemsJson = shipment.items;
          }
        } catch (e) {
          // 如果解析失敗，直接存為文字陣列
          itemsJson = [String(shipment.items)];
        }
      }
      
      const { error } = await supabase
        .from('shipments')
        .insert({
          shipment_no: shipment.shipmentNo,
          user_id: userId,
          shipment_date: shipment.shipmentDate,
          nickname: shipment.nickname,
          real_name: shipment.realName,
          phone: shipment.phone,
          ship_store: shipment.shipStore,
          store_number: shipment.storeNumber,
          tracking_no: shipment.trackingNo,
          items: itemsJson,
          remark: shipment.remark,
          status: shipment.trackingNo ? 'shipped' : 'pending',
          created_at: shipment.shipmentDate || new Date().toISOString()
        });
      
      if (error) throw error;
      
      success++;
      console.log(`  ✓ ${shipment.shipmentNo} - ${shipment.nickname}`);
      
    } catch (error) {
      console.error(`  ✗ 出貨紀錄失敗: ${shipment.shipmentNo}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 出貨紀錄遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 步驟 10: 遷移 Topps Now
 */
async function migrateToppsNow(userMap) {
  console.log('\n🚀 開始遷移 Topps Now...');
  
  const data = await callGAS('exportToppsNow');
  const items = data.data || [];
  
  console.log(`📊 取得 ${items.length} 筆 Topps Now`);
  
  if (items.length === 0) {
    console.log('⚠️  無 Topps Now 資料');
    return;
  }
  
  let success = 0;
  let failed = 0;
  
  for (const item of items) {
    try {
      const userId = userMap.get(item.phone);
      if (!userId) {
        console.log(`  ⚠️  找不到用戶: ${item.itemName} (${item.phone})`);
        failed++;
        continue;
      }
      
      const { error } = await supabase
        .from('topps_now')
        .insert({
          user_id: userId,
          player: item.itemName,
          quantity: item.quantity || 1,
          total_fee: item.totalFee || 0,
          status: item.status || '已通知',
          remark: item.notes,
          created_at: item.orderDate || new Date().toISOString()
        });
      
      if (error) throw error;
      success++;
      
    } catch (error) {
      console.error(`  ✗ 失敗: ${item.itemName}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ Topps Now 遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 步驟 11: 遷移抽獎記錄
 */
async function migrateLottery(userMap) {
  console.log('\n🚀 開始遷移抽獎記錄...');
  
  const data = await callGAS('exportLottery');
  const items = data.data || [];
  
  console.log(`📊 取得 ${items.length} 筆抽獎記錄`);
  
  if (items.length === 0) {
    console.log('⚠️  無抽獎資料');
    return;
  }
  
  let success = 0;
  let failed = 0;
  
  for (const item of items) {
    try {
      const userId = userMap.get(item.phone);
      if (!userId) {
        console.log(`  ⚠️  找不到用戶: ${item.itemName} (${item.phone})`);
        failed++;
        continue;
      }
      
      const { error } = await supabase
        .from('lottery')
        .insert({
          user_id: userId,
          item: item.itemName,
          quantity: 1,
          total_fee: 0,
          status: item.result || '已通知',
          remark: item.notes,
          created_at: item.date || new Date().toISOString()
        });
      
      if (error) throw error;
      success++;
      
    } catch (error) {
      console.error(`  ✗ 失敗: ${item.itemName}`);
      console.error(`    錯誤: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`✅ 抽獎記錄遷移完成: 成功 ${success}, 失敗 ${failed}`);
}

/**
 * 步驟 12: 遷移綠界記錄（已在 payments 處理，跳過）
 */
async function migrateEcpayRecords() {
  console.log('\n⏭️  綠界記錄已在 payments 處理，跳過');
}

/**
 * 步驟 13: 遷移訂單歷史
 * 注意：訂單歷史表的 nickname 欄位實際存的是商品名稱，而非用戶暱稱
 * 這個表結構有問題，暫時跳過遷移
 */
async function migrateOrderHistory(userMap) {
  console.log('\n⏭️  訂單歷史表結構有問題（nickname 欄位存的是商品名稱），暫時跳過');
  console.log('   建議：需要重新設計此表的資料結構或從其他來源獲取用戶資訊');
}

/**
 * 主程序
 */
async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   GAS → Supabase 資料遷移工具       ║');
  console.log('╚══════════════════════════════════════╝\n');
  
  console.log('📋 設定資訊:');
  console.log(`  Supabase: ${process.env.SUPABASE_URL}`);
  console.log(`  GAS Export: ${process.env.GAS_EXPORT_URL}\n`);
  
  try {
    const startTime = Date.now();
    
    const userMap = await migrateUsers();
    await migrateOrders(userMap);
    await migrateBreaks(userMap);
    await migrateBreakCredits(userMap);
    await migrateProducts();
    await migratePayments(userMap);
    await migratePsaOrders(userMap);
    await migratePsaCards();
    await migrateShipments(userMap);
    await migrateToppsNow(userMap);
    await migrateLottery(userMap);
    await migrateEcpayRecords();
    await migrateOrderHistory(userMap);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║        🎉 遷移完成！                ║');
    console.log(`║        耗時: ${duration} 秒`);
    console.log('╚══════════════════════════════════════╝');
    
  } catch (error) {
    console.error('\n❌ 遷移過程發生錯誤:');
    console.error(error);
    process.exit(1);
  }
}

// 執行
main();
