# 管理後台更新說明

## 需要手動添加到 admin.html 的內容

### 1. 在 `<script>` 標籤開始處添加分頁變數（約在 1400 行附近）

```javascript
// ===== 分頁變數 =====
let currentBreaksPage = 1;
const breaksPerPage = 30;
let totalBreaksCount = 0;
let breaksCache = [];

let currentUsersPage = 1;
const usersPerPage = 30;
let totalUsersCount = 0;
let usersCache = [];

let currentCreditsPage = 1;
const creditsPerPage = 30;
let totalCreditsCount = 0;
let creditsCache = [];

// ===== 用戶選擇器 =====
let allUsersCache = [];
```

### 2. 添加用戶搜尋功能

```javascript
// 載入所有用戶到緩存
async function loadAllUsersToCache() {
  const res = await callAPI('getUsers', { limit: 1000 });
  if (res.success) {
    allUsersCache = res.users || [];
  }
  return allUsersCache;
}

// 為訂單搜尋用戶
async function searchUsersForOrder() {
  if (allUsersCache.length === 0) {
    await loadAllUsersToCache();
  }
  
  const searchTerm = document.getElementById('editOrderUserSearch').value.trim().toLowerCase();
  if (!searchTerm) {
    alert('請輸入搜尋關鍵字');
    return;
  }
  
  const filtered = allUsersCache.filter(u => {
    const phone = (u.phone || '').toString().toLowerCase();
    const nickname = (u.nickname || '').toLowerCase();
    return phone.includes(searchTerm) || nickname.includes(searchTerm);
  });
  
  const selectEl = document.getElementById('editOrderUserId');
  selectEl.innerHTML = '<option value="">-- 選擇用戶 --</option>';
  
  filtered.forEach(u => {
    const option = document.createElement('option');
    option.value = u.id;
    option.textContent = `${u.nickname || '未命名'} (${u.phone})`;
    selectEl.appendChild(option);
  });
  
  selectEl.style.display = 'block';
  
  // 顯示當前用戶信息（從訂單獲取）
  const currentUserDiv = document.getElementById('editOrderCurrentUser');
  currentUserDiv.style.display = 'block';
  
  if (filtered.length === 0) {
    alert('沒有找到符合的用戶');
  }
}

// 為團拆搜尋用戶
async function searchUsersForBreak() {
  if (allUsersCache.length === 0) {
    await loadAllUsersToCache();
  }
  
  const searchTerm = document.getElementById('editBreakUserSearch').value.trim().toLowerCase();
  if (!searchTerm) {
    alert('請輸入搜尋關鍵字');
    return;
  }
  
  const filtered = allUsersCache.filter(u => {
    const phone = (u.phone || '').toString().toLowerCase();
    const nickname = (u.nickname || '').toLowerCase();
    return phone.includes(searchTerm) || nickname.includes(searchTerm);
  });
  
  const selectEl = document.getElementById('editBreakUserId');
  selectEl.innerHTML = '<option value="">-- 選擇用戶 --</option>';
  
  filtered.forEach(u => {
    const option = document.createElement('option');
    option.value = u.id;
    option.textContent = `${u.nickname || '未命名'} (${u.phone})`;
    selectEl.appendChild(option);
  });
  
  selectEl.style.display = 'block';
  
  const currentUserDiv = document.getElementById('editBreakCurrentUser');
  currentUserDiv.style.display = 'block';
  
  if (filtered.length === 0) {
    alert('沒有找到符合的用戶');
  }
}
```

### 3. 修改 `handleEditOrderClick` 函數，添加當前用戶信息顯示

在原函數中添加：
```javascript
// 獲取並顯示當前用戶信息
const nickname = button.getAttribute('data-order-nickname') || '';
const phone = button.getAttribute('data-order-phone') || '';
document.getElementById('editOrderCurrentUserInfo').textContent = `${nickname} (${phone})`;
document.getElementById('editOrderCurrentUser').style.display = 'block';
```

### 4. 修改 `handleEditBreakClick` 函數，添加當前用戶信息顯示

在原函數中添加：
```javascript
// 獲取並顯示當前用戶信息
const buyer = button.getAttribute('data-break-buyer') || '';
document.getElementById('editBreakCurrentUserInfo').textContent = buyer;
document.getElementById('editBreakCurrentUser').style.display = 'block';
```

### 5. 修改 `updateOrderModal` 函數，支持更改用戶

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

### 6. 修改 `updateBreakModal` 函數，支持更改用戶

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

## Modal HTML 更新

### 訂單編輯 Modal 中添加（在"商品"欄位後）：

```html
<label>👤 訂購者（可轉讓給其他用戶）</label>
<div style="display: flex; gap: 10px; margin-bottom: 15px;">
  <input type="text" id="editOrderUserSearch" placeholder="輸入電話或暱稱搜尋..." style="flex: 1;" />
  <button type="button" onclick="searchUsersForOrder()" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">🔍 搜尋</button>
</div>
<select id="editOrderUserId" size="5" style="width: 100%; margin-bottom: 15px; display: none;">
  <option value="">未選擇用戶</option>
</select>
<div id="editOrderCurrentUser" style="padding: 10px; background: #f0f4f8; border-radius: 4px; margin-bottom: 15px; display: none;">
  <strong>當前訂購者：</strong><span id="editOrderCurrentUserInfo"></span>
</div>
```

### 團拆編輯 Modal 中添加（在"團名"欄位後）：

```html
<label>👤 訂購者（可轉讓給其他用戶）</label>
<div style="display: flex; gap: 10px; margin-bottom: 15px;">
  <input type="text" id="editBreakUserSearch" placeholder="輸入電話或暱稱搜尋..." style="flex: 1;" />
  <button type="button" onclick="searchUsersForBreak()" style="padding: 8px 16px; background: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">🔍 搜尋</button>
</div>
<select id="editBreakUserId" size="5" style="width: 100%; margin-bottom: 15px; display: none;">
  <option value="">未選擇用戶</option>
</select>
<div id="editBreakCurrentUser" style="padding: 10px; background: #f0f4f8; border-radius: 4px; margin-bottom: 15px; display: none;">
  <strong>當前訂購者：</strong><span id="editBreakCurrentUserInfo"></span>
</div>
```

## 後端 API 更新

需要確保 `updateOrder` 和 `updateBreak` API 支持更新 `user_id` 欄位。
