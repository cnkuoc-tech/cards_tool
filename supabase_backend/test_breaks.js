import fetch from 'node-fetch';

const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxP_RnfHMIGhY-0vMqfriy9boSzox4cw8kf4l1TNYbHYl2AUrW6zlI7IT0dCeVwb6T53A/exec';

async function testBreaksExport() {
  console.log('🧪 測試導出團拆紀錄...\n');
  
  const response = await fetch(GAS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'exportAllBreaks' })
  });
  
  const data = await response.json();
  
  console.log('📊 導出結果:');
  console.log(`  成功: ${data.success}`);
  console.log(`  數量: ${data.count || 0}`);
  
  if (data.breaks && data.breaks.length > 0) {
    console.log('\n📝 第一筆範例:');
    console.log(JSON.stringify(data.breaks[0], null, 2));
  } else {
    console.log('\n⚠️  無團拆資料');
    console.log('完整回應:', JSON.stringify(data, null, 2));
  }
}

testBreaksExport().catch(console.error);
