import dotenv from 'dotenv';
dotenv.config();

async function testOrdersExport() {
  const response = await fetch(process.env.GAS_EXPORT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'exportAllOrders' })
  });
  
  const data = await response.json();
  console.log('訂單導出測試結果:');
  console.log(`成功: ${data.success}`);
  console.log(`數量: ${data.count || 0}`);
  
  if (data.orders && data.orders.length > 0) {
    console.log('\n第一筆訂單範例:');
    console.log(JSON.stringify(data.orders[0], null, 2));
  } else {
    console.log('\n無訂單資料或工作表為空');
  }
  
  if (!data.success) {
    console.log('錯誤訊息:', data.message);
  }
}

testOrdersExport();
