/**
 * 完整的管理後台更新腳本
 * 
 * 已完成的功能：
 * 1. ✅ 訂單管理分頁 (30筆/頁)
 * 2. ✅ 用戶管理分頁 (30筆/頁)
 * 3. ✅ 用戶選擇器功能 (searchUsersForOrder, searchUsersForBreak)
 * 
 * 待完成的功能（請手動添加到 admin.html）：
 * 1. 團拆管理分頁
 * 2. 團拆金管理分頁
 * 3. 在訂單/團拆編輯 Modal 中添加用戶選擇器 HTML
 * 4. 修改 updateOrderModal 和 updateBreakModal 支持更新 user_id
 * 5. 修改後端 API 支持 user_id 更新
 */

// ===== 請在 renderBreaksTable 函數中修改為以下內容 =====

function renderBreaksTable(breaks) {
  // 📖 計算分頁
  totalBreaksCount = breaks.length;
  const totalPages = Math.ceil(totalBreaksCount / breaksPerPage);
  const startIdx = (currentBreaksPage - 1) * breaksPerPage;
  const endIdx = startIdx + breaksPerPage;
  const pageBreaks = breaks.slice(startIdx, endIdx);
  
  let html = '<table style="width: 100%; border-collapse: collapse;"><tr>';
  html += `<th style="width: 40px;"><input type="checkbox" id="selectAllBreaks" onchange="toggleSelectAllBreaks(this.checked)"></th>`;
  
  const headers = [
    { key: 'break_id', label: '團拆編號' },
    { key: 'buyer', label: '訂購人' },
    { key: 'name', label: '團名' },
    { key: 'category', label: '類別' },
    { key: 'total_fee', label: '總團費' },
    { key: 'paid', label: '已付金額' },
    { key: 'balance', label: '尾款' },
    { key: 'status', label: '狀態' }
  ];
  
  headers.forEach(h => {
    let arrow = '';
    if (breaksSortKey === h.key) {
      arrow = breaksSortAsc ? ' ▲' : ' ▼';
    }
    html += `<th onclick="sortBreaksBy('${h.key}')" style="cursor:pointer; user-select:none;">${h.label}${arrow}</th>`;
  });
  html += '<th>購買品項</th><th>已拆</th><th>已寄出</th><th>操作</th></tr>';
  
  pageBreaks.forEach(breakItem => {
    const balance = (breakItem.total_fee || 0) - (breakItem.paid || 0);
    html += `<tr>
      <td style="width: 40px;"><input type="checkbox" class="break-checkbox" data-break-id="${breakItem.id}" onchange="updateBreakBatchSelectUI()"></td>
      <td>${breakItem.break_id || '-'}</td>
      <td>${breakItem.buyer || '-'}</td>
      <td>${breakItem.name || '-'}</td>
      <td>${breakItem.category || '-'}</td>
      <td style="text-align: right;">NT$ ${(breakItem.total_fee || 0).toLocaleString()}</td>
      <td style="text-align: right;">NT$ ${(breakItem.paid || 0).toLocaleString()}</td>
      <td style="text-align: right; font-weight: bold; color: #e74c3c;">NT$ ${balance.toLocaleString()}</td>
      <td><strong>${breakItem.status || '未知'}</strong></td>
      <td>${breakItem.item || '-'}</td>
      <td style="text-align: center;">${breakItem.is_opened ? '✓' : '-'}</td>
      <td style="text-align: center;">${breakItem.is_shipped ? '✓' : '-'}</td>
      <td>
        <button class="action-btn btn-edit" data-break-id="${breakItem.id}" data-break-name="${(breakItem.name || '').replace(/"/g, '&quot;')}" data-break-total="${breakItem.total_fee || 0}" data-break-paid="${breakItem.paid || 0}" data-break-status="${breakItem.status || ''}" data-break-item="${(breakItem.item || '').replace(/"/g, '&quot;')}" data-break-opened="${breakItem.is_opened || false}" data-break-shipped="${breakItem.is_shipped || false}" data-break-buyer="${(breakItem.buyer || '').replace(/"/g, '&quot;')}" onclick="handleEditBreakClick(this)">編輯</button>
        <button class="action-btn btn-delete" onclick="deleteBreak('${breakItem.id}', '${(breakItem.name || '').replace(/'/g, "\\'")}')">刪除</button>
      </td>
    </tr>`;
  });
  html += '</table>';
  
  // 📖 加入分頁控制
  if (totalPages > 1) {
    html += '<div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:20px;">';
    html += `<button onclick="changeBreaksPage(${currentBreaksPage - 1})" ${currentBreaksPage === 1 ? 'disabled' : ''} style="padding:8px 16px;border:1px solid #ddd;background:white;border-radius:6px;cursor:pointer;">&laquo; 上一頁</button>`;
    html += `<span style="color:#666;font-size:14px;">第 ${currentBreaksPage} / ${totalPages} 頁 (共 ${totalBreaksCount} 筆)</span>`;
    html += `<button onclick="changeBreaksPage(${currentBreaksPage + 1})" ${currentBreaksPage === totalPages ? 'disabled' : ''} style="padding:8px 16px;border:1px solid #ddd;background:white;border-radius:6px;cursor:pointer;">下一頁 &raquo;</button>`;
    html += '</div>';
  } else {
    html += `<div style="text-align:center;margin-top:15px;color:#666;font-size:14px;">共 ${totalBreaksCount} 筆團拆</div>`;
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

// ===== 團拆金管理分頁（需要添加到 loadBreakCredits 之後）=====

function renderCreditsTable(credits) {
  // 📖 計算分頁
  totalCreditsCount = credits.length;
  const totalPages = Math.ceil(totalCreditsCount / creditsPerPage);
  const startIdx = (currentCreditsPage - 1) * creditsPerPage;
  const endIdx = startIdx + creditsPerPage;
  const pageCredits = credits.slice(startIdx, endIdx);
  
  let html = `
    <table>
      <thead>
        <tr>
          <th>暱稱</th>
          <th>金額 (NT$)</th>
          <th>已使用 (NT$)</th>
          <th>可用餘額 (NT$)</th>
          <th>取得方式</th>
          <th>使用在哪一團</th>
          <th>狀態</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  pageCredits.forEach(credit => {
    const available = credit.credit - (credit.usedAmount || 0);
    const status = credit.used ? '已使用' : '可用';
    const safeNickname = (credit.nickname || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeSource = (credit.source || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeUsedBreak = (credit.usedBreak || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const usedBreakDisplay = credit.usedBreak ? credit.usedBreak.split('||').join(', ') : '-';
    html += `
      <tr>
        <td>${credit.nickname}</td>
        <td>${credit.credit}</td>
        <td>${credit.usedAmount || 0}</td>
        <td>${available}</td>
        <td>${credit.source || '-'}</td>
        <td title="${usedBreakDisplay}">${usedBreakDisplay.length > 30 ? usedBreakDisplay.substring(0, 30) + '...' : usedBreakDisplay}</td>
        <td>${status}</td>
        <td>
          <button class="btn-edit" data-id="${credit.id}" data-nickname="${safeNickname}" data-credit="${credit.credit}" data-source="${safeSource}" data-usedbreak="${safeUsedBreak}" onclick="openEditCreditModalSafe(this)">編輯</button>
          <button class="btn-delete" data-id="${credit.id}" onclick="deleteCreditSafe(this)">刪除</button>
        </td>
      </tr>
    `;
  });
  
  html += `
      </tbody>
    </table>
  `;
  
  // 📖 加入分頁控制
  if (totalPages > 1) {
    html += '<div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-top:20px;">';
    html += `<button onclick="changeCreditsPage(${currentCreditsPage - 1})" ${currentCreditsPage === 1 ? 'disabled' : ''} style="padding:8px 16px;border:1px solid #ddd;background:white;border-radius:6px;cursor:pointer;">&laquo; 上一頁</button>`;
    html += `<span style="color:#666;font-size:14px;">第 ${currentCreditsPage} / ${totalPages} 頁 (共 ${totalCreditsCount} 筆)</span>`;
    html += `<button onclick="changeCreditsPage(${currentCreditsPage + 1})" ${currentCreditsPage === totalPages ? 'disabled' : ''} style="padding:8px 16px;border:1px solid #ddd;background:white;border-radius:6px;cursor:pointer;">下一頁 &raquo;</button>`;
    html += '</div>';
  } else {
    html += `<div style="text-align:center;margin-top:15px;color:#666;font-size:14px;">共 ${totalCreditsCount} 筆團拆金</div>`;
  }
  
  document.getElementById('creditList').innerHTML = html;
}

function changeCreditsPage(newPage) {
  const totalPages = Math.ceil(totalCreditsCount / creditsPerPage);
  if (newPage < 1 || newPage > totalPages) return;
  currentCreditsPage = newPage;
  renderCreditsTable(creditsCache);
}

console.log('✅ 完整的後台管理分頁功能腳本');
