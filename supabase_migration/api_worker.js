/**
 * Cloudflare Worker - Supabase API Gateway
 * 
 * 部署到 Cloudflare Workers，作為前端與 Supabase 之間的 API 層
 */

import { createClient } from '@supabase/supabase-js';

// 環境變數設置（在 Cloudflare Workers 後台設定）
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * 處理 OPTIONS 請求（CORS preflight）
 */
function handleOptions() {
  return new Response(null, {
    headers: corsHeaders
  });
}

/**
 * 返回 JSON 響應
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

/**
 * 獲取訂單資訊
 */
async function getOrderInfo(supabase, payload) {
  const { phone, birthday } = payload;
  
  // 1. 查找用戶
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('phone', phone)
    .eq('birthday', birthday)
    .single();
  
  if (userError || !user) {
    return { success: false, message: '找不到用戶資料' };
  }
  
  // 2. 查詢訂單
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user.id)
    .order('timestamp', { ascending: false });
  
  // 3. 查詢團拆
  const { data: breaks, error: breaksError } = await supabase
    .from('breaks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  return {
    success: true,
    nickname: user.nickname,
    orders: orders || [],
    groupBreaks: breaks || []
  };
}

/**
 * 獲取商品目錄
 */
async function getOrderCatalog(supabase) {
  const { data, error } = await supabase
    .from('product_catalog')
    .select('*')
    .order('item_name');
  
  if (error) {
    return { success: false, message: error.message };
  }
  
  return {
    success: true,
    catalog: data
  };
}

/**
 * 查詢團拆金
 */
async function getBreakCredit(supabase, payload) {
  const { nickname } = payload;
  
  // 1. 查找用戶
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('nickname', nickname)
    .single();
  
  if (userError || !user) {
    return { success: true, credit: 0, history: [] };
  }
  
  // 2. 查詢團拆金
  const { data: credits, error: creditsError } = await supabase
    .from('break_credits')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (creditsError) {
    return { success: false, message: creditsError.message };
  }
  
  // 計算餘額
  let totalCredit = 0;
  credits.forEach(c => {
    if (!c.is_used) {
      totalCredit += c.amount;
    } else {
      totalCredit += (c.amount - c.used_amount);
    }
  });
  
  return {
    success: true,
    credit: totalCredit,
    history: credits
  };
}

/**
 * 使用團拆金
 */
async function useBreakCredit(supabase, payload) {
  const { nickname, amount, breakIds } = payload;
  
  // 1. 查找用戶
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('nickname', nickname)
    .single();
  
  if (!user) {
    return { success: false, message: '找不到用戶' };
  }
  
  // 2. 查詢可用團拆金
  const { data: credits } = await supabase
    .from('break_credits')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_used', false)
    .order('created_at');
  
  let remainingAmount = amount;
  const updates = [];
  
  for (const credit of credits) {
    if (remainingAmount <= 0) break;
    
    const availableAmount = credit.amount - credit.used_amount;
    const useAmount = Math.min(availableAmount, remainingAmount);
    
    const newUsedAmount = credit.used_amount + useAmount;
    const isFullyUsed = newUsedAmount >= credit.amount;
    
    updates.push({
      id: credit.id,
      used_amount: newUsedAmount,
      is_used: isFullyUsed,
      used_break_ids: [...(credit.used_break_ids || []), ...breakIds]
    });
    
    remainingAmount -= useAmount;
  }
  
  // 3. 批次更新
  for (const update of updates) {
    await supabase
      .from('break_credits')
      .update(update)
      .eq('id', update.id);
  }
  
  return {
    success: true,
    message: '團拆金使用成功'
  };
}

/**
 * 建立綠界付款
 */
async function createEcpayPayment(supabase, payload) {
  // 這裡保留原有的綠界金流邏輯
  // 或者改用 Supabase Edge Functions
  return { success: false, message: '此功能尚未實作' };
}

/**
 * 主要路由處理
 */
async function handleRequest(request) {
  // 處理 CORS preflight
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }
  
  // 只接受 POST
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }
  
  try {
    const payload = await request.json();
    const { action } = payload;
    
    // 建立 Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // 路由分發
    let result;
    switch (action) {
      case 'getOrderInfo':
        result = await getOrderInfo(supabase, payload);
        break;
      
      case 'getOrderCatalog':
        result = await getOrderCatalog(supabase);
        break;
      
      case 'getBreakCredit':
        result = await getBreakCredit(supabase, payload);
        break;
      
      case 'useBreakCredit':
        result = await useBreakCredit(supabase, payload);
        break;
      
      case 'createEcpayPayment':
        result = await createEcpayPayment(supabase, payload);
        break;
      
      default:
        result = { success: false, message: '未知的 action: ' + action };
    }
    
    return jsonResponse(result);
    
  } catch (error) {
    console.error('API Error:', error);
    return jsonResponse({
      success: false,
      message: error.message
    }, 500);
  }
}

// Cloudflare Workers 入口
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request);
  }
};
