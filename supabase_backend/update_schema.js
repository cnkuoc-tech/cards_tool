import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://hmqwcpstzkxfwabasqgx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtcXdjcHN0emt4ZndhYmFzcWd4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQxMzU5OCwiZXhwIjoyMDg0OTg5NTk4fQ.f6tQ3Mu-a9bz8NtaBBQHJjR2cBPGSI_KBvT1TG-lBec';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function updateSchema() {
  console.log('🔧 正在更新 users 表的 birthday 欄位類型...');
  
  const sql = `
    ALTER TABLE users 
    ALTER COLUMN birthday TYPE VARCHAR(4) USING birthday::TEXT;
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // 如果沒有 exec_sql 函數，直接用 SQL
      console.log('嘗試直接執行 SQL...');
      const { error: directError } = await supabase
        .from('_sql')
        .insert({ query: sql });
        
      if (directError) {
        throw directError;
      }
    }
    
    console.log('✅ Schema 更新完成');
  } catch (err) {
    console.error('❌ 更新失敗:', err.message);
    console.log('\n請在 Supabase Dashboard 的 SQL Editor 中手動執行以下 SQL：');
    console.log('─'.repeat(60));
    console.log(sql);
    console.log('─'.repeat(60));
  }
}

updateSchema();
