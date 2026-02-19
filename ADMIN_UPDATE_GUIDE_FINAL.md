# 管理後台完整更新指南

## ✅ 已完成的修改

### 1. 訂單管理分頁 (30筆/頁) - 已完成
- 變數已添加
- `renderOrdersTable` 已修改支持分頁
- `changeOrdersPage` 函數已添加

### 2. 用戶管理分頁 (30筆/頁) - 已完成
- 變數已添加
- `loadUsers` 已修改
- `renderUsersTable` 已修改支持分頁
- `changeUsersPage` 函數已添加

### 3. 用戶選擇器功能 - 已完成
- `loadAllUsersToCache` 函數已添加
- `searchUsersForOrder` 函數已添加
- `searchUsersForBreak` 函數已添加

## 📝 待手動完成的修改

### 1. 團拆管理分頁

請替換現有的 `renderBreaksTable` 函數為：

```javascript
function renderBreaksTable(breaks) {
  // 📖 計算分頁
  totalBreaksCount = breaks.length;
  const totalPages = Math.ceil(totalBreaksCount / breaksPerPage);
  const startIdx = (currentBreaksPage - 1) * breaksPerPage;
  const endIdx = startIdx + breaksPerPage;
  const pageBreaks = breaks.slice(startIdx, endIdx);
  
  // ... 保留原有表格生成代碼，但使用 pageBreaks 而不是 breaks ...
  
  // 在表格HTML後添加分頁控制：
  if (totalPages > 1) {
    html += '<div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:20px;">';
    html += `<button onclick="changeBreaksPage(${currentBreaksPage - 1})" ${currentBreaksPage === 1 ? 'disabled' : ''} style="padding:8px 16px;border:1px solid #ddd;background:white;border-radius:6px;cursor:pointer;">&laquo; 上一頁</button>`;
    html += `<span style="color:#666;font-size:14px;">第 ${currentBreaksPage} / ${totalPages} 頁 (共 ${totalBreaksCount} 筆)</span>`;
    html += `<button onclick="changeBreaksPage(${currentBreaksPage + 1})" ${currentBreaksPage === totalPages ? 'disabled' : ''} style="padding:8px 16px;border:1px solid #ddd;background:white;border-radius:6px;cursor:pointer;">下一頁 &raquo;</button>`;
    html += '</div>';
  }
  
  document.getElementById('breaksList').innerHTML = html;
  updateBreakBatchSelectUI();
}

function changeBreaksPage(newPage) {
  const totalPages = Math.ceil(totalBreaksCount / breaksPerPage);
  if (newPage < 1 || newPage > totalPages) return;
  currentBreaksPage = newPage;
  renderBreaksTable(breaksCache);
}
```

在 `loadAllBreaks` 函數中添加：
```javascript
breaksCache = breaks;
currentBreaksPage = 1;
```

### 2. 團拆金管理分頁

修改 `loadBreakCredits` 函數：
```javascript
async function loadBreakCredits() {
  const nickname = document.getElementById('creditSearchNickname').value.trim();
  const res = await callAPI('getAllBreakCredits', { nickname });
  
  if (!res.success) {
    document.getElementById('creditList').innerHTML = '<p>載入失敗: ' + res.message + '</p>';
    return;
  }
  
  const credits = res.credits || [];
  creditsCache = credits; // 新增
  currentCreditsPage = 1; // 新增
  
  if (credits.length === 0) {
    document.getElementById('creditList').innerHTML = '<p>查無資料</p>';
    return;
  }
  
  renderCreditsTable(credits); // 改為調用新函數
}

function renderCreditsTable(credits) {
  // 📖 計算分頁
  totalCreditsCount = credits.length;
  const totalPages = Math.ceil(totalCreditsCount / creditsPerPage);
  const startIdx = (currentCreditsPage - 1) * creditsPerPage;
  const endIdx = startIdx + creditsPerPage;
  const pageCredits = credits.slice(startIdx, endIdx);
  
  // ... 使用 pageCredits 生成表格 HTML ...
  // ... 原有的表格生成代碼 ...
  
  // 在表格HTML後添加分頁控制：
  if (totalPages > 1) {
    html += '<div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:20px;">';
    html += `<button onclick="changeCreditsPage(${currentCreditsPage - 1})" ${currentCreditsPage === 1 ? 'disabled' : ''} style="padding:8px 16px;border:1px solid #ddd;background:white;border-radius:6px;cursor:pointer;">&laquo; 上一頁</button>`;
    html += `<span style="color:#666;font-size:14px;">第 ${currentCreditsPage} / ${totalPages} 頁 (共 ${totalCreditsCount} 筆)</span>`;
    html += `<button onclick="changeCreditsPage(${currentCreditsPage + 1})" ${currentCreditsPage === totalPages ? 'disabled' : ''} style="padding:8px 16px;border:1px solid #ddd;background:white;border-radius:6px;cursor:pointer;">下一頁 &raquo;</button>`;
    html += '</div>';
  }
  
  document.getElementById('creditList').innerHTML = html;
}

function changeCreditsPage(newPage) {
  const totalPages = Math.ceil(totalCreditsCount / creditsPerPage);
  if (newPage < 1 || newPage > totalPages) return;
  currentCreditsPage = newPage;
  renderCreditsTable(creditsCache);
}
```

### 3. 訂單編輯 Modal - 添加用戶選擇器

在 `<label>商品</label>` 欄位後面添加：

```html
<label>👤 訂購者（可轉讓給其他用戶）</label>
<div id="editOrderCurrentUser" style="padding: 10px; background: #f0f4f8; border-radius: 4px; margin-bottom: 15px;">
  <strong>當前訂購者：</strong><span id="editOrderCurrentUserInfo"></span>
</div>
<div style="display: flex; gap: 10px; margin-bottom: 10px;">
  <input type="text" id="editOrderUserSearch" placeholder="輸入電話或暱稱搜尋..." style="flex: 1;" />
  <button type="button" onclick="searchUsersForOrder()" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">🔍 搜尋用戶</button>
</div>
<select id="editOrderUserId" size="5" style="width: 100%; margin-bottom: 15px; display: none;">
  <option value="">-- 選擇新用戶 --</option>
</select>
```

修改 `handleEditOrderClick` 函數，在開頭添加：
```javascript
const nickname = button.getAttribute('data-order-nickname') || ordersCache.find(o => o.id === id)?.nickname || '';
const phone = button.getAttribute('data-order-phone') || ordersCache.find(o => o.id === id)?.phone || '';
document.getElementById('editOrderCurrentUserInfo').textContent = `${nickname} (${phone})`;
document.getElementById('editOrderUserId').style.display = 'none';
document.getElementById('editOrderUserSearch').value = '';
```

修改 `renderOrdersTable` 中的編輯按鈕，添加 data 屬性：
```javascript
data-order-nickname="${order.nickname || ''}" data-order-phone="${order.phone || ''}"
```

修改 `updateOrderModal` 函數：
```javascript
async function updateOrderModal() {
  const id = document.getElementById('editOrderId').value;
  const status = document.getElementById('editOrderStatus').value;
  const balance = document.getElementById('editOrderBalance').value;
  const notes = document.getElementById('editOrderNotes').value;
  const manualPrice = document.getElementById('editOrderManualPrice').checked;
  const newUserId = document.getElementById('editOrderUserId').value; // 新增
  
  if (!id) {
    alert('訂單 ID 遺失');
    return;
  }
  
  try {
    const updateData = {
      id,
      status: status || undefined,
      balance: balance ? Number(balance) : undefined,
      notes: notes || undefined,
      manual_price: manualPrice
    };
    
    // 如果選擇了新用戶，添加到更新數據中
    if (newUserId) {
      updateData.user_id = newUserId;
      console.log('更新訂單用戶:', newUserId);
    }
    
    const res = await callAPI('updateOrder', updateData);

    if (res && res.success) {
      alert('✅ 訂單已更新');
      closeModal('editOrderModal');
      await loadAllOrders();
    } else {
      const errorMsg = res?.message || '未知錯誤';
      alert('❌ 更新失敗: ' + errorMsg);
    }
  } catch (error) {
    console.error('[Admin] 更新訂單異常:', error);
    alert('❌ 更新異常: ' + error.message);
  }
}
```

### 4. 團拆編輯 Modal - 添加用戶選擇器

在 `<label>團名</label>` 欄位後面添加：

```html
<label>👤 訂購者（可轉讓給其他用戶）</label>
<div id="editBreakCurrentUser" style="padding: 10px; background: #f0f4f8; border-radius: 4px; margin-bottom: 15px;">
  <strong>當前訂購者：</strong><span id="editBreakCurrentUserInfo"></span>
</div>
<div style="display: flex; gap: 10px; margin-bottom: 10px;">
  <input type="text" id="editBreakUserSearch" placeholder="輸入電話或暱稱搜尋..." style="flex: 1;" />
  <button type="button" onclick="searchUsersForBreak()" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">🔍 搜尋用戶</button>
</div>
<select id="editBreakUserId" size="5" style="width: 100%; margin-bottom: 15px; display: none;">
  <option value="">-- 選擇新用戶 --</option>
</select>
```

修改 `handleEditBreakClick` 函數，在開頭添加：
```javascript
const buyer = button.getAttribute('data-break-buyer') || '';
document.getElementById('editBreakCurrentUserInfo').textContent = buyer;
document.getElementById('editBreakUserId').style.display = 'none';
document.getElementById('editBreakUserSearch').value = '';
```

修改 `renderBreaksTable` 中的編輯按鈕，添加 data 屬性：
```javascript
data-break-buyer="${(breakItem.buyer || '').replace(/"/g, '&quot;')}"
```

修改 `updateBreakModal` 函數：
```javascript
async function updateBreakModal() {
  const id = document.getElementById('editBreakId').value;
  const paid = document.getElementById('editBreakPaid').value;
  const status = document.getElementById('editBreakStatus').value;
  const item = document.getElementById('editBreakItem').value;
  const isOpened = document.getElementById('editBreakIsOpened').checked;
  const isShipped = document.getElementById('editBreakIsShipped').checked;
  const newUserId = document.getElementById('editBreakUserId').value; // 新增
  
  if (!id) {
    alert('團拆 ID 遺失');
    return;
  }
  
  try {
    const updateData = {
      id,
      paid: paid ? Number(paid) : undefined,
      status: status || undefined,
      item: item || undefined,
      is_opened: isOpened,
      is_shipped: isShipped
    };
    
    // 如果選擇了新用戶，添加到更新數據中
    if (newUserId) {
      updateData.user_id = newUserId;
      console.log('更新團拆用戶:', newUserId);
    }
    
    const res = await callAPI('updateBreak', updateData);

    if (res && res.success) {
      alert('✅ 團拆已更新');
      closeModal('editBreakModal');
      await loadAllBreaks();
      loadNotifications(currentNotificationFilter);
    } else {
      const errorMsg = res?.message || '未知錯誤';
      alert('❌ 更新失敗: ' + errorMsg);
    }
  } catch (error) {
    console.error('[Admin] 更新團拆異常:', error);
    alert('❌ 更新異常: ' + error.message);
  }
}
```

### 5. 後端 API 更新

確保 `backend/worker.js` 中的 `handleUpdateOrder` 和 `handleUpdateBreak` 函數支持更新 `user_id`：

```javascript
// 在 handleUpdateOrder 函數中
if (body.user_id) {
  updateFields.user_id = body.user_id;
}

// 在 handleUpdateBreak 函數中
if (body.user_id) {
  updateFields.user_id = body.user_id;
}
```

## 總結

修改完成後，管理後台將具備：
1. ✅ 所有頁面的分頁功能（30筆/頁）
2. ✅ 訂單和團拆的用戶轉讓功能
3. ✅ 完整的用戶搜尋和選擇功能

請按照以上步驟逐一完成修改。
