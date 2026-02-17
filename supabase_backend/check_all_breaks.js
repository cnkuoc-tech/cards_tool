import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkAllBreaks() {
  const { data, count } = await supabase
    .from('breaks')
    .select('*', { count: 'exact' });
  
  console.log(`總筆數: ${count}`);
  
  const withUserId = data.filter(d => d.user_id);
  const withoutUserId = data.filter(d => !d.user_id);
  const emptyName = data.filter(d => !d.name || d.name.trim() === '');
  
  console.log(`有 user_id: ${withUserId.length}`);
  console.log(`沒有 user_id: ${withoutUserId.length}`);
  console.log(`團名為空: ${emptyName.length}`);
  
  if (withUserId.length > 0) {
    console.log('\n✅ 有 user_id 的前 5 筆:');
    withUserId.slice(0, 5).forEach((d, i) => {
      console.log(`${i+1}. break_id=${d.break_id} name="${d.name}" user_id=${d.user_id}`);
    });
  }
  
  if (emptyName.length > 0) {
    console.log('\n⚠️  團名為空的前 5 筆:');
    emptyName.slice(0, 5).forEach((d, i) => {
      console.log(`${i+1}. break_id=${d.break_id} name="${d.name}" user_id=${d.user_id} item="${d.item}"`);
    });
  }
}

checkAllBreaks();
