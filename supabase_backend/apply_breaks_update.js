require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function applySQL() {
  const sql = fs.readFileSync('../supabase_migration/update_breaks_table.sql', 'utf8');
  
  console.log('執行 SQL 更新 breaks 表...');
  console.log(sql);
  
  console.log('\n⚠️  請手動在 Supabase SQL Editor 執行以上 SQL');
}

applySQL();
