// ===== 管理後台分頁功能和用戶選擇器補丁 =====

// 分頁變數
let currentBreaksPage = 1;
const breaksPerPage = 30;
let totalBreaksCount = 0;

let currentUsersPage = 1;
const usersPerPage = 30;
let totalUsersCount = 0;

let currentCreditsPage = 1;
const creditsPerPage = 30;
let totalCreditsCount = 0;

// ===== 用戶選擇器功能 =====
let allUsersCache = [];

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
  
  if (filtered.length === 0) {
    alert('沒有找到符合的用戶');
  }
}

// ===== 團拆管理分頁 =====
function changeBreaksPage(newPage) {
  const totalPages = Math.ceil(totalBreaksCount / breaksPerPage);
  if (newPage < 1 || newPage > totalPages) return;
  currentBreaksPage = newPage;
  renderBreaksTable(breaksCache);
}

// ===== 用戶管理分頁 =====
function changeUsersPage(newPage) {
  const totalPages = Math.ceil(totalUsersCount / usersPerPage);
  if (newPage < 1 || newPage > totalPages) return;
  currentUsersPage = newPage;
  renderUsersTable(usersCache);
}

// ===== 團拆金管理分頁 =====
function changeCreditsPage(newPage) {
  const totalPages = Math.ceil(totalCreditsCount / creditsPerPage);
  if (newPage < 1 || newPage > totalPages) return;
  currentCreditsPage = newPage;
  renderCreditsTable(creditsCache);
}

console.log('✅ 管理後台分頁功能已載入');
