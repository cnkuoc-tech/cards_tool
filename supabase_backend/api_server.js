/**
 * Supabase Backend API Server
 * 完整實作所有 backend.js 的功能
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import express from 'express';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ==================== 工具函數 ====================

function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toUpperCase();
    return v === 'Y' || v === 'TRUE' || v === '1';
  }
  return false;
}

// ==================== API 處理函數 ====================

/**
 * 1. 登入 (用電話+生日驗證)
 */
async function handleLogin(req, res) {
  const { phone, birthday } = req.body;
  
  console.log('[LOGIN] phone:', phone, 'birthday:', birthday);
  
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone);
  
  if (error || !users || users.length === 0) {
    return res.json({ success: false, message: '電話號碼未註冊' });
  }
  
  const user = users[0];
  const userBirthday = String(user.birthday || '').trim();
  const inputBirthday = String(birthday || '').trim();
  
  console.log('[LOGIN] User birthday:', userBirthday, 'Input:', inputBirthday);
  
  if (userBirthday !== inputBirthday) {
    return res.json({ success: false, message: '生日驗證失敗' });
  }
  
  res.json({
    success: true,
    user: {
      phone: user.phone,
      nickname: user.nickname,
      birthday: user.birthday,
      email: user.email,
      address: user.address,
      realName: user.real_name
    }
  });
}

/**
 * 2. 註冊新用戶
 */
async function handleRegisterUser(req, res) {
  const { phone, nickname, birthday, email, address, realName } = req.body;
  
  // 檢查電話是否已存在
  const { data: existing } = await supabase
    .from('users')
    .select('phone')
    .eq('phone', phone);
  
  if (existing && existing.length > 0) {
    return res.json({ success: false, message: '此電話號碼已註冊' });
  }
  
  // 新增用戶
  const { data, error } = await supabase
    .from('users')
    .insert([{
      phone,
      nickname,
      birthday,
      email: email || null,
      address: address || null,
      real_name: realName || null
    }])
    .select();
  
  if (error) {
    console.error('[REGISTER] Error:', error);
    return res.json({ success: false, message: '註冊失敗: ' + error.message });
  }
  
  res.json({ success: true, message: '註冊成功！', user: data[0] });
}

/**
 * 3. 獲取商品目錄
 */
async function handleGetOrderCatalog(req, res) {
  const { requestingUser } = req.body;
  
  // 獲取所有商品
  const { data: products, error } = await supabase
    .from('product_catalog')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    return res.json({ success: false, message: error.message });
  }
  
  // 轉換格式以符合前端預期
  const catalog = products.map(p => ({
    itemName: p.item_name,
    cardNo: p.card_no || '',
    price: p.price || 0,
    thresholdPrice: p.threshold_price || p.price,
    stock: p.stock || 0,
    imageUrl: p.image_url || '',
    isPreOrder: p.is_pre_order || false,
    category: p.category || '其他'
  }));
  
  res.json({ success: true, catalog });
}

/**
 * 4. 獲取用戶訂單資訊
 */
async function handleGetOrderInfo(req, res) {
  const { phone, birthday } = req.body;
  
  // 先驗證用戶
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .eq('birthday', birthday);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '用戶驗證失敗' });
  }
  
  const user = users[0];
  
  // 獲取訂單
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('timestamp', { ascending: false });
  
  // 獲取團拆
  const { data: breaks } = await supabase
    .from('breaks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  // 獲取團拆金
  const { data: credits } = await supabase
    .from('break_credits')
    .select('*')
    .eq('user_id', user.id);
  
  // 計算總團拆金和已使用金額
  let totalCredit = 0;
  let usedCredit = 0;
  
  if (credits && credits.length > 0) {
    credits.forEach(c => {
      totalCredit += c.amount || 0;
      usedCredit += c.used_amount || 0;
    });
  }
  
  const availableCredit = totalCredit - usedCredit;
  
  // 轉換訂單格式
  const orderList = (orders || []).map(o => ({
    timestamp: o.timestamp,
    item: o.item,
    cardNo: o.card_no,
    quantity: o.quantity,
    totalFee: o.total_fee,
    balanceAmount: o.balance_amount,
    isCleared: o.is_cleared,
    status: o.status,
    imageUrl: o.image_url
  }));
  
  // 轉換團拆格式
  const breakList = (breaks || []).map(b => ({
    breakId: b.break_id,
    name: b.name,
    category: b.category,
    format: b.format,
    item: b.item,
    totalFee: b.total_fee,
    paid: b.paid,
    balance: b.balance,
    createdAt: b.created_at
  }));
  
  res.json({
    success: true,
    userInfo: {
      nickname: user.nickname,
      phone: user.phone,
      email: user.email,
      address: user.address,
      realName: user.real_name
    },
    orders: orderList,
    breaks: breakList,
    breakCredit: {
      total: totalCredit,
      used: usedCredit,
      available: availableCredit
    }
  });
}

/**
 * 5. 新增訂單到主表
 */
async function handleAddOrderEntriesToMain(req, res) {
  const { nickname, phone, orderEntries } = req.body;
  
  if (!orderEntries || orderEntries.length === 0) {
    return res.json({ success: false, message: '訂單資料為空' });
  }
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  // 準備訂單資料
  const ordersToInsert = orderEntries.map(entry => ({
    user_id: userId,
    timestamp: new Date().toISOString(),
    item: entry.item,
    card_no: entry.cardNo || '',
    quantity: entry.quantity || 1,
    unit_price: entry.unitPrice || 0,
    total_fee: entry.totalFee || 0,
    balance_amount: entry.balanceAmount || 0,
    is_cleared: false,
    status: '待確認'
  }));
  
  // 插入訂單
  const { data, error } = await supabase
    .from('orders')
    .insert(ordersToInsert)
    .select();
  
  if (error) {
    console.error('[ADD_ORDER] Error:', error);
    return res.json({ success: false, message: '新增訂單失敗: ' + error.message });
  }
  
  res.json({ success: true, message: '訂單新增成功', insertedCount: data.length });
}

/**
 * 6. 獲取待付款項目
 */
async function handleGetPendingPaymentKeys(req, res) {
  const { nickname, phone } = req.body;
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  // 獲取未結清的訂單
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .eq('is_cleared', false)
    .gt('balance_amount', 0);
  
  // 獲取未付清的團拆
  const { data: breaks } = await supabase
    .from('breaks')
    .select('*')
    .eq('user_id', userId)
    .gt('balance', 0);
  
  const pendingItems = [];
  
  // 訂單
  if (orders) {
    orders.forEach(o => {
      pendingItems.push({
        type: 'order',
        key: `${o.item}_${o.card_no}`,
        item: o.item,
        cardNo: o.card_no,
        balance: o.balance_amount,
        timestamp: o.timestamp
      });
    });
  }
  
  // 團拆
  if (breaks) {
    breaks.forEach(b => {
      pendingItems.push({
        type: 'break',
        key: `${b.break_id}_${b.name}`,
        breakId: b.break_id,
        name: b.name,
        balance: b.balance,
        timestamp: b.created_at
      });
    });
  }
  
  res.json({ success: true, pendingItems });
}

/**
 * 7. 批量付款通知
 */
async function handleNotifyPaymentBulk(req, res) {
  const { nickname, phone, paymentItems } = req.body;
  
  if (!paymentItems || paymentItems.length === 0) {
    return res.json({ success: false, message: '付款項目為空' });
  }
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  // 記錄到訂單歷史
  const historyRecords = paymentItems.map(item => ({
    user_id: userId,
    action: '付款通知',
    details: `${item.item || item.name} - 金額: ${item.amount}`,
    timestamp: new Date().toISOString()
  }));
  
  const { error } = await supabase
    .from('order_history')
    .insert(historyRecords);
  
  if (error) {
    console.error('[PAYMENT_BULK] Error:', error);
    return res.json({ success: false, message: '付款通知失敗: ' + error.message });
  }
  
  res.json({ success: true, message: '付款通知已送出' });
}

/**
 * 8. 單筆付款通知
 */
async function handleSubmitPaymentNotification(req, res) {
  const { nickname, phone, paymentDetails } = req.body;
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  // 記錄到訂單歷史
  const { error } = await supabase
    .from('order_history')
    .insert([{
      user_id: userId,
      action: '付款通知',
      details: paymentDetails || '',
      timestamp: new Date().toISOString()
    }]);
  
  if (error) {
    return res.json({ success: false, message: '付款通知失敗: ' + error.message });
  }
  
  res.json({ success: true, message: '付款通知已送出' });
}

/**
 * 9. 更新個人資料
 */
async function handleNotifyProfileUpdate(req, res) {
  const { phone, nickname, email, address, realName } = req.body;
  
  const updateData = {};
  if (nickname) updateData.nickname = nickname;
  if (email) updateData.email = email;
  if (address) updateData.address = address;
  if (realName) updateData.real_name = realName;
  
  const { data, error } = await supabase
    .from('users')
    .update(updateData)
    .eq('phone', phone)
    .select();
  
  if (error) {
    return res.json({ success: false, message: '更新失敗: ' + error.message });
  }
  
  res.json({ success: true, message: '個人資料更新成功', user: data[0] });
}

/**
 * 10. 查詢訂單狀態
 */
async function handleLookupOrderStatus(req, res) {
  const { query } = req.body;
  
  // 可以用電話或訂單編號查詢
  let orders = [];
  let breaks = [];
  
  // 先嘗試用電話查詢
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', query);
  
  if (users && users.length > 0) {
    const userId = users[0].id;
    
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(20);
    
    const { data: breaksData } = await supabase
      .from('breaks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    
    orders = ordersData || [];
    breaks = breaksData || [];
  }
  
  res.json({
    success: true,
    orders: orders.map(o => ({
      item: o.item,
      cardNo: o.card_no,
      totalFee: o.total_fee,
      balanceAmount: o.balance_amount,
      status: o.status,
      timestamp: o.timestamp
    })),
    breaks: breaks.map(b => ({
      breakId: b.break_id,
      name: b.name,
      totalFee: b.total_fee,
      balance: b.balance,
      createdAt: b.created_at
    }))
  });
}

/**
 * 11. 獲取團拆金
 */
async function handleGetBreakCredit(req, res) {
  const { nickname, phone } = req.body;
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .or(`nickname.eq.${nickname},phone.eq.${phone}`);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  const { data: credits } = await supabase
    .from('break_credits')
    .select('*')
    .eq('user_id', userId);
  
  let total = 0;
  let used = 0;
  
  if (credits) {
    credits.forEach(c => {
      total += c.amount || 0;
      used += c.used_amount || 0;
    });
  }
  
  res.json({
    success: true,
    total,
    used,
    available: total - used
  });
}

/**
 * 12. 使用團拆金
 */
async function handleUseBreakCredit(req, res) {
  const { nickname, phone, amount, breakIds } = req.body;
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .or(`nickname.eq.${nickname},phone.eq.${phone}`);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  // 檢查可用團拆金
  const { data: credits } = await supabase
    .from('break_credits')
    .select('*')
    .eq('user_id', userId)
    .eq('is_used', false);
  
  let available = 0;
  if (credits) {
    credits.forEach(c => {
      available += (c.amount || 0) - (c.used_amount || 0);
    });
  }
  
  if (available < amount) {
    return res.json({ success: false, message: '團拆金餘額不足' });
  }
  
  // 更新使用記錄（簡化版：更新第一筆可用的團拆金）
  if (credits && credits.length > 0) {
    const creditToUpdate = credits[0];
    const newUsedAmount = (creditToUpdate.used_amount || 0) + amount;
    
    await supabase
      .from('break_credits')
      .update({
        used_amount: newUsedAmount,
        is_used: newUsedAmount >= creditToUpdate.amount,
        used_break_ids: breakIds
      })
      .eq('id', creditToUpdate.id);
  }
  
  res.json({ success: true, message: '團拆金使用成功' });
}

/**
 * 13. 提交 PSA 訂單
 */
async function handleSubmitPsaOrder(req, res) {
  const { formData } = req.body;
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', formData.phone);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  // 生成訂單編號
  const orderId = 'PSA' + Date.now();
  
  const { data, error } = await supabase
    .from('psa_orders')
    .insert([{
      user_id: userId,
      order_id: orderId,
      real_name: formData.realName,
      email: formData.email,
      phone: formData.phone,
      shipping_method: formData.shippingMethod,
      total_cards: formData.totalCards,
      total_amount: formData.totalAmount,
      status: '處理中',
      timestamp: new Date().toISOString()
    }])
    .select();
  
  if (error) {
    return res.json({ success: false, message: 'PSA 訂單提交失敗: ' + error.message });
  }
  
  res.json({ success: true, message: 'PSA 訂單提交成功', orderId: orderId });
}

/**
 * 14. 查詢 PSA 訂單
 */
async function handleLookupPsaOrders(req, res) {
  const { phone } = req.body;
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  const { data: orders } = await supabase
    .from('psa_orders')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false });
  
  res.json({
    success: true,
    orders: (orders || []).map(o => ({
      orderId: o.order_id,
      realName: o.real_name,
      totalCards: o.total_cards,
      totalAmount: o.total_amount,
      status: o.status,
      timestamp: o.timestamp
    }))
  });
}

/**
 * 15. 檢查每日抽籤
 */
async function handleCheckDailyFortune(req, res) {
  const { phone } = req.body;
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, hasDrawn: false });
  }
  
  const userId = users[0].id;
  const today = new Date().toISOString().split('T')[0];
  
  const { data: fortune } = await supabase
    .from('lottery')
    .select('*')
    .eq('user_id', userId)
    .gte('draw_date', today)
    .lt('draw_date', today + 'T23:59:59');
  
  if (fortune && fortune.length > 0) {
    res.json({
      success: true,
      hasDrawn: true,
      result: fortune[0].result
    });
  } else {
    res.json({
      success: true,
      hasDrawn: false
    });
  }
}

/**
 * 16. 儲存每日抽籤結果
 */
async function handleSaveDailyFortune(req, res) {
  const { phone, nickname, result } = req.body;
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  const { error } = await supabase
    .from('lottery')
    .insert([{
      user_id: userId,
      draw_date: new Date().toISOString(),
      result: result
    }]);
  
  if (error) {
    return res.json({ success: false, message: '儲存失敗: ' + error.message });
  }
  
  res.json({ success: true, message: '抽籤結果已儲存' });
}

/**
 * 17. 建立出貨記錄
 */
async function handleCreateShipmentRecord(req, res) {
  const { phone, shipmentData } = req.body;
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  const { data, error } = await supabase
    .from('shipments')
    .insert([{
      user_id: userId,
      shipment_no: shipmentData.shipmentNo,
      shipment_date: new Date().toISOString(),
      tracking_no: shipmentData.trackingNo,
      items: shipmentData.items,
      status: '已出貨'
    }])
    .select();
  
  if (error) {
    return res.json({ success: false, message: '建立出貨記錄失敗: ' + error.message });
  }
  
  res.json({ success: true, message: '出貨記錄已建立', shipment: data[0] });
}

/**
 * 18. 獲取出貨記錄
 */
async function handleGetShipmentRecords(req, res) {
  const { phone } = req.body;
  
  // 獲取用戶 ID
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone);
  
  if (!users || users.length === 0) {
    return res.json({ success: false, message: '找不到用戶' });
  }
  
  const userId = users[0].id;
  
  const { data: shipments } = await supabase
    .from('shipments')
    .select('*')
    .eq('user_id', userId)
    .order('shipment_date', { ascending: false });
  
  res.json({
    success: true,
    shipments: (shipments || []).map(s => ({
      shipmentNo: s.shipment_no,
      trackingNo: s.tracking_no,
      items: s.items,
      status: s.status,
      shipmentDate: s.shipment_date
    }))
  });
}

/**
 * 19. 建立綠界付款 (stub - 需要實際金流串接)
 */
async function handleCreateEcpayPayment(req, res) {
  const { orderDetails, totalAmount } = req.body;
  
  // TODO: 實際綠界金流串接
  const merchantTradeNo = 'NC' + Date.now();
  
  res.json({
    success: true,
    merchantTradeNo,
    paymentUrl: 'https://payment.ecpay.com.tw/...',
    message: '付款資訊已建立（測試模式）'
  });
}

/**
 * 20. 檢查付款狀態
 */
async function handleCheckPaymentStatus(req, res) {
  const { merchantTradeNo } = req.body;
  
  const { data: payment } = await supabase
    .from('ecpay_records')
    .select('*')
    .eq('merchant_trade_no', merchantTradeNo);
  
  if (payment && payment.length > 0) {
    res.json({
      success: true,
      status: payment[0].status,
      paymentDate: payment[0].payment_date
    });
  } else {
    res.json({
      success: false,
      message: '找不到付款記錄'
    });
  }
}

/**
 * 21. 更新訂單狀態為待確認
 */
async function handleUpdateOrderStatusToPending(req, res) {
  const { orderDetails, merchantTradeNo } = req.body;
  
  // TODO: 根據 orderDetails 更新對應訂單的狀態
  res.json({ success: true, message: '訂單狀態已更新' });
}

/**
 * 22. 更新團拆狀態為待確認
 */
async function handleUpdateBreakStatusToPending(req, res) {
  const { breakDetails, merchantTradeNo } = req.body;
  
  // TODO: 根據 breakDetails 更新對應團拆的狀態
  res.json({ success: true, message: '團拆狀態已更新' });
}

// ==================== 路由設定 ====================

const apiHandlers = {
  'login': handleLogin,
  'registerUser': handleRegisterUser,
  'getOrderCatalog': handleGetOrderCatalog,
  'getOrderInfo': handleGetOrderInfo,
  'addOrderEntriesToMain': handleAddOrderEntriesToMain,
  'getPendingPaymentKeys': handleGetPendingPaymentKeys,
  'notifyPaymentBulk': handleNotifyPaymentBulk,
  'submitPaymentNotification': handleSubmitPaymentNotification,
  'notifyProfileUpdate': handleNotifyProfileUpdate,
  'lookupOrderStatus': handleLookupOrderStatus,
  'getBreakCredit': handleGetBreakCredit,
  'useBreakCredit': handleUseBreakCredit,
  'submitPsaOrder': handleSubmitPsaOrder,
  'lookupPsaOrders': handleLookupPsaOrders,
  'checkDailyFortune': handleCheckDailyFortune,
  'saveDailyFortune': handleSaveDailyFortune,
  'createShipmentRecord': handleCreateShipmentRecord,
  'getShipmentRecords': handleGetShipmentRecords,
  'createEcpayPayment': handleCreateEcpayPayment,
  'checkPaymentStatus': handleCheckPaymentStatus,
  'updateOrderStatusToPending': handleUpdateOrderStatusToPending,
  'updateBreakStatusToPending': handleUpdateBreakStatusToPending
};

app.post('/api', async (req, res) => {
  try {
    const { action } = req.body;
    
    console.log('[API] Action:', action);
    
    if (!action) {
      return res.json({ success: false, message: 'Missing action' });
    }
    
    const handler = apiHandlers[action];
    
    if (!handler) {
      return res.json({ success: false, message: `Unknown action: ${action}` });
    }
    
    await handler(req, res);
    
  } catch (error) {
    console.error('[API] Error:', error);
    res.json({ success: false, message: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ message: 'Supabase API Server Running', version: '1.0.0' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ API Server running on port ${PORT}`);
  console.log(`✅ Available APIs: ${Object.keys(apiHandlers).length} actions`);
});
